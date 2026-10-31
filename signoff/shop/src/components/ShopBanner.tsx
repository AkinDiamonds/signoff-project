/**
 * Persistent quiet sandbox banner for the storefront.
 *
 * Implements Step 2, Rule 4:
 * "A persistent, quiet sandbox banner at the top: 'Demo store. Payments use the PayPal sandbox.
 * No real money moves.' 12px, secondary, no dismiss button."
 */

import React, { useState } from 'react';
import { colors, retailTheme } from '../theme';

export const ShopBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const signoffBaseUrl = import.meta.env.PUBLIC_SIGNOFF_URL ?? '';

  return (
    <aside
      role="status"
      data-testid="shop-banner"
      style={{
        backgroundColor: retailTheme.surfaceWarm,
        borderBottom: `1px solid ${retailTheme.borderSubtle}`,
        color: retailTheme.inkMuted,
        fontSize: '12px',
        lineHeight: 1.5,
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '6px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: colors.brandPrimary,
            }}
          />
          <span data-testid="shop-banner-text" style={{ color: retailTheme.inkMuted }}>
            Demo store. Payments use the PayPal sandbox. No real money moves.
          </span>
          <span style={{ color: colors.border }}>·</span>
          <button
            type="button"
            data-testid="shop-banner-how-to-pay-toggle"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: retailTheme.inkMuted,
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            aria-expanded={isOpen}
          >
            {isOpen ? 'Hide sandbox details' : 'Sandbox details'}
          </button>
        </div>

        <nav
          aria-label="Demo environment links"
          style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}
        >
          <a
            href={`${signoffBaseUrl}/guide`}
            data-testid="shop-guide-link"
            style={{
              color: retailTheme.inkMuted,
              textDecoration: 'underline',
            }}
          >
            Sandbox Guide ↗
          </a>
          <a
            href={`${signoffBaseUrl}/app`}
            data-testid="shop-dashboard-link"
            style={{
              color: retailTheme.inkMuted,
              textDecoration: 'underline',
            }}
          >
            Signoff Dashboard ↗
          </a>
        </nav>
      </div>

      {isOpen && (
        <div
          data-testid="shop-banner-how-to-pay-content"
          style={{
            backgroundColor: '#FFFFFF',
            borderTop: `1px solid ${retailTheme.borderSubtle}`,
            padding: '12px 16px',
            fontSize: '12px',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ fontWeight: 600, color: retailTheme.ink, marginBottom: '4px' }}>
              PayPal Sandbox Checkout
            </div>
            <p style={{ margin: '0 0 6px 0', color: retailTheme.inkMuted }}>
              Sign in on PayPal using your sandbox buyer account to approve the payment.
            </p>
            <div style={{ color: retailTheme.inkMuted }}>
              Report payment problems separately in PayPal’s Resolution Center. Shipping on this store is simulated.
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
