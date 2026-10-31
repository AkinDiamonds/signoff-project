/**
 * Order detail page with simplified tracking timeline and "Your case" dispute status.
 *
 * Implements Step 4, Rules 1-3:
 * 1. Header: "Order SIG-A-1001" with amount and status
 * 2. Simplified tracking timeline (dot, line, one line per event, 12px dates)
 * 3. When there is a dispute, a card titled "Your case" with status in StatusBadge
 *    and merchant's latest message.
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton } from '@signoff/ui';
import { fetchOrderDetail } from '../api';
import { useRouter } from '../router';
import { colors, retailTheme } from '../theme';
import type { OrderDetail } from '../types';
import { PayPalResolutionPanel } from './PayPalResolutionPanel';
import { PortalTrackingTimeline } from './PortalTrackingTimeline';

export const OrderDetailPage: React.FC<{ orderCode: string }> = ({ orderCode }) => {
  const { navigate } = useRouter();

  const [email] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryEmail = params.get('email');
      if (queryEmail) return queryEmail;
      return window.sessionStorage.getItem('buyer_portal_email') || 'alex.morgan@example.test';
    } catch {
      return 'alex.morgan@example.test';
    }
  });

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage(null);

    fetchOrderDetail(orderCode, email)
      .then(orderRes => {
        if (!active) return;
        setOrder(orderRes);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setErrorMessage(err.message || 'Order not found with the provided order code and email');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderCode, email]);

  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 16px' }}>
        <Skeleton width="100%" height="240px" />
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
        <div
          data-testid="portal-order-error-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '18px', color: retailTheme.ink, margin: '0 0 8px 0' }}>
            Order Lookup Failed
          </h2>
          <p style={{ color: retailTheme.inkMuted, fontSize: '13px', margin: '0 0 20px 0' }}>
            {errorMessage || 'Order not found'}
          </p>
          <Button variant="primary" onClick={() => navigate('/orders')}>
            ← Back to Order Lookup
          </Button>
        </div>
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
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/orders')}
            style={{
              background: 'none',
              border: 'none',
              color: retailTheme.inkMuted,
              cursor: 'pointer',
              fontSize: '13px',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            ← Back to Order Lookup
          </button>
          <div style={{ fontSize: '12px', color: retailTheme.inkMuted }}>
            Buyer: <strong>{order.customer_email}</strong>
          </div>
        </div>

        {/* Main Order Card */}
        <div
          data-testid="portal-order-summary-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '28px',
            marginBottom: '24px',
          }}
        >
          {/* Header: "Order SIG-A-1001" with amount and status */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: `1px solid ${retailTheme.borderSubtle}`,
            }}
          >
            <div>
              <h1
                data-testid="portal-order-title"
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: '0 0 4px 0',
                  color: retailTheme.ink,
                  fontFamily: retailTheme.serifFont,
                }}
              >
                Order {order.order_code}
              </h1>
              <div style={{ fontSize: '12px', color: retailTheme.inkMuted }}>
                Placed on {new Date(order.created_at).toLocaleDateString()}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                <span
                  data-testid="portal-order-status-badge"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: order.status === 'PAID' || order.status === 'DELIVERED' ? colors.brandPrimary : retailTheme.inkMuted,
                  }}
                >
                  {order.status}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: retailTheme.ink }}>
                <Money money={order.amount} testId="portal-order-total" />
              </div>
            </div>
          </div>

          {/* Ordered items */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: retailTheme.inkMuted, marginBottom: '8px' }}>
              Items
            </div>
            {order.items.map(item => (
              <div
                key={item.sku}
                data-testid={`portal-order-item-${item.sku}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  fontSize: '14px',
                  color: retailTheme.ink,
                }}
              >
                <span>{item.name || item.sku} × {item.quantity}</span>
                <span style={{ fontWeight: 500 }}>
                  <Money money={{ value: item.unit_price, currency_code: 'USD' }} />
                </span>
              </div>
            ))}
          </div>

          {/* Simplified Tracking Timeline */}
          {order.shipment_source === 'simulated' && <section style={{ padding: 14, marginBottom: 16, background: '#ecfdf5', borderRadius: 8, lineHeight: 1.6 }}>
            <strong>Simulated shipment</strong> · No real carrier is contacted.
            {order.shipment_mode === 'missing_tracking' && <p style={{ marginBottom: 0 }}>Tracking is unavailable for this sandbox scenario.</p>}
            {order.shipment_mode === 'exception' && <p style={{ marginBottom: 0 }}>This simulated shipment has an exception. Automatic updates are paused.</p>}
            {order.next_shipping_event_at && <p style={{ marginBottom: 0, fontSize: 13 }}>
              Next simulated update: {new Date(order.next_shipping_event_at).toLocaleString()}
            </p>}
          </section>}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: retailTheme.inkMuted, marginBottom: '12px' }}>
              Shipment Tracking
            </div>
            <PortalTrackingTimeline
              events={order.tracking_events}
              orderStatus={order.status}
            />
          </div>

          <PayPalResolutionPanel />
        </div>
      </div>
    </div>
  );
};
