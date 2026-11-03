import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Banner } from '@signoff/ui';
import { ErrorBoundary } from './ErrorBoundary';

const items = [
  { to: '/app', label: 'Home', icon: '⌂', end: true },
  { to: '/app/disputes', label: 'Disputes', icon: '≡' },
  { to: '/app/notifications', label: 'Updates', icon: '♧' },
  { to: '/app/more', label: 'More', icon: '⋯' },
];
export const Layout: React.FC = () => {
  const location = useLocation();
  const moreActive = ['/app/more', '/app/reports', '/app/shipments', '/app/policy', '/app/settings'].some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
  return (
  <div className="signoff-shell">
    <style>{`
      .signoff-shell { min-height:100vh; background:#fff; color:#17201b; font-family:Inter,system-ui,sans-serif; }
      .signoff-shell * { box-sizing:border-box; }
      .signoff-shell button:active { transform: translateY(1px); }
      .signoff-shell :focus-visible { outline:3px solid #367a51; outline-offset:3px; }
      .signoff-skip { position:absolute; top:-100px; left:8px; z-index:1000; background:white; padding:12px; }
      .signoff-skip:focus { top:8px; }
      .signoff-header { height:64px; display:flex; align-items:center; gap:12px; padding:0 24px; border-bottom:1px solid #e3e7e4; background:#fff; position:sticky; top:0; z-index:10; }
      .signoff-header a { display:flex; align-items:center; gap:10px; color:inherit; font-weight:700; text-decoration:none; }
      .signoff-header img { width:36px; height:36px; }
      .signoff-store { margin-left:auto; font-size:14px; color:#52605a; }
      .signoff-side { position:fixed; top:98px; bottom:0; width:220px; padding:24px 12px; border-right:1px solid #e3e7e4; background:#fff; }
      .signoff-side a { display:flex; align-items:center; gap:12px; padding:14px; color:#46534b; text-decoration:none; border-radius:6px; }
      .signoff-side a.active { color:var(--signoff-action-primary, #14532d); font-weight:700; background:#edf5ef; }
      .signoff-main { margin-left:220px; padding:32px; min-width:0; }
      .signoff-bottom { display:none; }
      [data-display="dark"] .signoff-shell { background:#151d18; color:#f0f5f1; }
      [data-display="dark"] .signoff-main { background:#fff; color:#17201b; }
      [data-display="dark"] .signoff-header, [data-display="dark"] .signoff-side, [data-display="dark"] .signoff-bottom { background:#202b23; color:#f0f5f1; border-color:#46554a; }
      [data-display="dark"] .signoff-side a, [data-display="dark"] .signoff-bottom a, [data-display="dark"] .signoff-store { color:#e0eae2; }
      [data-display="dark"] .signoff-side a.active, [data-display="dark"] .signoff-bottom a.active { color:#fff; background:#344a39; }
      @media(max-width:899px) { .signoff-side { display:none; } .signoff-main { margin:0; padding:24px 16px calc(100px + env(safe-area-inset-bottom)); } .signoff-header { padding:0 16px; } .signoff-bottom { display:grid; grid-template-columns:repeat(4,1fr); position:fixed; z-index:20; bottom:0; left:0; right:0; padding:4px 0 env(safe-area-inset-bottom); background:#fff; border-top:1px solid #dce3de; } .signoff-bottom a { min-height:60px; display:flex; flex-direction:column; gap:3px; align-items:center; justify-content:center; color:#52605a; text-decoration:none; font-size:12px; border-top:3px solid transparent; } .signoff-bottom a.active { color:var(--signoff-action-primary, #14532d); border-color:var(--signoff-action-primary, #14532d); font-weight:700; } .signoff-bottom span { font-size:22px; line-height:1; } }
    `}</style>
    <a className="signoff-skip" href="#main-content">Skip to main content</a>
    <Banner variant="sandbox" testId="banner-sandbox" />
    <header className="signoff-header" data-testid="shell-topbar"><NavLink to="/app"><img src="/icon.svg" alt="" />Signoff</NavLink><span className="signoff-store">Signoff Shop</span></header>
    <aside className="signoff-side" data-testid="shell-sidebar"><nav aria-label="Main">{items.map(item => <NavLink key={item.to} to={item.to} end={item.end ?? false} className={({ isActive }) => isActive || (item.label === "More" && moreActive) ? "active" : ""}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}</nav></aside>
    <main id="main-content" tabIndex={-1} className="signoff-main"><ErrorBoundary><Outlet /></ErrorBoundary></main>
    <nav className="signoff-bottom" aria-label="Main navigation">{items.map(item => <NavLink key={item.to} to={item.to} end={item.end ?? false}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}</nav>
  </div>
  );
};
