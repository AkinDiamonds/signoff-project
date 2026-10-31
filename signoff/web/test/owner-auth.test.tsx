// @vitest-environment jsdom
import React from 'react';
import { transferableAbortController } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { LoginPage } from '../src/features/auth/LoginPage';
import { RequireMerchant } from '../src/features/auth/RequireMerchant';
import { safeReturnPath } from '../src/features/auth/session';
import { setCsrfToken } from '../src/app/sessionTransport';
import { apiClient } from '../src/app/api';

const clients: QueryClient[] = [];
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
function show(path = '/login', state: unknown = null) {
  // React Router constructs Node's Request in jsdom. Keep real cancellation with
  // Node-compatible signals rather than mixing jsdom and undici signal brands.
  vi.stubGlobal('AbortController', function () { return transferableAbortController(); });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const router = createMemoryRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '/app', element: <RequireMerchant><h1>Private workspace</h1></RequireMerchant> },
  ], { initialEntries: [{ pathname: path, state }] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}
function mockSession({ reject = false, retain = true, configured = true } = {}) {
  let signedIn = false;
  const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/api/auth/login')) {
      if (reject) return reply({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect', correlation_id: 'fixture' } }, 401);
      signedIn = true;
      return reply({ required: true, configured, authenticated: true, email: 'owner@example.test', csrf_token: 'fixture-csrf', expires_at: null });
    }
    if (url.endsWith('/api/auth/session')) return reply({
      required: true, configured, authenticated: signedIn && retain,
      email: signedIn ? 'owner@example.test' : null, csrf_token: signedIn && retain ? 'fixture-csrf' : null, expires_at: null,
    });
    if (options?.method === 'PUT') return new Response(null, { status: 204 });
    return reply({}, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; setCsrfToken(null); vi.unstubAllGlobals(); });

async function submit() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'fictional-password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('owner sign-in', () => {
  it('redirects an anonymous merchant visitor to login', async () => {
    mockSession(); const router = show('/app');
    await screen.findByRole('heading', { name: /Your shop/ });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(/forgot password|sign up/i)).toBeNull();
  });
  it('retains the session and attaches CSRF to later writes', async () => {
    const fetcher = mockSession(); show(); await submit();
    await screen.findByRole('heading', { name: 'Private workspace' });
    await apiClient.request('/api/charter', { method: 'PUT', body: {} });
    const last = fetcher.mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(last?.[1]?.credentials).toBe('include');
    expect(new Headers(last?.[1]?.headers).get('X-CSRF-Token')).toBe('fixture-csrf');
    expect(localStorage.getItem('password')).toBeNull();
  });
  it('shows rejected credentials without navigating or claiming success', async () => {
    mockSession({ reject: true }); const router = show(); await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(router.state.location.pathname).toBe('/login');
  });
  it('explains when the browser does not retain the cookie', async () => {
    mockSession({ retain: false }); show(); await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your browser could not keep this session');
  });
  it('shows an unavailable state when owner access is not provisioned', async () => {
    mockSession({ configured: false }); show();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent('Sign-in is temporarily unavailable');
  });
  it('does not accept an external return URL', () => {
    expect(safeReturnPath('https://unrelated.invalid')).toBe('/app');
    expect(safeReturnPath('//unrelated.invalid')).toBe('/app');
    expect(safeReturnPath('/app/policy')).toBe('/app/policy');
  });
});
