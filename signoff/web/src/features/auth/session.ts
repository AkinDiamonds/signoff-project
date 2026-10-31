import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';
import { setCsrfToken } from '../../app/sessionTransport';

export interface OwnerSession {
  required: boolean;
  configured: boolean;
  authenticated: boolean;
  email: string | null;
  csrf_token: string | null;
  expires_at: string | null;
}

function readSession(data: unknown): OwnerSession {
  if (!data || typeof data !== 'object' || !('required' in data) || typeof data.required !== 'boolean'
    || !('authenticated' in data) || typeof data.authenticated !== 'boolean'
    || !('configured' in data) || typeof data.configured !== 'boolean') {
    throw new Error('Could not verify your sign-in status. Please try again.');
  }
  const csrf = 'csrf_token' in data && typeof data.csrf_token === 'string' ? data.csrf_token : null;
  if (data.required && data.authenticated && !csrf) throw new Error('Could not verify your session. Sign in again.');
  return {
    required: data.required, configured: data.configured, authenticated: data.authenticated,
    csrf_token: csrf,
    email: 'email' in data && typeof data.email === 'string' ? data.email : null,
    expires_at: 'expires_at' in data && typeof data.expires_at === 'string' ? data.expires_at : null,
  };
}

export function useOwnerSession() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['owner-session'],
    queryFn: async () => readSession(await unwrap(apiClient.request<unknown>('/api/auth/session'))),
    retry: false,
    staleTime: 30_000,
  });
  useEffect(() => { setCsrfToken(query.data?.csrf_token ?? null); }, [query.data]);
  useEffect(() => {
    const expired = () => { void client.invalidateQueries({ queryKey: ['owner-session'] }); };
    window.addEventListener('signoff:unauthenticated', expired);
    return () => window.removeEventListener('signoff:unauthenticated', expired);
  }, [client]);
  return query;
}

export async function signIn(email: string, password: string): Promise<OwnerSession> {
  const result = readSession(await unwrap(apiClient.request<unknown>('/api/auth/login', {
    method: 'POST', body: { email, password },
  })));
  setCsrfToken(result.csrf_token);
  const retained = readSession(await unwrap(apiClient.request<unknown>('/api/auth/session')));
  if (!retained.authenticated) throw new Error('Your browser could not keep this session. Allow this site’s cookies and try again.');
  setCsrfToken(retained.csrf_token);
  return retained;
}

export async function signOut(): Promise<void> {
  const response = await apiClient.request<unknown>('/api/auth/logout', { method: 'POST' });
  if (!response.success) throw new Error('Could not sign out. Please try again.');
  setCsrfToken(null);
}

export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && (value === '/app' || value.startsWith('/app/') || value.startsWith('/approve/'))
    ? value : '/app';
}
