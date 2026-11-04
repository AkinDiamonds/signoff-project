import React from 'react';
import { Link } from 'react-router';
import { ConceptCard, ConceptListGroup, ConceptListRow, ConceptPageTitle, ConceptSectionLabel, ConceptIcon, type ConceptIconName } from '@signoff/ui';

const groups: { title: string; links: [string, string, ConceptIconName][] }[] = [
  { title: 'Workspace', links: [['/app/reports', 'Reports', 'chart'], ['/app/shipments', 'Shipments', 'truck'], ['/app/policy', 'Signing limits', 'sliders']] },
  { title: 'Preferences', links: [['/app/settings', 'Settings', 'gear'], ['/guide', 'Help', 'help-circle']] },
  { title: 'Sandbox tools', links: [['/app/demo', 'Demo scenarios', 'layers'], ['/app/pool', 'Demo disputes', 'file']] },
];
export const MorePage: React.FC = () => <div style={{ maxWidth: 700, display: 'grid', gap: 28 }}>
  <ConceptPageTitle title="More" subtitle="Manage your workspace." testId="page-header" />
  {groups.map(group => <section key={group.title} aria-label={group.title} style={{ display: 'grid', gap: 10 }}>
    <ConceptSectionLabel>{group.title}</ConceptSectionLabel>
    <nav aria-label={group.title}>
      <ConceptListGroup>
        {group.links.map(([to, label, icon]) => <ConceptListRow key={to} as={Link} to={to} icon={icon} title={label} />)}
      </ConceptListGroup>
    </nav>
  </section>)}
  <ConceptCard padding={0}>
    <a href={import.meta.env.PUBLIC_SHOP_URL || 'http://localhost:5174'} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '16px 18px', color: 'inherit', textDecoration: 'none', fontSize: 17, fontWeight: 650 }}>
      <ConceptIcon name="store" /><span style={{ flex: 1 }}>Buyer shop</span><ConceptIcon name="external-link" color="var(--signoff-muted, #6b6b66)" />
    </a>
  </ConceptCard>
</div>;
