/**
 * Order lookup page for buyers.
 *
 * Implements Step 32:
 * - Order lookup by code and email
 * - Uniform lookup error messages to prevent enumeration
 * - Fast-fill test buyer helper
 */

import React, { useState } from 'react';
import { Button } from '@signoff/ui';
import { useRouter } from '../router';
import { warmColors, warmShadows } from '../theme';

export const OrderLookupPage: React.FC = () => {
  const { navigate } = useRouter();
  const [orderCode, setOrderCode] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedCode = orderCode.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedCode) {
      setErrorMessage('Please enter your order code.');
      return;
    }
    if (!trimmedEmail) {
      setErrorMessage('Please enter the customer email address.');
      return;
    }

    setSubmitting(true);
    try {
      window.sessionStorage.setItem('buyer_portal_email', trimmedEmail);
    } catch {
      // Storage restricted
    }

    navigate(`/orders/${encodeURIComponent(trimmedCode)}?email=${encodeURIComponent(trimmedEmail)}`);
  };

  const handleFillTestBuyer = () => {
    setEmail('alex.morgan@example.test');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
      <div
        data-testid="portal-lookup-card"
        style={{
          backgroundColor: warmColors.surface,
          borderRadius: '16px',
          border: `1px solid ${warmColors.border}`,
          boxShadow: warmShadows.md,
          padding: '36px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '32px' }}>📦</span>
          <h1
            data-testid="portal-lookup-title"
            style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 6px 0', color: warmColors.ink }}
          >
            Track Order &amp; Buyer Portal
          </h1>
          <p style={{ color: warmColors.inkMuted, fontSize: '14px', margin: 0 }}>
            Enter your order code and email address to view shipping timeline or report an issue.
          </p>
        </div>

        {errorMessage && (
          <div
            data-testid="portal-lookup-error"
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
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="portal-order-code"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: warmColors.ink, marginBottom: '6px' }}
            >
              Order Reference Code
            </label>
            <input
              id="portal-order-code"
              data-testid="portal-order-code-input"
              type="text"
              placeholder="e.g. SIG..."
              value={orderCode}
              onChange={e => setOrderCode(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${warmColors.border}`,
                fontSize: '15px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="portal-customer-email"
                style={{ fontSize: '13px', fontWeight: 600, color: warmColors.ink }}
              >
                Customer Email
              </label>
              <button
                type="button"
                data-testid="portal-fill-test-buyer-btn"
                onClick={handleFillTestBuyer}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '12px',
                  color: warmColors.primary,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Fill test buyer (alex.morgan@example.test)
              </button>
            </div>
            <input
              id="portal-customer-email"
              data-testid="portal-email-input"
              type="email"
              placeholder="alex.morgan@example.test"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${warmColors.border}`,
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            testId="portal-lookup-submit-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? 'Looking up order...' : 'Find Order →'}
          </Button>
        </form>
      </div>
    </div>
  );
};
