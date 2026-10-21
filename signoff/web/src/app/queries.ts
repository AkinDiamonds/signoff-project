import { useQuery } from '@tanstack/react-query';
import type { ApiClientError, ClientResponse } from '@signoff/api-client';
import type { components } from '@signoff/api-client/generated';
import { apiClient } from './api';

export interface ApiFieldError {
  path: string;
  message: string;
}

export class ApiQueryError extends Error {
  readonly correlationId: string | null;
  readonly status: number;
  readonly code: string | null;
  readonly fields: readonly ApiFieldError[];

  constructor(
    message: string,
    correlationId: string | null,
    status = 0,
    code: string | null = null,
    fields: readonly ApiFieldError[] = []
  ) {
    super(message);
    this.name = 'ApiQueryError';
    this.correlationId = correlationId;
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function describeError(error: ApiClientError | null): ApiQueryError {
  if (error === null) {
    return new ApiQueryError('The server returned an empty response.', null);
  }
  switch (error.kind) {
    case 'network':
      return new ApiQueryError('Could not reach the server. Check your connection and try again.', null, 0, 'NETWORK');
    case 'api_envelope':
      return new ApiQueryError(
        error.error.message,
        error.error.correlation_id,
        error.status,
        error.error.code,
        error.error.fields ?? []
      );
    case 'non_json':
      return new ApiQueryError('The server sent an unexpected response.', null, error.status, 'NON_JSON');
  }
}

export async function unwrap<T>(call: Promise<ClientResponse<T>>): Promise<T> {
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


export type DisputesResponse = components['schemas']['DisputesResponse'];
export type DisputeDetailResponse = components['schemas']['DisputeDetailResponse'];
export type TimelineResponse = components['schemas']['TimelineResponse'];
export type ApprovalCardResponse = components['schemas']['ApprovalCardResponse'];

export type DisputesQuery = NonNullable<
  Parameters<typeof apiClient.getDisputes>[0]
>;

export function useDisputes(params?: DisputesQuery) {
  return useQuery({
    queryKey: ['disputes', params],
    queryFn: async (): Promise<DisputesResponse> => unwrap(apiClient.getDisputes(params)),
  });
}

export function useDispute(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['dispute', id],
    queryFn: async (): Promise<DisputeDetailResponse> => unwrap(apiClient.getDispute(id)),
    enabled: Boolean(id),
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}

export function useDisputeTimeline(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['dispute-timeline', id],
    queryFn: async (): Promise<TimelineResponse> => unwrap(apiClient.getDisputeTimeline(id)),
    enabled: Boolean(id),
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}

export function useApprovalCard(token: string) {
  return useQuery({
    queryKey: ['approval-card', token],
    queryFn: async (): Promise<ApprovalCardResponse> => unwrap(apiClient.getApprovalCard(token)),
    enabled: Boolean(token),
    retry: false,
  });
}

export type ResolveApprovalBody = Parameters<typeof apiClient.resolveApproval>[1];

export async function resolveApprovalCall(token: string, body: ResolveApprovalBody) {
  return unwrap(apiClient.resolveApproval(token, body));
}
