import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Banner } from '@signoff/ui';
import { ErrorBoundary } from './ErrorBoundary';

const Icon: React.FC<{ name: string }> = ({ name }) => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
  {name === 'Home' ? <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6" /></> : name === 'Disputes' ? <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></> : name === 'Updates' ? <><path d="M5 17h14l-1.5-2V10a5.5 5.5 0 0 0-11 0v5L5 17Z" /><path d="M10 20h4" /></> : <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>}
</svg>;

const items = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/disputes', label: 'Disputes', },
  { to: '/app/notifications', label: 'Updates', },
  { to: '/app/more', label: 'More', },
];
export const Layout: React.FC = () => {
  const location = useLocation();
  const moreActive = ['/app/more', '/app/reports', '/app/shipments', '/app/policy', '/app/charter', '/app/settings', '/app/demo', '/app/pool', '/guide'].some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
  return (
  <div className="signoff-shell">
    <style>{`
      .signoff-shell { --signoff-canvas:#fff; --signoff-surface:#fff; --signoff-subtle:#f7f7f5; --signoff-divider:#e7e7e2; --signoff-ink:#252521; --signoff-muted:#686861; --signoff-danger-text:#842f2c; --signoff-input-border:#8b8b83; --signoff-card-shadow:none; --signoff-brand-surface:#f7f7f5; --signoff-success-bg:#e5f1e9; --signoff-success-text:#24513c; --signoff-attention-bg:#f8ebcf; --signoff-attention-text:#6c4b16; --signoff-critical-bg:#f8e5e4; --signoff-critical-text:#842f2c; min-height:100vh; background:var(--signoff-canvas); color:var(--signoff-ink); font-family:Inter,system-ui,sans-serif; line-height:1.5; }
      .signoff-shell * { box-sizing:border-box; }
      .signoff-main button, .signoff-main summary { min-height:44px; }
      .signoff-shell button:active { transform: translateY(1px); }
      .signoff-shell :focus-visible { outline:2px solid #2563eb !important; outline-offset:3px; }
      .signoff-skip { position:absolute; top:-100px; left:8px; z-index:1000; background:white; padding:12px; }
      .signoff-skip:focus { top:8px; }
      .signoff-header { height:64px; display:flex; align-items:center; gap:12px; padding:0 24px; border-bottom:1px solid #e3e7e4; background:#fff; position:sticky; top:0; z-index:10; }
      .signoff-header a { display:flex; align-items:center; gap:10px; color:inherit; font-weight:700; text-decoration:none; }
      .signoff-header img { width:36px; height:36px; }
      .signoff-store { margin-left:auto; font-size:14px; color:#52605a; }
      .signoff-side { position:fixed; top:98px; bottom:0; width:220px; padding:24px 12px; border-right:1px solid #e3e7e4; background:#fff; }
      .signoff-side a { display:flex; align-items:center; gap:12px; padding:14px; color:#46534b; text-decoration:none; border-radius:6px; }
      .signoff-side a.active { color:var(--signoff-action-primary, #14532d); font-weight:700; background:#edf5ef; }
      .signoff-main { margin-left:220px; padding:40px; min-width:0; overflow-wrap:anywhere; }
      .signoff-main > * { min-width:0; }
      .signoff-main input, .signoff-main select, .signoff-main textarea { max-width:100%; font-size:16px; }
      .signoff-main input:not([type="checkbox"]):not([type="radio"]), .signoff-main select, .signoff-main textarea { min-height:44px; }
      .signoff-bottom { display:none; }
      [data-display="dark"] .signoff-shell { --signoff-canvas:#191919; --signoff-surface:#222; --signoff-subtle:#282828; --signoff-divider:#373732; --signoff-ink:#e7e7e4; --signoff-muted:#adada5; --signoff-danger-text:#ffb4a8; }
      [data-display="dark"] [data-testid="banner-sandbox"] { background:#222 !important; color:#e7e7e4 !important; }
      [data-display="dark"] .signoff-main a:not([style*="background"]) { color:#a9d8bc !important; }
      [data-display="dark"] .signoff-main { background:#191919; color:#e7e7e4; }
      [data-display="dark"] .signoff-main input, [data-display="dark"] .signoff-main select, [data-display="dark"] .signoff-main textarea { background:#222; color:#e7e7e4; }
      [data-display="dark"] .signoff-header, [data-display="dark"] .signoff-side, [data-display="dark"] .signoff-bottom { background:#202b23; color:#f0f5f1; border-color:#46554a; }
      [data-display="dark"] .signoff-side a, [data-display="dark"] .signoff-bottom a, [data-display="dark"] .signoff-store { color:#e0eae2; }
      [data-display="dark"] .signoff-side a.active, [data-display="dark"] .signoff-bottom a.active { color:#fff; background:#344a39; }
      @media(max-width:899px) { .signoff-side { display:none; } .signoff-main { margin:0; padding:24px 20px calc(100px + env(safe-area-inset-bottom)); } .signoff-header { padding:0 16px; } .signoff-bottom { display:grid; grid-template-columns:repeat(4,1fr); position:fixed; z-index:20; bottom:0; left:0; right:0; padding:4px 0 env(safe-area-inset-bottom); background:#fff; border-top:1px solid #dce3de; } .signoff-bottom a { min-height:60px; display:flex; flex-direction:column; gap:3px; align-items:center; justify-content:center; color:#52605a; text-decoration:none; font-size:12px; border-top:3px solid transparent; } .signoff-bottom a.active { color:var(--signoff-action-primary, #14532d); border-color:var(--signoff-action-primary, #14532d); font-weight:700; } .signoff-bottom span { font-size:22px; line-height:1; } }
      @media(max-width:340px) { .signoff-main { padding-left:16px; padding-right:16px; } }
    `}</style>
    <a className="signoff-skip" href="#main-content">Skip to main content</a>
    <Banner variant="sandbox" testId="banner-sandbox" />
    <header className="signoff-header" data-testid="shell-topbar"><NavLink to="/app"><img src="/icon.svg" alt="" />Signoff</NavLink><span className="signoff-store">Signoff Shop</span></header>
    <aside className="signoff-side" data-testid="shell-sidebar"><nav aria-label="Main">{items.map(item => <NavLink key={item.to} to={item.to} end={item.end ?? false} className={({ isActive }) => isActive || (item.label === "More" && moreActive) ? "active" : ""}><Icon name={item.label} />{item.label}</NavLink>)}</nav></aside>
    <main id="main-content" tabIndex={-1} className="signoff-main"><ErrorBoundary><Outlet /></ErrorBoundary></main>
    <nav className="signoff-bottom" aria-label="Main navigation">{items.map(item => <NavLink key={item.to} to={item.to} end={item.end ?? false} className={({ isActive }) => isActive || (item.label === "More" && moreActive) ? "active" : ""}><Icon name={item.label} />{item.label}</NavLink>)}</nav>
  </div>
  );
};
