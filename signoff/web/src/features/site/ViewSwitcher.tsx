import React, { useState } from 'react';
import { ConceptSegmented } from '@signoff/ui';

export interface ViewSwitcherProps {
  initialView?: 'buyer' | 'merchant';
  onViewChange?: (view: 'buyer' | 'merchant') => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ initialView = 'merchant', onViewChange }) => {
  const [view, setView] = useState<'buyer' | 'merchant'>(initialView);
  const select = (next: string) => {
    if (next !== 'buyer' && next !== 'merchant') return;
    setView(next);
    onViewChange?.(next);
  };
  return <nav aria-label="Audience View Switcher" data-testid="view-switcher">
    <ConceptSegmented tabs idPrefix="guide-view" ariaLabel="Guide perspective" value={view} onChange={select}
      options={[{ value: 'merchant', label: 'Merchant' }, { value: 'buyer', label: 'Buyer' }]} />
  </nav>;
};
