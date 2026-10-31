// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { mockFetch } from '../src/app/mockFetch';
import { statusFixture } from '../../fixtures/ui';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('web shell', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a skeleton while status loads, then the status values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(statusFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    await act(async () => {
      renderAt('/');
    });
    expect(screen.getByRole('status', { name: 'Loading system status' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('status-llm-mode').textContent).toBe('CACHED');
    });
    expect(screen.getByTestId('status-env').textContent).toBe('local');
    expect(screen.getByText('Cached reasoning: this plan was replayed from the scenario cache, not generated live.')).toBeTruthy();
  });

  it('shows an error state with a correlation id when the API envelope fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'Status service is down.',
              correlation_id: 'corr-42',
              fields: [],
            },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    await act(async () => {
      renderAt('/');
    });
    await waitFor(() => {
      expect(screen.getByTestId('status-error')).toBeTruthy();
    });
    expect(screen.getByText('Status service is down.')).toBeTruthy();
    expect(screen.getByText('Reference: corr-42')).toBeTruthy();
  });

  it('renders the not-found page for an unknown route', async () => {
    await act(async () => {
      renderAt('/does-not-exist');
    });
    expect(screen.getByTestId('not-found-page')).toBeTruthy();
  });

  it('puts a skip link and a main landmark on every page', async () => {
    vi.stubGlobal('fetch', mockFetch);
    await act(async () => {
      renderAt('/app/demo');
    });
    const skip = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skip.getAttribute('href')).toBe('#main-content');
    expect(screen.getByRole('main').id).toBe('main-content');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });

  it('mock fetch serves fixtures and rejects unknown writes', async () => {
    const ok = await mockFetch('http://mock.invalid/api/kpis');
    expect(ok.status).toBe(200);
    const write = await mockFetch('http://mock.invalid/api/charter', { method: 'DELETE' });
    expect(write.status).toBe(404);
  });
});
