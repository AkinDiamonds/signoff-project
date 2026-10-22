import type { DisputeReason, DisputeStatus } from '@signoff/api-client';

export type StatusFilter = 'ALL' | DisputeStatus;
export type ReasonFilter = 'ALL' | DisputeReason;

export interface DisputeFilters {
  status: StatusFilter;
  reason: ReasonFilter;
  scope: 'mine' | 'all';
  cursor: string | null;
  limit: number;
}

export const DEFAULT_DISPUTE_FILTERS: DisputeFilters = {
  status: 'ALL',
  reason: 'ALL',
  scope: 'mine',
  cursor: null,
  limit: 10,
};

export const VALID_STATUSES: readonly StatusFilter[] = [
  'ALL',
  'WAITING_FOR_SELLER_RESPONSE',
  'WAITING_FOR_BUYER_RESPONSE',
  'UNDER_REVIEW',
  'RESOLVED',
  'OTHER',
];

export const VALID_REASONS: readonly ReasonFilter[] = [
  'ALL',
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  'UNAUTHORISED',
  'OTHER',
];

export const VALID_SCOPES = ['mine', 'all'] as const;

export function isStatusFilter(value: string): value is StatusFilter {
  return VALID_STATUSES.some((status) => status === value);
}

export function isReasonFilter(value: string): value is ReasonFilter {
  return VALID_REASONS.some((reason) => reason === value);
}

function isScope(value: string): value is 'mine' | 'all' {
  return VALID_SCOPES.some((scope) => scope === value);
}

export function parseDisputeFilters(searchParams: URLSearchParams): DisputeFilters {
  const rawStatus = searchParams.get('status');
  const status: StatusFilter =
    rawStatus !== null && isStatusFilter(rawStatus) ? rawStatus : DEFAULT_DISPUTE_FILTERS.status;

  const rawReason = searchParams.get('reason');
  const reason: ReasonFilter =
    rawReason !== null && isReasonFilter(rawReason) ? rawReason : DEFAULT_DISPUTE_FILTERS.reason;

  const rawScope = searchParams.get('scope');
  const scope: 'mine' | 'all' =
    rawScope !== null && isScope(rawScope) ? rawScope : DEFAULT_DISPUTE_FILTERS.scope;

  const rawCursor = searchParams.get('cursor');
  const cursor = rawCursor && rawCursor.trim() ? rawCursor.trim() : null;

  const rawLimit = Number(searchParams.get('limit'));
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100
    ? rawLimit
    : DEFAULT_DISPUTE_FILTERS.limit;

  return { status, reason, scope, cursor, limit };
}

export function filtersToSearchParams(filters: DisputeFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_DISPUTE_FILTERS.status) {
    params.set('status', filters.status);
  }
  if (filters.reason !== DEFAULT_DISPUTE_FILTERS.reason) {
    params.set('reason', filters.reason);
  }
  if (filters.scope !== DEFAULT_DISPUTE_FILTERS.scope) {
    params.set('scope', filters.scope);
  }
  if (filters.cursor) {
    params.set('cursor', filters.cursor);
  }
  if (filters.limit !== DEFAULT_DISPUTE_FILTERS.limit) {
    params.set('limit', String(filters.limit));
  }
  return params;
}
