import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/client';

describe('SignoffApiClient', () => {
  it('handles successful 200 JSON responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', environment: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.getStatus();
    expect(res.success).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: 'ok', environment: 'test' });
    expect(res.error).toBeNull();
  });

  it('handles 204 No Content responses without failing', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.request('/api/reset', { method: 'POST' });
    expect(res.success).toBe(true);
    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
  });

  it('handles 200 responses with empty bodies', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('', {
        status: 200,
      })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.request('/api/empty', { method: 'GET' });
    expect(res.success).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
  });

  it('classifies proxy 502 HTML error pages as non_json error kind', async () => {
    const htmlBody = '<html><body>502 Bad Gateway: nginx proxy failure</body></html>';
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(htmlBody, {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.getStatus();
    expect(res.success).toBe(false);
    expect(res.status).toBe(502);
    expect(res.data).toBeNull();
    expect(res.error).not.toBeNull();
    expect(res.error?.kind).toBe('non_json');
    if (res.error?.kind === 'non_json') {
      expect(res.error.status).toBe(502);
      expect(res.error.bodyText).toBe(htmlBody);
      expect(res.error.statusText).toBe('Bad Gateway');
    }
  });

  it('classifies standard error envelopes as api_envelope error kind', async () => {
    const envelope = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid dispute reason provided',
        correlation_id: 'corr-12345',
        fields: [{ path: 'reason', message: 'Unsupported reason' }],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(envelope), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.request('/api/disputes', { method: 'POST', body: {} });
    expect(res.success).toBe(false);
    expect(res.status).toBe(422);
    expect(res.data).toBeNull();
    expect(res.error?.kind).toBe('api_envelope');
    if (res.error?.kind === 'api_envelope') {
      expect(res.error.status).toBe(422);
      expect(res.error.error.code).toBe('VALIDATION_FAILED');
      expect(res.error.error.correlation_id).toBe('corr-12345');
      expect(res.error.error.fields).toHaveLength(1);
    }
  });

  it('classifies network connection failures as network error kind', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch: ECONNREFUSED'));

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.getStatus();
    expect(res.success).toBe(false);
    expect(res.status).toBe(0);
    expect(res.data).toBeNull();
    expect(res.error?.kind).toBe('network');
    if (res.error?.kind === 'network') {
      expect(res.error.message).toContain('Failed to fetch: ECONNREFUSED');
    }
  });

  it('classifies request timeouts as network error kind', async () => {
    const mockFetch = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            const err = new Error('The operation was aborted due to timeout');
            err.name = 'TimeoutError';
            reject(err);
          }, 50);
        })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      defaultTimeoutMs: 20,
      fetch: mockFetch,
    });

    const res = await client.getStatus();
    expect(res.success).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error?.kind).toBe('network');
  });

  it('classifies 404 response with content-length 0 as non_json error, not success', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Length': '0' },
      })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch,
    });

    const res = await client.request('/api/missing');
    expect(res.success).toBe(false);
    expect(res.status).toBe(404);
    expect(res.error?.kind).toBe('non_json');
  });

  it('still enforces timeout when caller provides custom signal', async () => {
    const callerController = new AbortController();
    const mockFetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          if (init.signal) {
            init.signal.addEventListener('abort', () => {
              reject(new Error('Operation aborted'));
            });
          }
        })
    );

    const client = createApiClient({
      baseUrl: 'http://localhost:8000',
      defaultTimeoutMs: 30,
      fetch: mockFetch,
    });

    const res = await client.request('/api/slow', {
      signal: callerController.signal,
    });
    expect(res.success).toBe(false);
    expect(res.error?.kind).toBe('network');
  });
});
