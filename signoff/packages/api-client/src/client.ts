/**
 * Typed fetch client wrapper for Signoff API.
 * Returns three distinct error kinds: network, api_envelope, non_json.
 * Handles timeouts, 204 / empty responses, and proxy HTML errors.
 */

import type { paths } from './generated/schema';

export type ApiErrorKind = 'network' | 'api_envelope' | 'non_json';

export interface ApiNetworkError {
  kind: 'network';
  message: string;
  cause?: unknown;
}

export interface ApiEnvelopeError {
  kind: 'api_envelope';
  status: number;
  error: {
    code: string;
    message: string;
    correlation_id: string;
    fields?: Array<{ path: string; message: string }>;
  };
}

export interface ApiNonJsonError {
  kind: 'non_json';
  status: number;
  statusText: string;
  bodyText: string;
  message: string;
}

export type ApiClientError = ApiNetworkError | ApiEnvelopeError | ApiNonJsonError;

export interface ClientResponse<T> {
  success: boolean;
  status: number;
  data: T | null;
  error: ApiClientError | null;
}

export interface ClientOptions {
  baseUrl: string;
  defaultTimeoutMs?: number;
  fetch?: typeof fetch;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  params?: {
    query?: Record<string, string | number | boolean | undefined>;
    path?: Record<string, string | number>;
  };
}

export class SignoffApiClient {
  readonly baseUrl: string;
  readonly defaultTimeoutMs: number;
  private readonly customFetch?: typeof fetch | undefined;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
    this.customFetch = options.fetch;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<ClientResponse<T>> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let url = this.baseUrl
      ? `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
      : path;

    if (options.params?.path) {
      for (const [key, val] of Object.entries(options.params.path)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(val)));
      }
    }

    if (options.params?.query) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(options.params.query)) {
        if (val !== undefined) {
          searchParams.append(key, String(val));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers = new Headers(options.headers);
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        body = options.body;
      } else {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        body = JSON.stringify(options.body);
      }
    }

    let signal: AbortSignal = controller.signal;
    if (options.signal) {
      if (typeof AbortSignal.any === 'function') {
        signal = AbortSignal.any([options.signal, controller.signal]);
      } else if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), {
          once: true,
        });
      }
    }

    const reqInit: RequestInit = {
      headers,
      signal,
    };
    if (options.method !== undefined) {
      reqInit.method = options.method;
    }
    if (body !== undefined) {
      reqInit.body = body;
    }

    let res: Response;
    try {
      const fetchFn = this.customFetch ?? globalThis.fetch;
      res = await fetchFn(url, reqInit);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      return {
        success: false,
        status: 0,
        data: null,
        error: {
          kind: 'network',
          message: err instanceof Error ? err.message : 'Network request failed',
          cause: err,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // 204 No Content or empty successful responses
    if (res.status === 204 || (res.ok && res.headers.get('content-length') === '0')) {
      return {
        success: true,
        status: res.status,
        data: null,
        error: null,
      };
    }

    const rawText = await res.text();
    if (!rawText.trim()) {
      return {
        success: res.ok,
        status: res.status,
        data: null,
        error: res.ok
          ? null
          : {
              kind: 'non_json',
              status: res.status,
              statusText: res.statusText,
              bodyText: '',
              message: `Empty error response (HTTP ${res.status})`,
            },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        success: false,
        status: res.status,
        data: null,
        error: {
          kind: 'non_json',
          status: res.status,
          statusText: res.statusText,
          bodyText: rawText,
          message: `Received non-JSON response from server (HTTP ${res.status})`,
        },
      };
    }

    if (res.ok) {
      return {
        success: true,
        status: res.status,
        data: parsed as T,
        error: null,
      };
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      parsed.error &&
      typeof parsed.error === 'object' &&
      'code' in parsed.error &&
      'message' in parsed.error
    ) {
      const envelope = parsed as {
        error: {
          code: string;
          message: string;
          correlation_id: string;
          fields?: Array<{ path: string; message: string }>;
        };
      };
      return {
        success: false,
        status: res.status,
        data: null,
        error: {
          kind: 'api_envelope',
          status: res.status,
          error: envelope.error,
        },
      };
    }

    return {
      success: false,
      status: res.status,
      data: null,
      error: {
        kind: 'non_json',
        status: res.status,
        statusText: res.statusText,
        bodyText: rawText,
        message: `Error response did not match standard API error envelope (HTTP ${res.status})`,
      },
    };
  }

  // --- Strongly Typed Endpoints ---

  async getStatus(): Promise<
    ClientResponse<paths['/api/status']['get']['responses']['200']['content']['application/json']>
  > {
    return this.request<
      paths['/api/status']['get']['responses']['200']['content']['application/json']
    >('/api/status', { method: 'GET' });
  }

  async getHealthz(): Promise<
    ClientResponse<paths['/healthz']['get']['responses']['200']['content']['application/json']>
  > {
    return this.request<
      paths['/healthz']['get']['responses']['200']['content']['application/json']
    >('/healthz', { method: 'GET' });
  }

  async getReadyz(): Promise<
    ClientResponse<paths['/readyz']['get']['responses']['200']['content']['application/json']>
  > {
    return this.request<
      paths['/readyz']['get']['responses']['200']['content']['application/json']
    >('/readyz', { method: 'GET' });
  }
}

export function createApiClient(options: ClientOptions): SignoffApiClient {
  return new SignoffApiClient(options);
}
