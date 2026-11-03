import React, { useState } from 'react';
import { colors } from '@signoff/ui';

export interface ViewSwitcherProps {
  initialView?: 'buyer' | 'merchant';
  onViewChange?: (view: 'buyer' | 'merchant') => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ initialView = 'merchant', onViewChange }) => {
  const [view, setView] = useState<'buyer' | 'merchant'>(initialView);
  const shop = import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174';
  const select = (next: 'buyer' | 'merchant') => { setView(next); onViewChange?.(next); };
  return <nav aria-label="Audience View Switcher" data-testid="view-switcher" style={{ display: 'grid', gap: 16 }}>
    <div role="tablist" aria-label="Guide perspective" style={{ display: 'flex', background: colors.surfaceSubtle, padding: 4, borderRadius: 6 }}>
      {(['merchant', 'buyer'] as const).map(item => <button key={item} type="button" role="tab" aria-selected={view === item} data-testid={`view-switcher-${item}-tab`} onClick={() => select(item)}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select(item === 'merchant' ? 'buyer' : 'merchant'); const next = item === 'merchant' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling; if (next instanceof HTMLElement) next.focus(); } }}
        style={{ flex: 1, minHeight: 44, border: 0, borderRadius: 4, background: view === item ? colors.primaryAction : 'transparent', color: view === item ? '#fff' : colors.ink, font: 'inherit', fontWeight: 600 }}>{item === 'merchant' ? 'Merchant' : 'Buyer'}</button>)}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 14 }}>
      {view === 'merchant' ? <>
        <a href="/app" data-testid="view-link-merchant-dashboard">Home</a>
        <a href="/app/disputes" data-testid="view-link-merchant-disputes">Disputes</a>
        <a href="/app/charter" data-testid="view-link-merchant-charter">Signing limits</a>
        <a href="/app/demo" data-testid="view-link-merchant-demo">Demo scenarios</a>
      </> : <>
        <a href={`${shop}/`} target="_blank" rel="noreferrer" data-testid="view-link-buyer-shop">Buyer shop ↗</a>
        <a href={`${shop}/cart`} target="_blank" rel="noreferrer" data-testid="view-link-buyer-cart">Cart ↗</a>
        <a href={`${shop}/orders`} target="_blank" rel="noreferrer" data-testid="view-link-buyer-portal">Buyer portal ↗</a>
      </>}
    </div>
  </nav>;
};
