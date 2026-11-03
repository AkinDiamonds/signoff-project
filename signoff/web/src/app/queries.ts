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
  return useQuery<StatusView, ApiQueryError>({
    queryKey: ['status'],
    queryFn: async () => readStatus(await unwrap(apiClient.getStatus())),
  });
}


export type DisputesResponse = components['schemas']['DisputesResponse'];
export type DisputeDetailResponse = components['schemas']['DisputeDetailResponse'] & {
  approval_url?: string | null;
};
export type TimelineResponse = components['schemas']['TimelineResponse'];
export type EvidenceSnapshotResponse = components['schemas']['EvidenceSnapshotResponse'];
export type ApprovalCardResponse = components['schemas']['ApprovalCardResponse'];

export type DisputesQuery = NonNullable<
  Parameters<typeof apiClient.getDisputes>[0]
>;

export function useDisputes(params?: DisputesQuery, demoSession?: string | null) {
  return useQuery<DisputesResponse, ApiQueryError>({
    queryKey: ['disputes', params, demoSession],
    queryFn: async (): Promise<DisputesResponse> => unwrap(apiClient.getDisputes(params, demoSession)),
    refetchInterval: 10_000,
  });
}

export function useDispute(id: string, options?: { refetchInterval?: number }) {
  return useQuery<DisputeDetailResponse, ApiQueryError>({
    queryKey: ['dispute', id],
    queryFn: async (): Promise<DisputeDetailResponse> => unwrap(apiClient.getDispute(id)),
    enabled: Boolean(id),
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}

export function useDisputeTimeline(id: string, options?: { refetchInterval?: number }) {
  return useQuery<TimelineResponse, ApiQueryError>({
    queryKey: ['dispute-timeline', id],
    queryFn: async (): Promise<TimelineResponse> => {
      const items: TimelineResponse['items'] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      for (let page = 0; page < 10; page += 1) {
        const result = await unwrap(apiClient.getDisputeTimeline(id, { limit: 100, ...(cursor ? { cursor } : {}) }));
        items.push(...result.items);
        if (!result.next_cursor) return { items, next_cursor: null };
        if (seen.has(result.next_cursor)) throw new ApiQueryError('Timeline pagination did not advance', null);
        seen.add(result.next_cursor);
        cursor = result.next_cursor;
      }
      throw new ApiQueryError('Timeline is too long to display completely', null);
    },
    enabled: Boolean(id),
    ...(options?.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}

export function useEvidenceSnapshots(id: string) {
  return useQuery<EvidenceSnapshotResponse[], ApiQueryError>({
    queryKey: ['dispute-evidence', id],
    queryFn: async () => {
      const data = await unwrap(apiClient.request<EvidenceSnapshotResponse[]>('/api/disputes/{id}/evidence', {
        params: { path: { id } },
      }));
      if (!Array.isArray(data)) throw new ApiQueryError('Invalid evidence response', null);
      return data;
    },
    enabled: Boolean(id), retry: false,
  });
}

export function useApprovalCard(token: string, ownerCard = false) {
  return useQuery<ApprovalCardResponse, ApiQueryError>({
    queryKey: ['approval-card', ownerCard, token],
    queryFn: async (): Promise<ApprovalCardResponse> => ownerCard
      ? unwrap(apiClient.request<ApprovalCardResponse>('/api/approvals/cards/{approval_id}', { params: { path: { approval_id: token } } }))
      : unwrap(apiClient.getApprovalCard(token)),
    enabled: Boolean(token),
    retry: false,
    refetchInterval: ownerCard ? 10_000 : false,
  });
}

export type ResolveApprovalBody = Parameters<typeof apiClient.resolveApproval>[1];

export async function resolveApprovalCall(token: string, body: ResolveApprovalBody, ownerCard = false) {
  return ownerCard
    ? unwrap(apiClient.request<components['schemas']['ResolveResponse']>('/api/approvals/cards/{approval_id}/resolve', { method: 'POST', params: { path: { approval_id: token } }, body }))
    : unwrap(apiClient.resolveApproval(token, body));
}
