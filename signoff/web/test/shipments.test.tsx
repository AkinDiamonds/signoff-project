// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { components } from '@signoff/api-client/generated';
import { ShipmentsPage } from '../src/features/fulfillment/ShipmentsPage';
import { setCsrfToken } from '../src/app/sessionTransport';

type Shipment = components['schemas']['ShipmentView'];
const shipment: Shipment = {
  order_code: 'SIGSHIPTEST', order_status: 'PAID', shipment_id: '00000000-0000-4000-8000-000000000001',
  amount: { value: '21.00', currency_code: 'USD' }, source: 'simulated', carrier: 'UPS',
  tracking_number: 'SIM-TEST-TRACKING', stage: 'PRE_TRANSIT', mode: 'normal', version: 0,
  next_event_at: '2026-11-01T00:01:00Z', can_configure_scenario: true,
  events: [{ carrier: 'UPS', tracking_number: 'SIM-TEST-TRACKING', status: 'PRE_TRANSIT',
    event_time: '2026-11-01T00:00:00Z', source: 'simulated' }],
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ShipmentsPage /></QueryClientProvider>);
}

describe('Merchant simulated shipments', () => {
  beforeEach(() => {
    setCsrfToken('fictional-csrf');
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000002' });
  });

  it('labels simulation, history and the next automatic milestone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([shipment])));
    mount();
    await screen.findByRole('heading', { name: 'SIGSHIPTEST' });
    expect(screen.getByText(/Simulated shipment · Label created/)).toBeTruthy();
    expect(screen.getByText(/Next automatic milestone/)).toBeTruthy();
    expect(screen.getByText(/Nothing is sent to a real carrier/)).toBeTruthy();
  });

  it('submits one versioned CSRF-protected action on a rapid double tap', async () => {
    let current = shipment;
    const posts: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: unknown, options?: RequestInit) => {
      if (options?.method === 'POST') {
        posts.push(options);
        current = { ...shipment, stage: 'IN_TRANSIT', order_status: 'SHIPPED', version: 1 };
        return Promise.resolve(response(current));
      }
      return Promise.resolve(response([current]));
    }));
    mount();
    const button = await screen.findByRole('button', { name: 'Advance simulated shipment' });
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    await waitFor(() => expect(posts).toHaveLength(1));
    const post = posts[0];
    expect(JSON.parse(String(post?.body))).toEqual({
      base_version: 0, request_id: '00000000-0000-4000-8000-000000000002', action: 'advance',
    });
    expect(new Headers(post?.headers).get('X-CSRF-Token')).toBe('fictional-csrf');
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('In transit'));
  });

  it('locks scenario changes after a dispute without blocking chronological advancement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([{ ...shipment, can_configure_scenario: false }])));
    mount();
    await screen.findByRole('heading', { name: 'SIGSHIPTEST' });
    expect(screen.getByRole('button', { name: 'Simulate exception' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Withhold tracking' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Advance simulated shipment' })).not.toBeDisabled();
    expect(screen.getByText(/A PayPal dispute exists/)).toBeTruthy();
  });

  it('shows paused missing tracking as human review rather than successful shipping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([
      { ...shipment, mode: 'missing_tracking', next_event_at: null },
    ])));
    mount();
    await screen.findByRole('heading', { name: 'SIGSHIPTEST' });
    expect(screen.getByRole('status').textContent).toContain('requires human review');
    expect(screen.getByRole('button', { name: 'Advance simulated shipment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resume simulated shipping' })).toBeTruthy();
  });

  it('has an honest empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([])));
    mount();
    await screen.findByRole('heading', { name: 'No simulated shipments yet' });
    expect(screen.queryByRole('button', { name: 'Advance simulated shipment' })).toBeNull();
  });

  it('shows failed writes as failures and refreshes the authoritative state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: unknown, options?: RequestInit) => Promise.resolve(
      options?.method === 'POST' ? response({ error: { code: 'SHIPMENT_CONFLICT',
        message: 'Shipment changed. Refresh before trying again.', correlation_id: 'fictional-id', fields: [] } }, 409)
        : response([shipment])
    )));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Advance simulated shipment' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Shipment changed'));
    expect(screen.queryByText(/Shipping is simulated\.$/)).toBeNull();
  });
});
