let csrfToken: string | null = null;

export function setCsrfToken(value: string | null): void {
  csrfToken = value;
}

export const sessionFetch: typeof fetch = async (input, options) => {
  const headers = new Headers(options?.headers);
  const method = (options?.method ?? 'GET').toUpperCase();
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await globalThis.fetch(input, { ...options, headers, credentials: 'include' });
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (response.status === 401 && !url.includes('/api/auth/')) {
    window.dispatchEvent(new Event('signoff:unauthenticated'));
  }
  return response;
};
