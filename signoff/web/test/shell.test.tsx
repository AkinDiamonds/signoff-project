// @vitest-environment jsdom
import React from 'react';
import { transferableAbortController } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { mockFetch } from '../src/app/mockFetch';
import { statusFixture } from '../../fixtures/ui';

function renderAt(path: string, initialEntries = [path]) {
  vi.stubGlobal('AbortController', function () { return transferableAbortController(); });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return router;
}

describe('web shell', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('redirects root to the merchant app and replaces the history entry', async () => {
    vi.stubGlobal('fetch', mockFetch);
    const router = renderAt('/', ['/landingpage', '/']);
    await screen.findByTestId('shell-topbar');
    expect(router.state.location.pathname).toBe('/app');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByTestId('landing-page')).toBeNull();
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe('/landingpage');
    expect(await screen.findByTestId('landing-page')).toBeTruthy();
  });

  it('keeps the landing page public at /landingpage', async () => {
    vi.stubGlobal('fetch', mockFetch);
    const router = renderAt('/landingpage');
    expect(await screen.findByTestId('landing-page')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/landingpage');
    expect(screen.queryByTestId('shell-topbar')).toBeNull();
    expect(screen.getByTestId('nav-open-dashboard')).toHaveAttribute('href', '/app');
  });

  it('keeps the existing sign-in guard when entering through root', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      required: true, configured: true, authenticated: false,
      email: null, csrf_token: null, expires_at: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const router = renderAt('/');
    await screen.findByRole('heading', { name: /Sign in to Signoff/ });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toEqual({ returnTo: '/app' });
    expect(screen.queryByTestId('shell-topbar')).toBeNull();
    expect(screen.queryByTestId('landing-page')).toBeNull();
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
      renderAt('/landingpage');
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
      renderAt('/landingpage');
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

  it('links the shop row on Home to the hosted buyer shop', async () => {
    vi.stubGlobal('fetch', mockFetch);
    await act(async () => {
      renderAt('/app');
    });
    const shop = await screen.findByRole('link', { name: 'Signoff Shop' });
    expect(shop.getAttribute('href')).toBe('https://signoff-shop.onrender.com/');
    expect(shop.getAttribute('target')).toBe('_blank');
  });

  it('mock fetch serves fixtures and rejects unknown writes', async () => {
    const ok = await mockFetch('http://mock.invalid/api/kpis');
    expect(ok.status).toBe(200);
    const write = await mockFetch('http://mock.invalid/api/charter', { method: 'DELETE' });
    expect(write.status).toBe(404);
  });
});
