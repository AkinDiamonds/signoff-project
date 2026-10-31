// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { components } from '@signoff/api-client/generated';
import { SettingsPage } from '../src/features/settings/SettingsPage';
import { mockFetch } from '../src/app/mockFetch';

type IntegrationStatus = components['schemas']['IntegrationStatus'];
const baseline: IntegrationStatus = {
  merchant_id: null, paypal_environment: 'sandbox', webhook_url: 'https://api.example.test/webhooks/paypal',
  paypal: { state: 'configured', detail: 'PayPal access is configured but has not been checked.', checked_at: null },
  store: { state: 'configured', detail: 'Store access is configured but has not been checked.', checked_at: null },
  webhook: { state: 'unknown', detail: 'No verified webhook has been observed.', checked_at: null },
  worker: { state: 'unknown', detail: 'No worker heartbeat has been observed.', checked_at: null },
  llm: { state: 'missing', detail: 'Live AI provider is not configured.', checked_at: null },
};
const clients: QueryClient[] = [];
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function show(failure = false) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/api/integrations/status')) return reply(baseline);
    if (url.endsWith('/api/integrations/check')) return failure
      ? reply({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Connection check is unavailable.', correlation_id: 'fixture' } }, 503)
      : reply({ ...baseline, paypal: { state: 'failed', detail: 'The PayPal access check failed.', checked_at: '2026-10-31T12:00:00Z' } });
    return mockFetch(input, options);
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter><SettingsPage /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.unstubAllGlobals(); });

describe('truthful connection status', () => {
  it('shows configured and unknown states rather than claiming a verified connection', async () => {
    show();
    const paypal = await screen.findByRole('region', { name: 'PayPal access' });
    expect(within(paypal).getByText('Not checked')).toBeTruthy();
    expect(within(paypal).queryByText('Verified')).toBeNull();
    expect(screen.getByRole('region', { name: 'Background worker' })).toHaveTextContent('Not observed');
    expect(screen.getByText('https://api.example.test/webhooks/paypal')).toBeTruthy();
  });
  it('keeps a failed check visibly failed even when the check request completes', async () => {
    show(); await screen.findByRole('region', { name: 'PayPal access' });
    fireEvent.click(screen.getByRole('button', { name: 'Check connections' }));
    expect(await screen.findByText('Check failed')).toBeTruthy();
    expect(screen.queryByText(/Successfully synced|Webhook listener active/)).toBeNull();
  });
  it('reports transport failure instead of a success message', async () => {
    show(true); await screen.findByRole('region', { name: 'PayPal access' });
    fireEvent.click(screen.getByRole('button', { name: 'Check connections' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection check is unavailable.');
    expect(screen.queryByText('Checks finished. Review the results below.')).toBeNull();
  });
});
