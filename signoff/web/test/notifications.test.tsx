// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPage } from '../src/features/notifications/NotificationsPage';
import { setCsrfToken } from '../src/app/sessionTransport';

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><NotificationsPage /></MemoryRouter></QueryClientProvider>);
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('Notifications', () => {
  afterEach(() => { vi.unstubAllGlobals(); setCsrfToken(null); });
  it('loads unread items and saves read state with CSRF', async () => {
    setCsrfToken('fictional-csrf');
    let readAt: string | null = null;
    let writes = 0;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        writes += 1;
        expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('fictional-csrf');
        const body = JSON.parse(String(init.body));
        readAt = body.read ? '2026-11-01T12:00:00Z' : null;
        return json({ id: 'notice-1', read_at: readAt });
      }
      return json({ items: [{ id: 'notice-1', dispute_id: 'PP-TEST', kind: 'approval_requested',
        message: 'An action needs your approval.', created_at: '2026-11-01T11:00:00Z', read_at: readAt }],
        unread_count: readAt ? 0 : 1, next_offset: null });
    }));
    const view = mount();
    await screen.findByText('An action needs your approval.');
    expect(screen.getByText('1 unread')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View dispute' }).getAttribute('href')).toBe('/app/disputes/PP-TEST');
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(screen.getByText('0 unread')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Mark unread' })).toBeTruthy();
    expect(writes).toBe(1);
    view.unmount();
    mount();
    await screen.findByRole('button', { name: 'Mark unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark unread' }));
    await waitFor(() => expect(screen.getByText('1 unread')).toBeTruthy());
    expect(writes).toBe(2);
  });
  it('shows a load error without claiming the inbox is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'UNAVAILABLE', message: 'Unavailable' } }, 503)));
    mount();
    await screen.findByRole('alert');
    expect(screen.getByText('Couldn’t load notifications.')).toBeTruthy();
    expect(screen.queryByText('No notifications here yet.')).toBeNull();
  });
});
