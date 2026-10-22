/**
 * Persistent view switcher between Buyer View (fictional storefront & buyer portal)
 * and Merchant View (Signoff dashboard, charter & disputes).
 */

import React, { useState } from 'react';
import { colors, spacing } from '@signoff/ui';

export interface ViewSwitcherProps {
  initialView?: 'buyer' | 'merchant';
  onViewChange?: (view: 'buyer' | 'merchant') => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  initialView = 'merchant',
  onViewChange,
}) => {
  const [view, setView] = useState<'buyer' | 'merchant'>(initialView);

  const shopBaseUrl = import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174';

  const handleSwitch = (newView: 'buyer' | 'merchant') => {
    setView(newView);
    onViewChange?.(newView);
  };

  return (
    <nav
      aria-label="Audience View Switcher"
      data-testid="view-switcher"
      style={{
        backgroundColor: colors.surfaceSubtle,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: spacing[1],
        marginBottom: spacing[2],
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[1],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.ink }}>
            Active Perspective:
          </span>
          <div role="tablist" style={{ display: 'inline-flex', gap: '4px' }}>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'merchant'}
              data-testid="view-switcher-merchant-tab"
              onClick={() => handleSwitch('merchant')}
              style={{
                backgroundColor: view === 'merchant' ? colors.brandPrimary : 'transparent',
                color: view === 'merchant' ? '#ffffff' : colors.ink,
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Merchant View
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'buyer'}
              data-testid="view-switcher-buyer-tab"
              onClick={() => handleSwitch('buyer')}
              style={{
                backgroundColor: view === 'buyer' ? '#b45309' : 'transparent',
                color: view === 'buyer' ? '#ffffff' : colors.ink,
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Buyer View
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing[1] }}>
          {view === 'merchant' ? (
            <>
              <span style={{ fontSize: '12px', color: colors.inkMuted }}>Merchant Quick Links:</span>
              <a
                href="/app"
                data-testid="view-link-merchant-dashboard"
                style={{
                  fontSize: '12px',
                  color: colors.brandPrimary,
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Dashboard
              </a>
              <span style={{ color: colors.borderStrong }}>•</span>
              <a
                href="/app/disputes"
                data-testid="view-link-merchant-disputes"
                style={{
                  fontSize: '12px',
                  color: colors.brandPrimary,
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Disputes
              </a>
              <span style={{ color: colors.borderStrong }}>•</span>
              <a
                href="/app/charter"
                data-testid="view-link-merchant-charter"
                style={{
                  fontSize: '12px',
                  color: colors.brandPrimary,
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Charter
              </a>
              <span style={{ color: colors.borderStrong }}>•</span>
              <a
                href="/app/demo"
                data-testid="view-link-merchant-demo"
                style={{
                  fontSize: '12px',
                  color: colors.brandPrimary,
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Demo Panel
              </a>
            </>
          ) : (
            <>
              <span style={{ fontSize: '12px', color: '#92400e' }}>Buyer Quick Links:</span>
              <a
                href={`${shopBaseUrl}/`}
                target="_blank"
                rel="noreferrer"
                data-testid="view-link-buyer-shop"
                style={{
                  fontSize: '12px',
                  color: '#b45309',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Storefront ↗
              </a>
              <span style={{ color: colors.borderStrong }}>•</span>
              <a
                href={`${shopBaseUrl}/cart`}
                target="_blank"
                rel="noreferrer"
                data-testid="view-link-buyer-cart"
                style={{
                  fontSize: '12px',
                  color: '#b45309',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Cart ↗
              </a>
              <span style={{ color: colors.borderStrong }}>•</span>
              <a
                href={`${shopBaseUrl}/orders`}
                target="_blank"
                rel="noreferrer"
                data-testid="view-link-buyer-portal"
                style={{
                  fontSize: '12px',
                  color: '#b45309',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Buyer Portal ↗
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
