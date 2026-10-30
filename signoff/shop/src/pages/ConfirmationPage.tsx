/**
 * Order confirmation page.
 *
 * Implements Step 3, Rule 4:
 * - On success, go to the confirmation page showing the order code in large monospace,
 *   the amount, and one next action: Track this order.
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton, StatusBadge } from '@signoff/ui';
import { fetchOrderDetail } from '../api';
import { useRouter } from '../router';
import { retailTheme } from '../theme';
import type { OrderDetail } from '../types';

export const ConfirmationPage: React.FC<{ orderCode: string }> = ({ orderCode }) => {
  const { navigate } = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchOrderDetail(orderCode, 'alex.morgan@example.test')
      .then(res => {
        if (active) {
          setOrder(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [orderCode]);

  return (
    <div
      style={{
        backgroundColor: retailTheme.pageBg,
        minHeight: '100vh',
        padding: '48px 16px',
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <div
        data-testid="shop-confirmation-card"
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          boxShadow: retailTheme.cardShadow,
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <h1
          data-testid="shop-confirmation-title"
          style={{
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 12px 0',
            color: retailTheme.ink,
            fontFamily: retailTheme.serifFont,
          }}
        >
          Thank you for your order
        </h1>

        <p style={{ color: retailTheme.inkMuted, fontSize: '14px', margin: '0 0 28px 0' }}>
          Your order has been paid in full via the PayPal sandbox.
        </p>

        {/* Large monospace order code */}
        <div
          style={{
            backgroundColor: retailTheme.imageBg,
            padding: '16px 24px',
            borderRadius: '8px',
            marginBottom: '28px',
          }}
        >
          <div style={{ fontSize: '12px', color: retailTheme.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Order Code
          </div>
          <div
            data-testid="shop-order-code"
            style={{
              fontSize: '32px',
              fontWeight: 700,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              color: retailTheme.ink,
              marginTop: '4px',
              letterSpacing: '0.05em',
            }}
          >
            {orderCode}
          </div>
        </div>

        {loading && (
          <div style={{ padding: '16px 0' }}>
            <Skeleton width="100%" height="48px" />
          </div>
        )}

        {order && (
          <div
            data-testid="shop-order-details"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: retailTheme.surfaceWarm,
              borderRadius: '8px',
              marginBottom: '32px',
              fontSize: '14px',
            }}
          >
            <div data-testid="shop-order-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusBadge verdict="ALLOW" testId="shop-order-status-badge" />
              <span style={{ fontWeight: 600, color: retailTheme.ink }}>{order.status}</span>
            </div>

            <div style={{ fontWeight: 700, fontSize: '18px', color: retailTheme.ink }}>
              <Money money={order.amount} testId="shop-order-amount" />
            </div>
          </div>
        )}

        {/* One next action: Track this order */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Button
            variant="primary"
            onClick={() => navigate(`/orders/${orderCode}`)}
            testId="shop-view-in-portal-btn"
          >
            Track this order
          </Button>

          <button
            type="button"
            onClick={() => navigate('/')}
            data-testid="shop-confirmation-continue-btn"
            style={{
              background: 'none',
              border: 'none',
              color: retailTheme.inkMuted,
              fontSize: '13px',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            ← Return to store
          </button>
        </div>
      </div>
    </div>
  );
};
