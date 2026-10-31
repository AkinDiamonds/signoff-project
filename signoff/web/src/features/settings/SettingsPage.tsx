import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Button, colors, radius, spacing, useTheme } from '@signoff/ui';
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
  background: '#fff', borderRadius: radius.card, border: `1px solid ${colors.border}`, padding: 20, minWidth: 0,
};

const Connection: React.FC<{ title: string; item: ReadinessItem }> = ({ title, item }) => (
  <section style={cardStyle} aria-label={title}>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      <span style={{ fontSize: 12, fontWeight: 650, padding: '5px 9px', borderRadius: 99,
        background: item.state === 'verified' ? '#ecfdf5' : item.state === 'failed' ? '#fff1f2' : '#f1f5f4',
        color: item.state === 'verified' ? '#065f46' : item.state === 'failed' ? '#9f1239' : '#42524a' }}>
        {labels[item.state]}
      </span>
    </div>
    <p style={{ lineHeight: 1.6, fontSize: 14, color: '#52605a' }}>{item.detail}</p>
    {item.checked_at && <p style={{ fontSize: 12, color: '#66736c', marginBottom: 0 }}>Last observed {new Date(item.checked_at).toLocaleString()}</p>}
  </section>
);

export const SettingsPage: React.FC = () => {
  const session = useOwnerSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const theme = useTheme();
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
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection checks could not be completed.'); }
    finally { setChecking(false); }
  };
  const logout = async () => {
    setSigningOut(true); setError(null);
    try { await signOut(); client.clear(); void navigate('/login', { replace: true }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign out.'); }
    finally { setSigningOut(false); }
  };
  const data = integrations.data;
  return (
    <div style={{ display: 'grid', gap: spacing[4], maxWidth: 960, minWidth: 0 }}>
      <PageHeader title="Settings" description="Your account, connections, and signing preferences." />
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Your account</h2>
        <p>{session.data?.email ?? 'Local development session'}</p>
        {session.data?.authenticated && <Button disabled={signingOut} onClick={() => { void logout(); }}>{signingOut ? 'Signing out…' : 'Sign out'}</Button>}
      </section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Connections</h2>
        <Button onClick={() => { void check(); }} disabled={checking}>{checking ? 'Checking…' : 'Check connections'}</Button>
      </div>
      <p style={{ margin: 0, color: '#52605a', lineHeight: 1.6 }}>Check PayPal authentication and store access. Webhook and worker statuses reflect observed activity.</p>
      {message && <p role="status" style={{ margin: 0 }}>{message}</p>}
      {error && <p role="alert" style={{ color: '#9f1239', margin: 0 }}>{error}</p>}
      {integrations.isPending && <p role="status">Loading connection status…</p>}
      {integrations.isError && <div role="alert"><p>Couldn’t refresh connection status.</p><Button onClick={() => { void integrations.refetch(); }}>Try again</Button></div>}
      {data && <>
        <section style={{ ...cardStyle, overflowWrap: 'anywhere' }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>{data.paypal_environment === 'sandbox' ? 'PayPal sandbox' : 'Local PayPal stub'}</h3>
          <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
            <dt style={{ color: '#66736c', fontSize: 13 }}>Merchant ID</dt><dd style={{ margin: 0 }}>{data.merchant_id ?? 'Not configured'}</dd>
            <dt style={{ color: '#66736c', fontSize: 13 }}>Webhook address</dt><dd style={{ margin: 0, fontSize: 13 }}>{data.webhook_url}</dd>
          </dl>
        </section>
        <div style={{ display: 'grid', gap: spacing[3], gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
          <Connection title="PayPal access" item={data.paypal} />
          <Connection title="Store evidence" item={data.store} />
          <Connection title="PayPal webhooks" item={data.webhook} />
          <Connection title="Background worker" item={data.worker} />
          <Connection title="AI provider" item={data.llm} />
        </div>
      </>}
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Signing preferences</h2>
        <p style={{ color: '#52605a', lineHeight: 1.6 }}>Control the actions and amounts Signoff can handle automatically.</p>
        <Link to="/app/policy" style={{ color: '#115e59', fontWeight: 600 }}>Manage signing limits →</Link>
      </section>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Appearance</h2>
        <Button onClick={theme.openPicker}>Choose a theme</Button>
      </section>
    </div>
  );
};
