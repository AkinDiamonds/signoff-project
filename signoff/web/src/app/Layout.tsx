import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ConceptIcon, StoreSwitcherRow, type ConceptIconName } from '@signoff/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { useNotifications } from '../features/notifications/NotificationsPage';

const items: { to: string; label: string; icon: ConceptIconName; end?: boolean }[] = [
  { to: '/app', label: 'Home', icon: 'home', end: true },
  { to: '/app/disputes', label: 'Disputes', icon: 'disputes' },
  { to: '/app/notifications', label: 'Updates', icon: 'bell' },
  { to: '/app/more', label: 'More', icon: 'more' },
];
const moreRoutes = ['/app/more', '/app/reports', '/app/shipments', '/app/policy', '/app/charter', '/app/settings', '/app/demo', '/app/pool', '/guide'];
const storeRoutes = ['/app', '/app/disputes', '/app/notifications'];

export const Layout: React.FC = () => {
  const location = useLocation();
  const notifications = useNotifications(0, false, location.pathname.startsWith('/app'));
  const unread = notifications.data?.unread_count ?? 0;
  const moreActive = moreRoutes.some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const showStore = storeRoutes.includes(location.pathname.replace(/\/$/, '') || '/');
  const linkClass = (item: (typeof items)[number], isActive: boolean) => (isActive || (item.label === 'More' && moreActive) ? 'active' : '');
  const links = items.map(item => <NavLink key={item.to} to={item.to} end={item.end ?? false} className={({ isActive }) => linkClass(item, isActive)}>
    <ConceptIcon name={item.icon} size={24} strokeWidth={2} />{item.label}
    {item.label === 'Updates' && unread > 0 && <span className="signoff-unread" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}
  </NavLink>);
  return (
  <div className="signoff-shell">
    <style>{`
      .signoff-shell { --signoff-canvas:#fff; --signoff-surface:#fff; --signoff-subtle:#f6f6f5; --signoff-divider:#e7e6e2; --signoff-ink:#1b1b19; --signoff-muted:#6b6b66; --signoff-danger-text:#a12a22; --signoff-input-border:#8b8b83; --signoff-card-shadow:none; --signoff-brand-surface:#f6f6f5; --signoff-success-bg:#e5f1e9; --signoff-success-text:#24513c; --signoff-attention-bg:#f8ebcf; --signoff-attention-text:#6c4b16; --signoff-critical-bg:#f8e5e4; --signoff-critical-text:#842f2c; min-height:100vh; background:var(--signoff-canvas); color:var(--signoff-ink); font-family:Inter,system-ui,sans-serif; line-height:1.5; }
      .signoff-shell * { box-sizing:border-box; }
      .signoff-main button, .signoff-main summary { min-height:44px; }
      .signoff-shell button:active { transform: translateY(1px); }
      .signoff-shell :focus-visible { outline:2px solid var(--signoff-action-primary, #135e3d) !important; outline-offset:3px; }
      .signoff-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      .signoff-skip { position:absolute; top:-100px; left:8px; z-index:1000; background:white; padding:12px; }
      .signoff-skip:focus { top:8px; }
      .signoff-header { height:64px; display:flex; align-items:center; gap:12px; padding:0 24px; border-bottom:1px solid var(--signoff-divider); background:var(--signoff-surface); position:sticky; top:0; z-index:10; }
      .signoff-header a { display:flex; align-items:center; gap:10px; color:inherit; font-size:20px; font-weight:750; text-decoration:none; }
      .signoff-header img { width:36px; height:36px; border-radius:9px; background:#07472c; }
      .signoff-store { margin-left:auto; font-size:15px; color:var(--signoff-muted); }
      .signoff-side { position:fixed; top:65px; bottom:0; width:220px; padding:24px 12px; border-right:1px solid var(--signoff-divider); background:var(--signoff-surface); }
      .signoff-side a { display:flex; align-items:center; gap:12px; padding:14px; color:#52605a; text-decoration:none; border-radius:10px; }
      .signoff-side a.active { color:var(--signoff-action-primary, #135e3d); font-weight:700; background:#e5f2ea; }
      .signoff-main { margin-left:220px; padding:40px; min-width:0; overflow-wrap:anywhere; }
      .signoff-main > * { min-width:0; }
      .signoff-main input, .signoff-main select, .signoff-main textarea { max-width:100%; font-size:16px; }
      .signoff-main input:not([type="checkbox"]):not([type="radio"]), .signoff-main select, .signoff-main textarea { min-height:44px; }
      .signoff-page { display:grid; gap:24px; }
      .signoff-bottom { display:none; }
      .signoff-unread { font-size:11px; line-height:1; padding:2px 5px; border-radius:8px; background:#dcf6e6; color:#1b1b19; }
      .concept-disclosure > summary::-webkit-details-marker { display:none; }
      .concept-disclosure[open] > summary > svg:last-child { transform:rotate(180deg); }
      [data-display="dark"] .signoff-shell { --signoff-canvas:#191919; --signoff-surface:#222; --signoff-subtle:#282828; --signoff-divider:#373732; --signoff-ink:#e7e7e4; --signoff-muted:#adada5; --signoff-danger-text:#ffb4a8; }
      [data-display="dark"] .signoff-main a:not([style*="background"]) { color:#a9d8bc !important; }
      [data-display="dark"] .signoff-main { background:#191919; color:#e7e7e4; }
      [data-display="dark"] .signoff-main input, [data-display="dark"] .signoff-main select, [data-display="dark"] .signoff-main textarea { background:#222; color:#e7e7e4; }
      [data-display="dark"] .signoff-header, [data-display="dark"] .signoff-side, [data-display="dark"] .signoff-bottom { background:#202b23; color:#f0f5f1; border-color:#46554a; }
      [data-display="dark"] .signoff-side a, [data-display="dark"] .signoff-bottom a, [data-display="dark"] .signoff-store { color:#e0eae2; }
      [data-display="dark"] .signoff-side a.active, [data-display="dark"] .signoff-bottom a.active { color:#fff; background:#344a39; }
      @media(max-width:899px) { .signoff-side { display:none; } .signoff-main { margin:0; padding:24px 20px calc(100px + env(safe-area-inset-bottom)); } .signoff-header { padding:0 20px; } .signoff-bottom { display:grid; grid-template-columns:repeat(4,1fr); position:fixed; z-index:20; bottom:0; left:0; right:0; padding:4px 0 env(safe-area-inset-bottom); background:var(--signoff-surface); border-top:1px solid var(--signoff-divider); } .signoff-bottom a { position:relative; min-height:60px; display:flex; flex-direction:column; gap:3px; align-items:center; justify-content:center; color:#52605a; text-decoration:none; font-size:13px; font-weight:500; } .signoff-bottom a.active { color:var(--signoff-action-primary, #135e3d); font-weight:700; } .signoff-bottom .signoff-unread { position:absolute; top:6px; left:calc(50% + 6px); } }
      @media(max-width:340px) { .signoff-main { padding-left:16px; padding-right:16px; } }
    `}</style>
    <a className="signoff-skip" href="#main-content">Skip to main content</a>
    <div role="status" data-testid="banner-sandbox" className="signoff-sr">Sandbox demo, fictional data.</div>
    <header className="signoff-header" data-testid="shell-topbar"><NavLink to="/app"><img src="/icon.svg" alt="" />Signoff</NavLink><span className="signoff-store">Sandbox demo</span></header>
    <aside className="signoff-side" data-testid="shell-sidebar"><nav aria-label="Main">{links}</nav></aside>
    <main id="main-content" tabIndex={-1} className="signoff-main">
      {showStore && <div style={{ marginBottom: 24 }}><StoreSwitcherRow href="https://signoff-shop.onrender.com/" /></div>}
      <ErrorBoundary><Outlet /></ErrorBoundary>
    </main>
    <nav className="signoff-bottom" aria-label="Main navigation">{links}</nav>
  </div>
  );
};
