import { useQuery } from '@tanstack/react-query';
import type { ApiClientError, ClientResponse } from '@signoff/api-client';
import { apiClient } from './api';

export class ApiQueryError extends Error {
  readonly correlationId: string | null;

  constructor(message: string, correlationId: string | null) {
    super(message);
    this.name = 'ApiQueryError';
    this.correlationId = correlationId;
  }
}

function describeError(error: ApiClientError | null): ApiQueryError {
  if (error === null) {
    return new ApiQueryError('The server returned an empty response.', null);
  }
  switch (error.kind) {
    case 'network':
      return new ApiQueryError('Could not reach the server. Check your connection and try again.', null);
    case 'api_envelope':
      return new ApiQueryError(error.error.message, error.error.correlation_id);
    case 'non_json':
      return new ApiQueryError('The server sent an unexpected response.', null);
  }
}

async function unwrap<T>(call: Promise<ClientResponse<T>>): Promise<T> {
  const res = await call;
  if (res.success && res.data !== null) {
    return res.data;
  }
  throw describeError(res.error);
}

export interface StatusView {
  env: string;
  paypalEnv: string;
  llmMode: string;
  demoFrozen: boolean;
}

function readStatus(data: Record<string, unknown>): StatusView {
  return {
    env: typeof data.env === 'string' ? data.env : 'unknown',
    paypalEnv: typeof data.paypal_env === 'string' ? data.paypal_env : 'unknown',
    llmMode: typeof data.llm_mode === 'string' ? data.llm_mode : 'UNKNOWN',
    demoFrozen: data.demo_frozen === true,
  };
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: async () => readStatus(await unwrap(apiClient.getStatus())),
  });
}
