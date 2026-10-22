/**
 * Order detail page with mock tracking timeline and dispute actions.
 *
 * Implements Step 32:
 * - Order detail and mock tracking timeline
 * - Uniform lookup errors
 * - Dispute eligibility checks (unlinked account disabled with explanation and demo order alternative)
 * - Existing dispute detection with direct link
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton } from '@signoff/ui';
import { fetchOrderDetail } from '../api';
import { DemoOrderShortcut } from '../components/DemoOrderShortcut';
import { useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';
import type { OrderDetail } from '../types';
import { fetchOrderDisputeStatus } from './portalApi';
import { PortalTrackingTimeline } from './PortalTrackingTimeline';
import type { OrderDisputeStatus } from './types';

export const OrderDetailPage: React.FC<{ orderCode: string }> = ({ orderCode }) => {
  const { navigate } = useRouter();

  // Resolve email from query parameter or session storage or fallback
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
  const [disputeStatus, setDisputeStatus] = useState<OrderDisputeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage(null);

    Promise.all([
      fetchOrderDetail(orderCode, email),
      fetchOrderDisputeStatus(orderCode, email).catch(() => null),
    ])
      .then(([orderRes, disputeRes]) => {
        if (!active) return;
        setOrder(orderRes);
        setDisputeStatus(disputeRes);
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
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
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
            backgroundColor: warmColors.surface,
            borderRadius: '16px',
            border: `1px solid ${warmColors.border}`,
            boxShadow: warmShadows.md,
            padding: '36px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', color: warmColors.ink, margin: '0 0 8px 0' }}>
            Order Lookup Failed
          </h2>
          <p
            data-testid="portal-error-message"
            style={{ color: warmColors.inkMuted, fontSize: '14px', margin: '0 0 24px 0' }}
          >
            {errorMessage || 'Order not found with the provided order code and email'}
          </p>
          <Button variant="primary" onClick={() => navigate('/orders')} testId="portal-retry-lookup-btn">
            ← Try Another Lookup
          </Button>
        </div>
      </div>
    );
  }

  const hasExistingDispute = disputeStatus?.dispute_exists;

  return (
    <div style={{ maxWidth: '840px', margin: '40px auto', padding: '0 16px' }}>
      {/* Navigation header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          style={{
            background: 'none',
            border: 'none',
            color: warmColors.primary,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            padding: 0,
          }}
        >
          ← Back to Order Lookup
        </button>
        <div style={{ fontSize: '13px', color: warmColors.inkMuted }}>
          Customer: <strong>{order.customer_email}</strong>
        </div>
      </div>

      {/* Existing Dispute Notification Banner */}
      {hasExistingDispute && disputeStatus?.dispute && (
        <div
          data-testid="portal-existing-dispute-banner"
          style={{
            backgroundColor: '#eff6ff', // Blue-50
            border: '1px solid #bfdbfe', // Blue-200
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '14px' }}>
              Active Dispute on this Order ({disputeStatus.dispute.id})
            </div>
            <div style={{ fontSize: '13px', color: '#1e3a8a', marginTop: '2px' }}>
              Status: <strong>{disputeStatus.dispute.status}</strong> · Disputed Amount:{' '}
              <Money money={disputeStatus.dispute.amount} testId="portal-banner-dispute-amount" />
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate(`/orders/${order.order_code}/dispute?email=${encodeURIComponent(order.customer_email)}`)}
            testId="portal-view-existing-dispute-btn"
          >
            View Dispute &amp; Messages →
          </Button>
        </div>
      )}

      {/* Main Order Card */}
      <div
        data-testid="portal-order-summary-card"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.sm,
          padding: '28px',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${warmColors.borderMuted}`,
          }}
        >
          <div>
            <h1
              data-testid="portal-order-title"
              style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', color: warmColors.ink }}
            >
              Order {order.order_code}
            </h1>
            <div style={{ fontSize: '13px', color: warmColors.inkMuted }}>
              Placed on {new Date(order.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              data-testid="portal-order-status-badge"
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: order.status === 'PAID' || order.status === 'DELIVERED' ? warmColors.successBg : warmColors.surfaceMuted,
                color: order.status === 'PAID' || order.status === 'DELIVERED' ? warmColors.successInk : warmColors.ink,
                border: `1px solid ${order.status === 'PAID' || order.status === 'DELIVERED' ? warmColors.successBorder : warmColors.border}`,
              }}
            >
              {order.status}
            </span>
            <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 700, color: warmColors.accent }}>
              <Money money={order.amount} testId="portal-order-total" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: warmColors.inkMuted, marginBottom: '8px' }}>
            Ordered Items:
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
                color: warmColors.ink,
              }}
            >
              <span>{item.name || item.sku} × {item.quantity}</span>
              <span style={{ fontWeight: 500 }}>
                <Money money={{ value: item.unit_price, currency_code: 'USD' }} />
              </span>
            </div>
          ))}
        </div>

        {/* Tracking Timeline */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: warmColors.ink, marginBottom: '12px' }}>
            Shipment Timeline
          </div>
          <PortalTrackingTimeline
            events={order.tracking_events}
            orderStatus={order.status}
          />
        </div>

        {/* Action / Report problem section */}
        <div
          data-testid="portal-problem-section"
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: `1px solid ${warmColors.border}`,
          }}
        >
          {hasExistingDispute ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: warmColors.inkMuted }}>
                Need to reply to the merchant or check dispute updates?
              </div>
              <Button
                variant="primary"
                onClick={() => navigate(`/orders/${order.order_code}/dispute?email=${encodeURIComponent(order.customer_email)}`)}
                testId="portal-dispute-view-btn"
              >
                Go to Dispute Details →
              </Button>
            </div>
          ) : disputeStatus?.dispute_eligible ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: warmColors.ink }}>
                  Having an issue with this shipment?
                </div>
                <div style={{ fontSize: '13px', color: warmColors.inkMuted }}>
                  You can file a formal dispute with PayPal if items are missing or not as described.
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/orders/${order.order_code}/dispute/new?email=${encodeURIComponent(order.customer_email)}`)}
                testId="portal-report-problem-btn"
              >
                ⚠️ Report a Problem
              </Button>
            </div>
          ) : (
            <div
              data-testid="portal-dispute-disabled-banner"
              style={{
                backgroundColor: '#fffbeb', // Amber-50
                border: '1px solid #fde68a', // Amber-200
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ fontWeight: 600, color: '#92400e', fontSize: '14px', marginBottom: '4px' }}>
                Dispute Creation Unavailable
              </div>
              <div style={{ fontSize: '13px', color: '#b45309', lineHeight: 1.5, marginBottom: '12px' }}>
                {disputeStatus?.ineligibility_reason ||
                  'This order is not eligible for API dispute filing.'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <DemoOrderShortcut
                  variant="primary"
                  label="⚡ Claim a Demo Order for Dispute Testing"
                  testId="portal-dispute-demo-order-btn"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
