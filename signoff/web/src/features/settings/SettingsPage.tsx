import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ConceptButton, ConceptDisclosure, ConceptListGroup, ConceptListRow, ConceptPageTitle, colors, spacing, toast } from '@signoff/ui';
import { PhoneNotifications } from './PhoneNotifications';
import { useAppearance } from './appearance';
import type { components } from '@signoff/api-client/generated';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';
import { signOut, useOwnerSession } from '../auth/session';

type IntegrationStatus = components['schemas']['IntegrationStatus'];
type ReadinessItem = components['schemas']['ReadinessItem'];
const labels: Record<ReadinessItem['state'], string> = {
  configured: 'Not checked', missing: 'Needs setup', unknown: 'Not observed',
  verified: 'Verified', failed: 'Check failed', stale: 'Out of date',
};
const cardStyle: React.CSSProperties = {
  background: 'var(--signoff-surface, #fff)', borderBottom: `1px solid ${colors.border}`, padding: '16px 0', minWidth: 0,
};

const Connection: React.FC<{ title: string; item: ReadinessItem }> = ({ title, item }) => (
  <section aria-label={title}><details style={cardStyle}>
    <summary style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', minHeight: 48 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      <span style={{ fontSize: 12, fontWeight: 650, padding: '5px 9px', borderRadius: 99,
        background: item.state === 'verified' ? '#ecfdf5' : item.state === 'failed' ? '#fff1f2' : '#f1f5f4',
        color: item.state === 'verified' ? '#065f46' : item.state === 'failed' ? '#9f1239' : '#42524a' }}>
        {labels[item.state]}
      </span>
    </summary>
    <p style={{ lineHeight: 1.6, fontSize: 14, color: 'var(--signoff-muted, #686861)' }}>{item.detail}</p>
    {item.checked_at && <p style={{ fontSize: 12, color: 'var(--signoff-muted, #686861)', marginBottom: 0 }}>Last observed {new Date(item.checked_at).toLocaleString()}</p>}
  </details></section>
);

export const SettingsPage: React.FC = () => {
  const session = useOwnerSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const appearance = useAppearance();
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const integrations = useQuery({
    queryKey: ['integrations'],
    queryFn: () => unwrap(apiClient.request<IntegrationStatus>('/api/integrations/status')),
    retry: false, staleTime: 30_000,
  });
  const check = async () => {
    setChecking(true); setMessage(null); setError(null);
    try {
      const result = await unwrap(apiClient.request<IntegrationStatus>('/api/integrations/check', { method: 'POST', timeoutMs: 30_000 }));
      client.setQueryData(['integrations'], result);
      setMessage('Checks finished. Review the results below.');
      toast('Connection checks finished. Review the results.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection checks could not be completed.'); toast('Connection checks could not be completed.', 'error'); }
    finally { setChecking(false); }
  };
  const logout = async () => {
    setSigningOut(true); setError(null);
    try { await signOut(); client.clear(); void navigate('/login', { replace: true }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign out.'); }
    finally { setSigningOut(false); }
  };
  const data = integrations.data;
  const unverified = data ? [data.paypal, data.store, data.webhook, data.worker, data.llm].filter(item => item.state !== 'verified').length : null;
  const connectionsSubtitle = unverified === null ? 'Loading status…' : unverified === 0 ? 'All checks verified' : `${unverified} check${unverified === 1 ? '' : 's'} not verified`;
  const displayLabel = appearance.display === 'device' ? 'Device' : appearance.display === 'dark' ? 'Dark' : 'Light';
  const accentLabel = appearance.accent.charAt(0).toUpperCase() + appearance.accent.slice(1);
  return (
    <div style={{ display: 'grid', gap: spacing[3], maxWidth: 700, minWidth: 0 }}>
      <ConceptPageTitle title="Settings" subtitle="Your workspace preferences." testId="page-header" />
      <ConceptListGroup>
        <ConceptDisclosure icon="user" title="Account" subtitle={session.data?.email ?? 'Local development session'}>
          <p style={{ margin: 0, color: colors.inkMuted }}>You are signed in with this email.</p>
        </ConceptDisclosure>
        <ConceptDisclosure icon="link" title="Connections" subtitle={connectionsSubtitle} testId="settings-connections">
          <div style={{ display: 'grid', gap: spacing[2] }}>
            <p style={{ margin: 0, color: colors.inkMuted, lineHeight: 1.6 }}>Check PayPal authentication and store access. Webhook and worker statuses reflect observed activity.</p>
            <ConceptButton variant="secondary" fullWidth disabled={checking} onClick={() => { void check(); }}>{checking ? 'Checking…' : 'Check connections'}</ConceptButton>
            {message && <p role="status" style={{ margin: 0 }}>{message}</p>}
            {error && <p role="alert" style={{ color: '#9f1239', margin: 0 }}>{error}</p>}
            {integrations.isPending && <p role="status" style={{ margin: 0 }}>Loading connection status…</p>}
            {integrations.isError && <div role="alert"><p>Couldn’t refresh connection status.</p><Button onClick={() => { void integrations.refetch(); }}>Try again</Button></div>}
            {data && <>
              <section style={{ ...cardStyle, overflowWrap: 'anywhere' }}>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>{data.paypal_environment === 'sandbox' ? 'PayPal sandbox' : 'Local PayPal stub'}</h3>
                <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
                  <dt style={{ color: 'var(--signoff-muted, #686861)', fontSize: 13 }}>Merchant ID</dt><dd style={{ margin: 0 }}>{data.merchant_id ?? 'Not configured'}</dd>
                  <dt style={{ color: 'var(--signoff-muted, #686861)', fontSize: 13 }}>Webhook address</dt><dd style={{ margin: 0, fontSize: 13 }}>{data.webhook_url}</dd>
                </dl>
              </section>
              <Connection title="PayPal access" item={data.paypal} />
              <Connection title="Store evidence" item={data.store} />
              <Connection title="PayPal webhooks" item={data.webhook} />
              <Connection title="Background worker" item={data.worker} />
              <Connection title="AI provider" item={data.llm} />
            </>}
          </div>
        </ConceptDisclosure>
        <ConceptListRow as={Link} to="/app/policy" icon="shield" title="Signing limits" subtitle="Review authority and exclusions" />
        <ConceptListRow as={Link} to="/app/settings/appearance" icon="monitor" title="Appearance" subtitle={`${displayLabel} · ${accentLabel}`} />
        <ConceptDisclosure icon="phone" title="Phone notifications" subtitle="Alerts on this device" testId="settings-phone-notifications"><PhoneNotifications /></ConceptDisclosure>
      </ConceptListGroup>
      {session.data?.authenticated && <div style={{ textAlign: 'center' }}><ConceptButton variant="text" disabled={signingOut} onClick={() => { void logout(); }}>{signingOut ? 'Signing out…' : 'Sign out'}</ConceptButton></div>}
    </div>
  );
};
