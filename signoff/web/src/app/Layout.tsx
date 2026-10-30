import React from 'react';
import { NavLink, Outlet } from 'react-router';
import { Banner, colors, spacing } from '@signoff/ui';
import { ErrorBoundary } from './ErrorBoundary';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/app/disputes', label: 'Disputes' },
  { to: '/app/charter', label: 'Charter' },
  { to: '/app/demo', label: 'Demo' },
  { to: '/app/pool', label: 'Pool' },
  { to: '/guide', label: 'Guide' },
];

const globalStyles = `
  .signoff-skip-link { position: absolute; left: 8px; top: -100px; background: #ffffff; padding: 8px 16px; border-radius: 6px; z-index: 10; }
  .signoff-skip-link:focus { top: 8px; }
  a:focus-visible, button:focus-visible { outline: 3px solid ${colors.brandPrimary}; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
  }
`;

export const Layout: React.FC = () => (
  <>
    <style>{globalStyles}</style>
    <a href="#main-content" className="signoff-skip-link">
      Skip to main content
    </a>
    <Banner variant="sandbox" testId="banner-sandbox" />
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[1],
        padding: `${spacing[1]} ${spacing[2]}`,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <strong style={{ fontSize: '18px', color: colors.ink }}>Signoff Merchant Operations</strong>
      <nav aria-label="Main">
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[1], listStyle: 'none', margin: 0, padding: 0 }}>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} style={{ color: colors.brandPrimary }}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
    <main id="main-content" tabIndex={-1} style={{ maxWidth: '960px', margin: `${spacing[2]} auto`, padding: `0 ${spacing[2]}` }}>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </main>
  </>
);
