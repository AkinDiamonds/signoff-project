import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  Banner,
  ThemePickerSheet,
  ThemeToggleButton,
  colors,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import { ErrorBoundary } from './ErrorBoundary';

const NAV_ITEMS = [
  { to: '/app', label: 'Home' },
  { to: '/app/disputes', label: 'Disputes' },
  { to: '/app/pool', label: 'Demo disputes' },
  { to: '/app/charter', label: 'Charter' },
  { to: '/app/demo', label: 'Demo' },
  { to: '/guide', label: 'Guide' },
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
            backgroundColor: 'var(--signoff-app-bg, #F1F1F1)',
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
        backgroundColor: 'var(--signoff-app-bg, #F1F1F1)',
        color: 'var(--signoff-text-primary, #303030)',
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
          height: 32px;
          padding: 0 8px;
          border-radius: ${radius.control};
          font-size: ${typography.fontSizeBody};
          line-height: 20px;
          color: var(--signoff-sidebar-text, #303030);
          text-decoration: none;
          position: relative;
          transition: background-color 0.1s ease;
        }
        .signoff-nav-link:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        .signoff-nav-link.active {
          background-color: rgba(0, 0, 0, 0.08);
          font-weight: 600;
        }
        .signoff-nav-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 3px;
          border-radius: 2px;
          background-color: var(--signoff-nav-accent, #0F766E);
        }
        @media (max-width: 899px) {
          .signoff-sidebar-desktop {
            display: none !important;
          }
          .signoff-menu-toggle {
            display: flex !important;
          }
        }
        @media (min-width: 900px) {
          .signoff-menu-toggle {
            display: none !important;
          }
          .signoff-sidebar-mobile {
            display: none !important;
          }
        }
      `}</style>

      <a href="#main-content" className="signoff-skip-link">
        Skip to main content
      </a>

      <Banner variant="sandbox" testId="banner-sandbox" />

      {/* 56px Top Bar */}
      <header
        data-testid="shell-topbar"
        style={{
          height: '56px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--signoff-topbar, #FFFFFF)',
          color: 'var(--signoff-topbar-text, #303030)',
          borderBottom: '1px solid var(--signoff-border, #E1E1E1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${spacing[2]}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1.5] }}>
          {/* Hamburger button for mobile */}
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
              color: 'var(--signoff-topbar-text, #303030)',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Signoff wordmark */}
          <NavLink
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: typography.fontWeightSemibold,
                letterSpacing: '-0.01em',
              }}
            >
              Signoff
            </span>
          </NavLink>

          {/* Sandbox demo chip */}
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: 'rgba(0, 0, 0, 0.06)',
              color: 'inherit',
              padding: '2px 6px',
              borderRadius: radius.control,
            }}
          >
            Sandbox demo
          </span>
        </div>

        {/* Right side: Store name + Theme icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1.5] }}>
          <span
            style={{
              fontSize: typography.fontSizeBody,
              fontWeight: typography.fontWeightMedium,
              color: 'var(--signoff-topbar-text, #303030)',
            }}
          >
            My Store
          </span>
          <ThemeToggleButton />
        </div>
      </header>

      {/* Main app body: Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Desktop Sidebar (240px) */}
        <aside
          data-testid="shell-sidebar"
          className="signoff-sidebar-desktop"
          style={{
            width: '240px',
            backgroundColor: 'var(--signoff-sidebar, #FFFFFF)',
            borderRight: '1px solid var(--signoff-border, #E1E1E1)',
            padding: `${spacing[2]} ${spacing[1]}`,
            boxSizing: 'border-box',
            flexShrink: 0,
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <nav aria-label="Main">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/app' || item.to === '/'}
                    className={({ isActive }) => `signoff-nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Mobile Slide-over Sidebar */}
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
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
              }}
              onClick={() => setMobileNavOpen(false)}
            />
            <aside
              style={{
                position: 'relative',
                width: '240px',
                backgroundColor: 'var(--signoff-sidebar, #FFFFFF)',
                borderRight: '1px solid var(--signoff-border, #E1E1E1)',
                padding: `${spacing[2]} ${spacing[1]}`,
                zIndex: 901,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <nav aria-label="Main">
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {NAV_ITEMS.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setMobileNavOpen(false)}
                        end={item.to === '/app' || item.to === '/'}
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

        {/* Main Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            maxWidth: '1200px',
            margin: '0 auto',
            padding: spacing[4],
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
