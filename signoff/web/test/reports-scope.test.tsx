// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { ReportsPage } from '../src/features/dashboard/ReportsPage';
import { mockFetch, resetMockState } from '../src/app/mockFetch';

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter><ReportsPage /></MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Reports scope', () => {
  const kpiCalls: Array<{ url: string; session: string | null }> = [];

  beforeEach(() => {
    resetMockState();
    sessionStorage.clear();
    kpiCalls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (new URL(url, 'http://localhost').pathname === '/api/kpis') {
        kpiCalls.push({ url, session: new Headers(init?.headers).get('X-Demo-Session') });
      }
      return mockFetch(input, init);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to all time without a sandbox session and labels each tile with its scope', async () => {
    mount();
    await screen.findByTestId('kpi-open-disputes');
    expect(screen.getByRole('button', { name: 'All time' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('Scope: All time')).toHaveLength(4);
    expect(kpiCalls[0]?.url).toContain('scope=all');
    expect(kpiCalls[0]?.session).toBeNull();
  });

  it('sends the sandbox session header only when "My session" is selected', async () => {
    sessionStorage.setItem('signoff.demo.session', 'sess-123');
    mount();
    await screen.findByTestId('kpi-open-disputes');
    expect(kpiCalls[0]?.url).toContain('scope=mine');
    expect(kpiCalls[0]?.session).toBe('sess-123');

    fireEvent.click(screen.getByRole('button', { name: 'All time' }));
    await waitFor(() => expect(kpiCalls.some(call => call.url.includes('scope=all'))).toBe(true));
    expect(kpiCalls.filter(call => call.url.includes('scope=all')).every(call => call.session === null)).toBe(true);
  });
});
