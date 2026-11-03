import React from 'react';
import { Link } from 'react-router';
import { PageHeader, colors } from '@signoff/ui';

const groups = [
  { title: 'Workspace', links: [['/app/reports', 'Reports', 'Metrics and activity'], ['/app/shipments', 'Shipments', 'Simulated shipping'], ['/app/policy', 'Signing limits', 'Review your permissions']] },
  { title: 'Preferences & help', links: [['/app/settings', 'Settings', 'Account and connections'], ['/app/settings/appearance', 'Appearance', 'Display and accent'], ['/guide', 'Help', 'Learn how to use Signoff']] },
  { title: 'Sandbox tools', links: [['/app/demo', 'Demo scenarios', 'Create a sandbox case'], ['/app/pool', 'Demo disputes', 'Available and finished runs']] },
];
export const MorePage: React.FC = () => <div style={{ maxWidth: 700, display: 'grid', gap: 32 }}>
  <PageHeader title="More" description="Manage your workspace." />
  {groups.map(group => <section key={group.title} aria-label={group.title}>
    <h2 style={{ fontSize: 15, color: colors.inkMuted, margin: '0 0 8px' }}>{group.title}</h2>
    <nav aria-label={group.title}>
      {group.links.map(([to, label, description]) => <Link key={to} to={to ?? '/app'} style={{ minHeight: 64, padding: '12px 4px', borderBottom: `1px solid ${colors.border}`, color: colors.ink, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}><span><strong>{label}</strong><br /><span style={{ color: colors.inkMuted, fontSize: 14 }}>{description}</span></span><span aria-hidden="true">›</span></Link>)}
    </nav>
  </section>)}
  <a href={import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174'} target="_blank" rel="noreferrer" style={{ minHeight: 48, color: colors.interactive }}>Buyer shop ↗ <span style={{ color: colors.inkMuted }}>· opens separately</span></a>
</div>;
