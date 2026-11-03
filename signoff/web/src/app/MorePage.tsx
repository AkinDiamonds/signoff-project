import React from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@signoff/ui';

export const MorePage: React.FC = () => <div style={{ maxWidth: 700 }}>
  <PageHeader title="More" description="Manage your store and find help." />
  <nav aria-label="More options" style={{ display: 'grid' }}>
    {[
      ['/app/reports', 'Reports'], ['/app/shipments', 'Shipments'], ['/app/policy', 'Rules'], ['/app/settings', 'Settings'], ['/guide', 'Help'],
    ].map(([to, label]) => <Link key={to} to={to ?? '/app'} style={{ padding: '18px 0', borderBottom: '1px solid #e3e7e4', color: '#14532d', fontWeight: 600, textDecoration: 'none' }}>{label}</Link>)}
    <a href={import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174'} target="_blank" rel="noreferrer" style={{ padding: '18px 0', color: '#14532d', fontWeight: 600, textDecoration: 'none' }}>Buyer shop</a>
  </nav>
</div>;
