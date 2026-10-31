import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  Banner,
  ThemePickerSheet,
  ThemeToggleButton,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import { ErrorBoundary } from './ErrorBoundary';

const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard' },
  { to: '/app/disputes', label: 'Disputes' },
  { to: '/app/shipments', label: 'Shipments' },
  { to: '/app/policy', label: 'Policy Rules' },
  { to: '/app/settings', label: 'Settings' },
];

export const Layout: React.FC = () => {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isApproval = location.pathname.startsWith('/approve/');

  // Approval page is mobile-first standalone without sidebar
  if (isApproval) {
    return (
      <>
        <Banner variant="sandbox" testId="banner-sandbox" />
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            minHeight: '100vh',
            backgroundColor: 'var(--signoff-app-bg, #F8F9FA)',
            padding: spacing[2],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <ThemePickerSheet />
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: typography.fontFamily,
        backgroundColor: 'var(--signoff-app-bg, #F8F9FA)',
        color: 'var(--signoff-text-primary, #1A1F2C)',
      }}
    >
      <style>{`
        :focus-visible {
          outline: 2px solid var(--signoff-nav-accent, #0F766E) !important;
          outline-offset: 2px !important;
        }
        .signoff-skip-link {
          position: absolute;
          left: 8px;
          top: -100px;
          background: #ffffff;
          padding: 8px 16px;
          border-radius: 6px;
          z-index: 10000;
          color: #111;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .signoff-skip-link:focus {
          top: 8px;
        }
        .signoff-nav-link {
          display: flex;
          align-items: center;
          height: 36px;
          padding: 0 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #4B5563;
          text-decoration: none;
          position: relative;
          transition: background-color 0.1s ease, color 0.1s ease;
        }
        .signoff-nav-link:hover {
          background-color: rgba(0, 0, 0, 0.04);
          color: #111827;
        }
        .signoff-nav-link.active {
          background-color: #F0FDFA;
          color: #0F766E;
          font-weight: 600;
        }
        .signoff-nav-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          border-radius: 2px;
          background-color: #0F766E;
        }
        @media (max-width: 899px) {
          .signoff-sidebar-desktop {
            display: none !important;
          }
          .signoff-menu-toggle {
            display: flex !important;
          }
          .signoff-main-wrapper {
            margin-left: 0 !important;
            padding: 16px !important;
          }
        }
        @media (min-width: 900px) {
          .signoff-menu-toggle {
            display: none !important;
          }
          .signoff-sidebar-mobile {
            display: none !important;
          }
          .signoff-main-wrapper {
            margin-left: 240px !important;
            padding: 24px 32px !important;
          }
        }
      `}</style>

      <a href="#main-content" className="signoff-skip-link">
        Skip to main content
      </a>

      <Banner variant="sandbox" testId="banner-sandbox" />

      {/* 56px Top Header Bar */}
      <header
        data-testid="shell-topbar"
        style={{
          height: '56px',
          boxSizing: 'border-box',
          backgroundColor: '#FFFFFF',
          color: '#111827',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${spacing[3]}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {/* Mobile hamburger */}
          <button
            type="button"
            className="signoff-menu-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: radius.control,
              color: '#374151',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Signoff Wordmark */}
          <NavLink
            to="/app"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              S
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>
              Signoff
            </span>
          </NavLink>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: '#F3F4F6',
              color: '#4B5563',
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid #E5E7EB',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            Live Sync
          </span>
        </div>

        {/* Right side header controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
            }}
          >
            Signoff Shop
          </span>
          <ThemeToggleButton />
        </div>
      </header>

      {/* Main Body Layout */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Desktop Fixed Sidebar (240px wide, pinned to full viewport height) */}
        <aside
          data-testid="shell-sidebar"
          className="signoff-sidebar-desktop"
          style={{
            position: 'fixed',
            top: '56px',
            bottom: 0,
            left: 0,
            width: '240px',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E5E7EB',
            padding: `${spacing[3]} ${spacing[2]}`,
            boxSizing: 'border-box',
            overflowY: 'auto',
            zIndex: 40,
          }}
        >
          <nav aria-label="Main">
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px 8px' }}>
              Merchant Workspace
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/app'}
                    className={({ isActive }) => `signoff-nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px 8px' }}>
                Storefront
              </div>
              <a
                href={import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174'}
                target="_blank"
                rel="noreferrer"
                className="signoff-nav-link"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>Buyer Shop ↗</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>:5174</span>
              </a>
            </div>
          </nav>
        </aside>

        {/* Mobile Slide-over Drawer */}
        {mobileNavOpen && (
          <div
            className="signoff-sidebar-mobile"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              display: 'flex',
            }}
          >
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(2px)',
              }}
              onClick={() => setMobileNavOpen(false)}
            />
            <aside
              style={{
                position: 'relative',
                width: '260px',
                height: '100%',
                backgroundColor: '#FFFFFF',
                borderRight: '1px solid #E5E7EB',
                padding: `${spacing[3]} ${spacing[2]}`,
                zIndex: 901,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing[2],
                boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Navigation</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6B7280' }}
                >
                  &times;
                </button>
              </div>
              <nav aria-label="Main">
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {NAV_ITEMS.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setMobileNavOpen(false)}
                        end={item.to === '/app'}
                        className={({ isActive }) => `signoff-nav-link ${isActive ? 'active' : ''}`}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Area - scrolls independently */}
        <main
          id="main-content"
          tabIndex={-1}
          className="signoff-main-wrapper"
          style={{
            flex: 1,
            minHeight: 'calc(100vh - 56px)',
            boxSizing: 'border-box',
            outline: 'none',
            width: '100%',
          }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <ThemePickerSheet />
    </div>
  );
};
