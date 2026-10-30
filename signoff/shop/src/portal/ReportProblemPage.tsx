/**
 * "Report a Problem" dispute creation form.
 *
 * Implements Step 4, Rule 4:
 * - A single form, three reasons only (item not received, not as described, other)
 * - Amount field pre-filled with order total
 * - Message box and submit button
 * - Helper text explains: "In this demo the case is opened for you."
 * - Escaped plain text transmission
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton } from '@signoff/ui';
import { fetchOrderDetail } from '../api';
import { DemoOrderShortcut } from '../components/DemoOrderShortcut';
import { useRouter } from '../router';
import { retailTheme } from '../theme';
import type { OrderDetail } from '../types';
import { createDispute, fetchOrderDisputeStatus } from './portalApi';
import {
  SUPPORTED_REASON_LABELS,
  isSupportedDisputeReason,
  type OrderDisputeStatus,
  type SupportedDisputeReason,
} from './types';

export const ReportProblemPage: React.FC<{ orderCode: string }> = ({ orderCode }) => {
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
  const [disputeStatus, setDisputeStatus] = useState<OrderDisputeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [reason, setReason] = useState<SupportedDisputeReason>(
    'MERCHANDISE_OR_SERVICE_NOT_RECEIVED'
  );
  const [amountStr, setAmountStr] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      fetchOrderDetail(orderCode, email),
      fetchOrderDisputeStatus(orderCode, email).catch(() => null),
    ])
      .then(([orderRes, statusRes]) => {
        if (!active) return;
        setOrder(orderRes);
        setDisputeStatus(statusRes);
        setAmountStr(orderRes.amount.value);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setFormError(err.message || 'Order not found with the provided credentials');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderCode, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!order) return;

    // Amount validation
    const parsedAmount = parseFloat(amountStr);
    const maxAmount = parseFloat(order.amount.value);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid dispute amount greater than zero.');
      return;
    }
    if (parsedAmount > maxAmount) {
      setFormError(
        `Dispute amount cannot exceed the total order amount of $${maxAmount.toFixed(2)}.`
      );
      return;
    }

    // Decimal places check
    const decimals = amountStr.split('.')[1];
    if (decimals && decimals.length > 2) {
      setFormError('Dispute amount cannot have more than two decimal places.');
      return;
    }

    // Message validation
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      setFormError('Please enter a description of the problem.');
      return;
    }
    if (cleanMsg.length > 2000) {
      setFormError('Message cannot exceed 2000 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await createDispute(orderCode, {
        customer_email: order.customer_email,
        reason,
        amount: {
          value: parsedAmount.toFixed(2),
          currency_code: order.amount.currency_code,
        },
        message: cleanMsg,
      });

      navigate(
        `/orders/${encodeURIComponent(orderCode)}/dispute?email=${encodeURIComponent(
          order.customer_email
        )}`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to file dispute. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
        <Skeleton width="100%" height="320px" />
      </div>
    );
  }

  // Duplicate dispute guard
  if (disputeStatus?.dispute_exists) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
        <div
          data-testid="portal-duplicate-dispute-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '36px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '20px', color: retailTheme.ink, margin: '0 0 8px 0' }}>
            Dispute Already Filed
          </h2>
          <p style={{ color: retailTheme.inkMuted, fontSize: '14px', margin: '0 0 24px 0' }}>
            A case has already been opened for this order ({disputeStatus.dispute?.id}).
          </p>
          <Button
            variant="primary"
            onClick={() =>
              navigate(`/orders/${orderCode}/dispute?email=${encodeURIComponent(email)}`)
            }
            testId="portal-view-existing-dispute-btn"
          >
            View Case →
          </Button>
        </div>
      </div>
    );
  }

  // Ineligible account guard
  if (disputeStatus && !disputeStatus.dispute_eligible) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
        <div
          data-testid="portal-ineligible-dispute-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '36px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '20px', color: retailTheme.ink, margin: '0 0 8px 0' }}>
            Dispute Creation Restricted
          </h2>
          <p style={{ color: retailTheme.inkMuted, fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            {disputeStatus.ineligibility_reason}
          </p>
          <DemoOrderShortcut
            variant="primary"
            label="⚡ Use Demo Order Instead"
            testId="portal-ineligible-demo-order-btn"
          />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
        <p style={{ color: retailTheme.inkMuted }}>Order details could not be loaded.</p>
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
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(`/orders/${orderCode}?email=${encodeURIComponent(email)}`)}
          style={{
            background: 'none',
            border: 'none',
            color: retailTheme.inkMuted,
            cursor: 'pointer',
            fontSize: '13px',
            textDecoration: 'underline',
            padding: 0,
            marginBottom: '20px',
          }}
        >
          ← Back to Order {orderCode}
        </button>

        <div
          data-testid="portal-report-problem-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: retailTheme.cardShadow,
            padding: '32px',
          }}
        >
          <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${retailTheme.borderSubtle}` }}>
            <h1
              data-testid="portal-report-title"
              style={{
                fontSize: '20px',
                fontWeight: 700,
                margin: '0 0 6px 0',
                color: retailTheme.ink,
                fontFamily: retailTheme.serifFont,
              }}
            >
              Report a Problem · Order {orderCode}
            </h1>
            <div style={{ fontSize: '13px', color: retailTheme.inkMuted }}>
              Order Total: <Money money={order.amount} /> · Buyer: {order.customer_email}
            </div>
            {/* Helper text explaining that in the real flow PayPal opens the case */}
            <p
              style={{
                marginTop: '10px',
                marginBottom: 0,
                fontSize: '12px',
                color: retailTheme.inkMuted,
                backgroundColor: retailTheme.surfaceWarm,
                padding: '8px 12px',
                borderRadius: '6px',
              }}
            >
              In this demo the case is opened for you. In production, PayPal opens and manages the dispute.
            </p>
          </div>

          {formError && (
            <div
              data-testid="portal-form-error"
              style={{
                padding: '10px 14px',
                backgroundColor: '#FEF2F2',
                borderRadius: '6px',
                color: '#991B1B',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Three reasons only */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="portal-reason-select"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: retailTheme.ink, marginBottom: '6px' }}
              >
                Reason
              </label>
              <select
                id="portal-reason-select"
                data-testid="portal-reason-select"
                value={reason}
                onChange={e => {
                  const value = e.target.value;
                  if (isSupportedDisputeReason(value)) {
                    setReason(value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${retailTheme.borderSubtle}`,
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                  color: retailTheme.ink,
                  boxSizing: 'border-box',
                }}
              >
                <option value="MERCHANDISE_OR_SERVICE_NOT_RECEIVED">
                  {SUPPORTED_REASON_LABELS.MERCHANDISE_OR_SERVICE_NOT_RECEIVED}
                </option>
                <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">
                  {SUPPORTED_REASON_LABELS.MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED}
                </option>
                <option value="OTHER">
                  {SUPPORTED_REASON_LABELS.OTHER}
                </option>
              </select>
            </div>

            {/* Amount input pre-filled with order total */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="portal-amount-input"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: retailTheme.ink, marginBottom: '6px' }}
              >
                Amount (USD, up to ${order.amount.value})
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 600,
                    color: retailTheme.inkMuted,
                    fontSize: '13px',
                  }}
                >
                  $
                </span>
                <input
                  id="portal-amount-input"
                  data-testid="portal-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={order.amount.value}
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 26px',
                    borderRadius: '8px',
                    border: `1px solid ${retailTheme.borderSubtle}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Message input */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label
                  htmlFor="portal-message-input"
                  style={{ fontSize: '13px', fontWeight: 600, color: retailTheme.ink }}
                >
                  Message
                </label>
                <span style={{ fontSize: '12px', color: retailTheme.inkMuted }}>
                  {message.length} / 2000
                </span>
              </div>
              <textarea
                id="portal-message-input"
                data-testid="portal-message-input"
                rows={4}
                maxLength={2000}
                placeholder="Explain the issue with your order..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${retailTheme.borderSubtle}`,
                  fontSize: '13px',
                  fontFamily: retailTheme.fontFamily,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              testId="portal-submit-dispute-btn"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Submitting…' : 'Submit Problem Report'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
