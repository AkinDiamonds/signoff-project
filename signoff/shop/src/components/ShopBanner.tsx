/**
 * Persistent storefront banner with sandbox indicators, collapsible how-to-pay instructions,
 * public test buyer credentials, and navigation links to the Signoff dashboard and judge guide.
 */

import React, { useState } from 'react';
import { warmColors } from '../theme';

export const ShopBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const signoffBaseUrl = import.meta.env.PUBLIC_SIGNOFF_URL ?? '';

  return (
    <aside
      role="status"
      data-testid="shop-banner"
      style={{
        backgroundColor: '#fffbeb', // Amber-50
        borderBottom: '1px solid #fde68a', // Amber-200
        color: '#92400e', // Amber-900
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '8px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#d97706',
            }}
          />
          <strong data-testid="shop-banner-text">
            Fictional shop · PayPal sandbox
          </strong>
          <span style={{ color: '#b45309' }}>|</span>
          <button
            type="button"
            data-testid="shop-banner-how-to-pay-toggle"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#b45309',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
            aria-expanded={isOpen}
          >
            {isOpen ? 'Hide sandbox payment details ▲' : 'How to pay in sandbox ▼'}
          </button>
        </div>

        <nav
          aria-label="Demo environment links"
          style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
        >
          <a
            href={`${signoffBaseUrl}/guide`}
            data-testid="shop-guide-link"
            style={{
              color: '#92400e',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Judge Guide ↗
          </a>
          <a
            href={`${signoffBaseUrl}/app`}
            data-testid="shop-dashboard-link"
            style={{
              color: '#92400e',
              textDecoration: 'none',
              fontWeight: 500,
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
            backgroundColor: '#fef3c7', // Amber-100
            borderTop: '1px solid #fde68a',
            padding: '12px 16px',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#78350f' }}>
              Sandbox Testing Instructions
            </h4>
            <p style={{ margin: '0 0 8px 0', color: '#92400e' }}>
              This is a demonstration storefront connected to the PayPal sandbox environment. No real funds are ever charged or transferred.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #fde68a',
                }}
              >
                <div style={{ fontWeight: 600, color: '#78350f', marginBottom: '4px' }}>
                  Public Test Buyer
                </div>
                <div style={{ fontSize: '12px', color: warmColors.ink }}>
                  <div>Email: <code data-testid="shop-buyer-email">alex.morgan@example.test</code></div>
                  <div style={{ marginTop: '2px', color: warmColors.inkMuted }}>
                    Or log in with your own PayPal Sandbox Personal account.
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #fde68a',
                }}
              >
                <div style={{ fontWeight: 600, color: '#78350f', marginBottom: '4px' }}>
                  Fast-Track Evaluation
                </div>
                <div style={{ fontSize: '12px', color: warmColors.ink }}>
                  Judges can use the <strong>&quot;Use a demo order&quot;</strong> button in the cart or navigation to instantly claim an already-paid order without navigating PayPal popups.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
