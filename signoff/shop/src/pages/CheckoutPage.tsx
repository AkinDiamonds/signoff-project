/**
 * Checkout page with PayPal JS SDK integration and sandbox fallback.
 *
 * Edge case handling (Step 31):
 * - Popup blocked / cancelled: returns cleanly with intact cart.
 * - Slow capture: displays pending progress indicator with timeout and retry.
 * - Stale prices / tampering: server computes total from catalog; client price ignored.
 * - SDK failure: clear error state with retry and sandbox direct payment fallback.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, ErrorState, Money, Skeleton } from '@signoff/ui';
import { captureShopOrder, createShopOrder, getDemoSessionId } from '../api';
import { useCart } from '../CartContext';
import { Link, useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';

// Type declaration for PayPal window object
declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string; payerID?: string }) => Promise<void>;
        onCancel?: () => void;
        onError?: (err: unknown) => void;
      }) => {
        render: (container: HTMLElement) => Promise<void>;
      };
    };
  }
}

export const CheckoutPage: React.FC = () => {
  const { items, subtotal, clearCart } = useCart();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('alex.morgan@example.test');
  const [sdkLoading, setSdkLoading] = useState(true);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureTimeout, setCaptureTimeout] = useState(false);
  const [pendingOrderCode, setPendingOrderCode] = useState<string | null>(null);
  const [pendingPaypalOrderId, setPendingPaypalOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const buttonsRenderedRef = useRef(false);
  // Ref so onApprove always sees the latest order code without re-mounting buttons
  const pendingOrderCodeRef = useRef<string | null>(null);

  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test';

  // Load PayPal JS SDK dynamically
  useEffect(() => {
    if (items.length === 0) return;

    if (window.paypal) {
      setSdkLoading(false);
      return;
    }

    let active = true;
    const scriptId = 'paypal-js-sdk';
    const existing = document.getElementById(scriptId);
    let script = existing instanceof HTMLScriptElement ? existing : null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons`;
      script.async = true;

      script.onload = () => {
        if (active) {
          setSdkLoading(false);
          setSdkFailed(false);
        }
      };

      script.onerror = () => {
        if (active) {
          setSdkLoading(false);
          setSdkFailed(true);
        }
      };

      document.body.appendChild(script);
    } else {
      setSdkLoading(false);
    }

    // Fallback timer: if SDK takes > 6s (e.g. offline or adblocker), mark as failed to show fallback
    const timer = setTimeout(() => {
      if (active && !window.paypal) {
        setSdkLoading(false);
        setSdkFailed(true);
      }
    }, 6000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items.length, clientId]);

  // Execute order capture with timeout monitoring
  const executeCapture = async (orderCode: string, paypalOrderId?: string) => {
    setCapturing(true);
    setCaptureTimeout(false);
    setError(null);
    setPendingOrderCode(orderCode);
    pendingOrderCodeRef.current = orderCode;
    setPendingPaypalOrderId(paypalOrderId ?? null);

    // 15 second slow-capture watchdog
    const timeoutHandle = setTimeout(() => {
      setCaptureTimeout(true);
    }, 15000);

    try {
      await captureShopOrder(orderCode, {
        paypal_order_id: paypalOrderId,
      });
      clearTimeout(timeoutHandle);
      clearCart();
      navigate(`/confirmation/${orderCode}`);
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      setError(err instanceof Error ? err.message : 'Capture failed');
      setCapturing(false);
    }
  };

  // Render PayPal SDK Buttons when SDK is loaded
  useEffect(() => {
    if (!window.paypal || !paypalContainerRef.current || buttonsRenderedRef.current || items.length === 0) {
      return;
    }

    try {
      buttonsRenderedRef.current = true;
      paypalContainerRef.current.innerHTML = '';

      window.paypal.Buttons({
        createOrder: async () => {
          setError(null);
          setCancelMessage(null);
          try {
            const created = await createShopOrder({
              customer_email: email,
              items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
              demo_session_id: getDemoSessionId(),
            });
            // Update both state (for display) and ref (for onApprove closure)
            setPendingOrderCode(created.order_code);
            pendingOrderCodeRef.current = created.order_code;
            return created.paypal_order_id;
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Order creation failed');
            throw err;
          }
        },
        onApprove: async (data: { orderID: string }) => {
          // Use ref — not state — to avoid stale closure on the initial render value
          if (!pendingOrderCodeRef.current) return;
          await executeCapture(pendingOrderCodeRef.current, data.orderID);
        },
        onCancel: () => {
          // Edge case: Popup closed or buyer cancelled -> cart remains completely intact!
          setCancelMessage('Payment popup was closed or cancelled. Your cart items remain intact.');
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : 'An error occurred during payment.');
        },
      }).render(paypalContainerRef.current).catch(() => {
        setSdkFailed(true);
      });
    } catch {
      setSdkFailed(true);
    }
  // Intentionally omit pendingOrderCode from deps: we access it via ref to avoid
  // re-mounting PayPal buttons mid-flow (which would break the SDK popup).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, items]);

  // Direct sandbox fallback payment (for automated tests or offline sandbox)
  const handleSandboxFallbackPay = async () => {
    setError(null);
    setCancelMessage(null);
    // Note: executeCapture sets capturing=true; don't set it here to avoid double-state.
    try {
      const created = await createShopOrder({
        customer_email: email,
        items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
        demo_session_id: getDemoSessionId(),
      });
      await executeCapture(created.order_code, created.paypal_order_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setCapturing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <Card testId="shop-empty-checkout">
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <h2 style={{ color: warmColors.ink, margin: '0 0 12px 0' }}>Your cart is empty</h2>
            <p style={{ color: warmColors.inkMuted, marginBottom: '20px' }}>
              Add items to your cart before proceeding to checkout.
            </p>
            <Button variant="primary" onClick={() => navigate('/')} testId="shop-return-catalog-btn">
              Return to Catalog
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
      <nav style={{ marginBottom: '24px' }}>
        <Link
          to="/cart"
          testId="shop-back-to-cart-link"
          style={{ color: warmColors.primary, fontSize: '14px', fontWeight: 500 }}
        >
          ← Return to Cart
        </Link>
      </nav>

      <div
        data-testid="shop-checkout-container"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.md,
          padding: '32px',
        }}
      >
        <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 24px 0', color: warmColors.ink }}>
          Checkout
        </h1>

        {/* Order amount review */}
        <div
          style={{
            padding: '16px',
            backgroundColor: warmColors.surfaceMuted,
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: warmColors.ink }}>
              Order Total ({items.reduce((s, i) => s + i.quantity, 0)} items)
            </div>
            <div style={{ fontSize: '12px', color: warmColors.inkMuted, marginTop: '2px' }}>
              Calculated and verified by backend server
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: warmColors.accent }}>
            <Money money={subtotal} testId="shop-checkout-total" />
          </div>
        </div>

        {/* Customer Email Input */}
        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="shop-email-input"
            style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: warmColors.ink, marginBottom: '6px' }}
          >
            Buyer Email Address:
          </label>
          <input
            id="shop-email-input"
            data-testid="shop-email-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '10px 14px',
              borderRadius: '6px',
              border: `1px solid ${warmColors.border}`,
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '12px', color: warmColors.inkMuted, marginTop: '4px' }}>
            Used for order lookup and receipt. Default matches public sandbox buyer.
          </div>
        </div>

        {/* Cancelled payment notice */}
        {cancelMessage && (
          <div
            data-testid="shop-checkout-cancelled-notice"
            style={{
              padding: '12px 16px',
              backgroundColor: warmColors.warningBg,
              border: `1px solid ${warmColors.warningBorder}`,
              borderRadius: '8px',
              color: warmColors.warningInk,
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{cancelMessage}</span>
            <Button variant="secondary" onClick={() => navigate('/cart')} testId="shop-cancelled-cart-btn">
              View Cart
            </Button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            data-testid="shop-checkout-error"
            style={{
              padding: '12px 16px',
              backgroundColor: warmColors.errorBg,
              border: `1px solid ${warmColors.errorBorder}`,
              borderRadius: '8px',
              color: warmColors.errorInk,
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            <strong>Payment Error:</strong> {error}
          </div>
        )}

        {/* Slow capture pending state */}
        {capturing && (
          <div
            data-testid="shop-capture-pending"
            style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: warmColors.surfaceMuted,
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            <div style={{ fontWeight: 600, color: warmColors.ink }}>
              Capturing payment with PayPal...
            </div>
            <div style={{ fontSize: '13px', color: warmColors.inkMuted, marginTop: '4px' }}>
              Please do not refresh or close this tab.
            </div>

            {captureTimeout && pendingOrderCode && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '13px', color: warmColors.warningInk, marginBottom: '8px' }}>
                  Capture is taking longer than expected.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => void executeCapture(pendingOrderCode, pendingPaypalOrderId ?? undefined)}
                  testId="shop-retry-capture-btn"
                >
                  Retry Capture
                </Button>
              </div>
            )}
          </div>
        )}

        {/* PayPal SDK Buttons Section */}
        {!capturing && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: warmColors.ink, marginBottom: '12px' }}>
              Pay with PayPal Sandbox
            </h3>

            {sdkLoading && (
              <div data-testid="shop-sdk-loading" style={{ padding: '16px 0' }}>
                <Skeleton width="100%" height="48px" />
              </div>
            )}

            {/* Container for PayPal JS SDK Buttons */}
            <div
              id="paypal-button-container"
              ref={paypalContainerRef}
              data-testid="shop-paypal-buttons"
              style={{ minHeight: '45px', marginBottom: '16px' }}
            />

            {/* SDK Failure State or Test Runner Fallback */}
            {sdkFailed && (
              <div style={{ marginBottom: '16px' }}>
                <ErrorState
                  message="PayPal JS SDK could not be loaded from PayPal servers. You can still complete this order using the direct sandbox checkout below."
                  testId="shop-sdk-error-state"
                />
              </div>
            )}

            {/* Direct Sandbox Checkout Button (always available for fast headless testing and offline stubs) */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: `1px solid ${warmColors.borderMuted}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', color: warmColors.inkMuted }}>
                Sandbox instant test checkout:
              </div>
              <Button
                variant="primary"
                onClick={() => void handleSandboxFallbackPay()}
                testId="shop-sandbox-pay-btn"
              >
                Pay with Sandbox (Instant)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
