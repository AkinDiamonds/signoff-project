/**
 * "Report a Problem" dispute creation form.
 *
 * Implements Step 32:
 * - Supported reasons only (not-received, not-as-described)
 * - Amount validated up to order total with Money type
 * - Message length validation and safe plain-text transmission
 * - Double-submit prevention and duplicate dispute blocking
 * - Unlinked buyer account guard with demo-order alternative
 */

import React, { useEffect, useState } from 'react';
import { Button, Money, Skeleton } from '@signoff/ui';
import { fetchOrderDetail } from '../api';
import { DemoOrderShortcut } from '../components/DemoOrderShortcut';
import { useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';
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

      // Navigate to dispute view
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
      <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 16px' }}>
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
            backgroundColor: warmColors.surface,
            borderRadius: '16px',
            border: `1px solid ${warmColors.border}`,
            padding: '36px',
            textAlign: 'center',
            boxShadow: warmShadows.md,
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>ℹ️</div>
          <h2 style={{ fontSize: '20px', color: warmColors.ink, margin: '0 0 8px 0' }}>
            Dispute Already Filed
          </h2>
          <p style={{ color: warmColors.inkMuted, fontSize: '14px', margin: '0 0 24px 0' }}>
            A dispute has already been opened for this order ({disputeStatus.dispute?.id}). Duplicate
            disputes for the same transaction are prohibited.
          </p>
          <Button
            variant="primary"
            onClick={() =>
              navigate(
                `/orders/${orderCode}/dispute?email=${encodeURIComponent(email)}`
              )
            }
            testId="portal-view-existing-dispute-btn"
          >
            View Existing Dispute →
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
            backgroundColor: warmColors.surface,
            borderRadius: '16px',
            border: '1px solid #fde68a',
            padding: '36px',
            boxShadow: warmShadows.md,
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', color: '#92400e', margin: '0 0 8px 0' }}>
            Dispute Creation Restricted
          </h2>
          <p style={{ color: '#b45309', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
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
        <p style={{ color: '#b91c1c' }}>Order details could not be loaded.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 16px' }}>
      <button
        type="button"
        onClick={() => navigate(`/orders/${orderCode}?email=${encodeURIComponent(email)}`)}
        style={{
          background: 'none',
          border: 'none',
          color: warmColors.primary,
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          padding: 0,
          marginBottom: '20px',
        }}
      >
        ← Back to Order {orderCode}
      </button>

      <div
        data-testid="portal-report-problem-card"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.md,
          padding: '36px',
        }}
      >
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${warmColors.borderMuted}` }}>
          <h1
            data-testid="portal-report-title"
            style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0', color: warmColors.ink }}
          >
            Report a Problem · Order {orderCode}
          </h1>
          <div style={{ fontSize: '13px', color: warmColors.inkMuted }}>
            Total Order Amount: <Money money={order.amount} /> · Payer: {order.customer_email}
          </div>
        </div>

        {formError && (
          <div
            data-testid="portal-form-error"
            style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '14px',
              marginBottom: '20px',
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Supported Reasons Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="portal-reason-select"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: warmColors.ink, marginBottom: '6px' }}
            >
              Reason for Dispute
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
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${warmColors.border}`,
                fontSize: '14px',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              <option value="MERCHANDISE_OR_SERVICE_NOT_RECEIVED">
                {SUPPORTED_REASON_LABELS.MERCHANDISE_OR_SERVICE_NOT_RECEIVED}
              </option>
              <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">
                {SUPPORTED_REASON_LABELS.MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED}
              </option>
            </select>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="portal-amount-input"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: warmColors.ink, marginBottom: '6px' }}
            >
              Dispute Amount (USD, max ${order.amount.value})
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 600,
                  color: warmColors.inkMuted,
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
                  padding: '10px 14px 10px 30px',
                  borderRadius: '8px',
                  border: `1px solid ${warmColors.border}`,
                  fontSize: '15px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: warmColors.inkMuted, marginTop: '4px' }}>
              You may claim up to the full order total of ${order.amount.value}.
            </div>
          </div>

          {/* Message input */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                htmlFor="portal-message-input"
                style={{ fontSize: '13px', fontWeight: 600, color: warmColors.ink }}
              >
                Detailed Message for Merchant
              </label>
              <span style={{ fontSize: '12px', color: warmColors.inkMuted }}>
                {message.length} / 2000 chars
              </span>
            </div>
            <textarea
              id="portal-message-input"
              data-testid="portal-message-input"
              rows={5}
              maxLength={2000}
              placeholder="Describe what went wrong with your order..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: `1px solid ${warmColors.border}`,
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: '12px', color: warmColors.inkMuted, marginTop: '4px' }}>
              Note: This message will be formally submitted to PayPal and transmitted to the merchant.
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            testId="portal-submit-dispute-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? 'Submitting Dispute...' : 'File PayPal Dispute →'}
          </Button>
        </form>
      </div>
    </div>
  );
};
