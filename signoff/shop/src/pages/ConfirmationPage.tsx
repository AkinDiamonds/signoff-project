/**
 * Order confirmation page.
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton, StatusBadge } from '@signoff/ui';
import { fetchOrderDetail } from '../api';
import { useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';
import type { OrderDetail } from '../types';

export const ConfirmationPage: React.FC<{ orderCode: string }> = ({ orderCode }) => {
  const { navigate } = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let active = true;
    setLoading(true);

    // Try fetching with default sandbox email, or fallback to minimal local confirmation display
    fetchOrderDetail(orderCode, 'alex.morgan@example.test')
      .then(res => {
        if (active) {
          setOrder(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          // If unauthenticated lookup fails, we still render the confirmed order code
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [orderCode]);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
      <div
        data-testid="shop-confirmation-card"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.md,
          padding: '36px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: warmColors.successBg,
            border: `1px solid ${warmColors.successBorder}`,
            color: warmColors.successInk,
            fontSize: '32px',
            marginBottom: '16px',
          }}
        >
          ✓
        </div>

        <h1
          data-testid="shop-confirmation-title"
          style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', color: warmColors.ink }}
        >
          Thank you for your order!
        </h1>
        <p style={{ color: warmColors.inkMuted, fontSize: '15px', margin: '0 0 24px 0' }}>
          Your candle order has been paid in full via PayPal Sandbox.
        </p>

        {/* Order code callout */}
        <div
          style={{
            display: 'inline-block',
            backgroundColor: warmColors.surfaceMuted,
            padding: '12px 24px',
            borderRadius: '8px',
            border: `1px solid ${warmColors.border}`,
            marginBottom: '32px',
          }}
        >
          <div style={{ fontSize: '12px', color: warmColors.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Order Reference Code
          </div>
          <div
            data-testid="shop-order-code"
            style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: warmColors.accent, marginTop: '4px' }}
          >
            {orderCode}
          </div>
        </div>

        {loading && (
          <div style={{ padding: '20px 0' }}>
            <Skeleton width="100%" height="80px" />
          </div>
        )}

        {order && (
          <div
            data-testid="shop-order-details"
            style={{
              textAlign: 'left',
              backgroundColor: warmColors.surfaceMuted,
              padding: '24px',
              borderRadius: '12px',
              border: `1px solid ${warmColors.borderMuted}`,
              marginBottom: '32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, color: warmColors.ink }}>
                Payment Status:
              </div>
              <div data-testid="shop-order-status">
                <StatusBadge verdict="ALLOW" testId="shop-order-status-badge" />
                <span style={{ marginLeft: '8px', fontWeight: 600, fontSize: '13px', color: warmColors.successInk }}>
                  {order.status}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, color: warmColors.ink }}>
                Total Paid:
              </div>
              <div style={{ fontWeight: 700, color: warmColors.accent, fontSize: '18px' }}>
                <Money money={order.amount} testId="shop-order-amount" />
              </div>
            </div>

            {/* Line items */}
            {order.items && order.items.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${warmColors.border}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: warmColors.inkMuted, marginBottom: '8px' }}>
                  Items in this shipment:
                </div>
                {order.items.map(item => (
                  <div
                    key={item.sku}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px',
                      padding: '4px 0',
                    }}
                  >
                    <span>{item.name || item.sku} × {item.quantity}</span>
                    <span style={{ fontWeight: 500 }}>
                      <Money
                        money={{ value: item.unit_price, currency_code: 'USD' }}
                        testId={`shop-order-item-price-${item.sku}`}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tracking information */}
            {order.tracking_events && order.tracking_events.length > 0 && (
              <div
                data-testid="shop-order-tracking"
                style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: `1px solid ${warmColors.border}`,
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: warmColors.inkMuted, marginBottom: '6px' }}>
                  Mock Tracking:
                </div>
                {order.tracking_events.map((ev, idx) => (
                  <div key={idx} style={{ fontSize: '13px', color: warmColors.ink }}>
                    <strong>{ev.carrier}</strong> tracking: <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{ev.tracking_number}</code> ({ev.status})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            testId="shop-confirmation-continue-btn"
          >
            Back to Storefront
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/orders/${orderCode}`)}
            testId="shop-view-in-portal-btn"
          >
            View in Buyer Portal →
          </Button>
        </div>
      </div>
    </div>
  );
};
