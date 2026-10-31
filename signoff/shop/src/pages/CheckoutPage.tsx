/**
 * Checkout page with PayPal JS SDK integration and calm handoff.
 *
 * Implements Step 3:
 * 1. Above the checkout button, show a one-line summary: "2 items · USD 42.00".
 * 2. The button reads "Pay with PayPal" and is the primary action.
 * 3. While the PayPal window is open, show a quiet inline status under the button:
 *    "Waiting for PayPal…" with a spinner, and disable the button.
 * 4. On success, go to the confirmation page.
 * 5. On failure or cancel, show one sentence and re-enable the button. Never leave a half-filled state.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button, ErrorState, Money, Skeleton } from '@signoff/ui';
import { captureShopOrder, createShopOrder, getDemoSessionId } from '../api';
import { useCart } from '../CartContext';
import { Link, useRouter } from '../router';
import { isStubCheckoutEnabled } from '../sandbox';
import { retailTheme } from '../theme';

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const buttonsRenderedRef = useRef(false);
  const pendingOrderCodeRef = useRef<string | null>(null);

  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test';
  const totalCount = items.reduce((sum, it) => sum + it.quantity, 0);
  const summaryLineText = `${totalCount} ${totalCount === 1 ? 'item' : 'items'} · ${subtotal.currency_code} ${subtotal.value}`;

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

    const timer = setTimeout(() => {
      if (active && !window.paypal) {
        setSdkLoading(false);
        setSdkFailed(true);
      }
    }, 4000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items.length, clientId]);

  const executeCapture = async (orderCode: string, paypalOrderId?: string) => {
    setCapturing(true);
    setStatusMessage('Waiting for PayPal…');
    setError(null);
    setCancelMessage(null);
    pendingOrderCodeRef.current = orderCode;

    try {
      await captureShopOrder(orderCode, {
        paypal_order_id: paypalOrderId,
      });
      clearCart();
      navigate(`/confirmation/${orderCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Capture failed. Please try again.');
      setCapturing(false);
      setStatusMessage(null);
    }
  };

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
          setCapturing(true);
          setStatusMessage('Waiting for PayPal…');
          try {
            const created = await createShopOrder({
              customer_email: email,
              items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
              demo_session_id: getDemoSessionId(),
            });
            pendingOrderCodeRef.current = created.order_code;
            return created.paypal_order_id;
          } catch (err: unknown) {
            setCapturing(false);
            setStatusMessage(null);
            setError(err instanceof Error ? err.message : 'Order creation failed.');
            throw err;
          }
        },
        onApprove: async (data: { orderID: string }) => {
          if (!pendingOrderCodeRef.current) return;
          await executeCapture(pendingOrderCodeRef.current, data.orderID);
        },
        onCancel: () => {
          setCapturing(false);
          setStatusMessage(null);
          setCancelMessage('Payment was cancelled or closed. Your cart items remain intact.');
        },
        onError: (err: unknown) => {
          setCapturing(false);
          setStatusMessage(null);
          setError(err instanceof Error ? err.message : 'An error occurred during payment.');
        },
      }).render(paypalContainerRef.current).catch(() => {
        setSdkFailed(true);
      });
    } catch {
      setSdkFailed(true);
    }
  }, [email, items]);

  const handleSandboxFallbackPay = async () => {
    setError(null);
    setCancelMessage(null);
    setCapturing(true);
    setStatusMessage('Waiting for PayPal…');
    try {
      const created = await createShopOrder({
        customer_email: email,
        items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
        demo_session_id: getDemoSessionId(),
      });
      await executeCapture(created.order_code, created.paypal_order_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setCapturing(false);
      setStatusMessage(null);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px', fontFamily: retailTheme.fontFamily }}>
        <p style={{ color: retailTheme.inkMuted }}>Your cart is empty.</p>
        <Link to="/" style={{ color: retailTheme.ink, textDecoration: 'underline' }}>
          Browse candles
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: retailTheme.pageBg,
        minHeight: '100vh',
        padding: '36px 16px',
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <style>{`
        @keyframes shop-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .shop-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-top-color: #303030;
          border-radius: 50%;
          animation: shop-spin 0.8s linear infinite;
        }
      `}</style>

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <nav style={{ marginBottom: '20px' }}>
          <Link
            to="/cart"
            testId="shop-back-to-cart-link"
            style={{ color: retailTheme.inkMuted, fontSize: '13px', textDecoration: 'underline' }}
          >
            ← Return to cart
          </Link>
        </nav>

        <div
          data-testid="shop-checkout-container"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '32px',
          }}
        >
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 0 20px 0',
              color: retailTheme.ink,
              fontFamily: retailTheme.serifFont,
            }}
          >
            PayPal Checkout
          </h1>

          {/* One-line summary above checkout */}
          <div
            data-testid="shop-checkout-one-line-summary"
            style={{
              padding: '16px',
              backgroundColor: retailTheme.surfaceWarm,
              borderRadius: '6px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: retailTheme.ink, fontSize: '14px' }}>
                {summaryLineText}
              </div>
              <div style={{ fontSize: '12px', color: retailTheme.inkMuted, marginTop: '2px' }}>
                Verified with catalog prices
              </div>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: retailTheme.ink }}>
              <Money money={subtotal} testId="shop-checkout-total" />
            </div>
          </div>

          {/* Buyer Email Input */}
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="shop-email-input"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: retailTheme.ink, marginBottom: '6px' }}
            >
              Buyer Email:
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
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${retailTheme.borderSubtle}`,
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Inline Waiting Status */}
          {capturing && (
            <div
              data-testid="shop-waiting-status"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                color: retailTheme.ink,
                padding: '16px',
                backgroundColor: retailTheme.surfaceWarm,
                borderRadius: '6px',
                marginBottom: '16px',
              }}
            >
              <span className="shop-spinner" />
              <span>{statusMessage || 'Waiting for PayPal…'}</span>
            </div>
          )}

          {/* Single sentence cancel / failure feedback */}
          {cancelMessage && !capturing && (
            <p
              data-testid="shop-cancel-message"
              style={{
                color: retailTheme.inkMuted,
                fontSize: '13px',
                backgroundColor: retailTheme.surfaceWarm,
                padding: '10px 14px',
                borderRadius: '6px',
                margin: '0 0 16px 0',
              }}
            >
              {cancelMessage}
            </p>
          )}

          {error && !capturing && (
            <p
              data-testid="shop-error-message"
              style={{
                color: '#991B1B',
                fontSize: '13px',
                backgroundColor: '#FEF2F2',
                padding: '10px 14px',
                borderRadius: '6px',
                margin: '0 0 16px 0',
              }}
            >
              {error}
            </p>
          )}

          {/* PayPal Buttons or Direct Sandbox Button */}
          <div style={{ marginTop: '20px' }}>
            {sdkLoading && (
              <div data-testid="shop-sdk-loading" style={{ padding: '8px 0' }}>
                <Skeleton width="100%" height="40px" />
              </div>
            )}

            <div
              id="paypal-button-container"
              ref={paypalContainerRef}
              data-testid="shop-paypal-buttons"
              style={{ minHeight: '40px', marginBottom: '12px' }}
            />

            {sdkFailed && (
              <div style={{ marginBottom: '12px' }}>
                <ErrorState
                  message="PayPal checkout could not load. Refresh this page and try again. No payment has been confirmed."
                  testId="shop-sdk-error-state"
                />
              </div>
            )}

            {/* Pay with PayPal Button */}
            {isStubCheckoutEnabled() && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <Button
                variant="primary"
                onClick={() => void handleSandboxFallbackPay()}
                disabled={capturing}
                testId="shop-sandbox-pay-btn"
              >
                Run local stub checkout
              </Button>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
};
