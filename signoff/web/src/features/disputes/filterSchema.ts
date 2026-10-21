export interface DisputeFilters {
  status: string;
  reason: string;
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

export const VALID_STATUSES = [
  'ALL',
  'WAITING_FOR_SELLER_RESPONSE',
  'WAITING_FOR_BUYER_RESPONSE',
  'UNDER_REVIEW',
  'RESOLVED',
  'OTHER',
] as const;

export const VALID_REASONS = [
  'ALL',
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  'UNAUTHORISED',
  'INQUIRY',
  'OTHER',
] as const;

export const VALID_SCOPES = ['mine', 'all'] as const;

export function parseDisputeFilters(searchParams: URLSearchParams): DisputeFilters {
  const rawStatus = searchParams.get('status');
  const status = VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
    ? (rawStatus as string)
    : DEFAULT_DISPUTE_FILTERS.status;

  const rawReason = searchParams.get('reason');
  const reason = VALID_REASONS.includes(rawReason as (typeof VALID_REASONS)[number])
    ? (rawReason as string)
    : DEFAULT_DISPUTE_FILTERS.reason;

  const rawScope = searchParams.get('scope');
  const scope: 'mine' | 'all' = VALID_SCOPES.includes(rawScope as (typeof VALID_SCOPES)[number])
    ? (rawScope as 'mine' | 'all')
    : DEFAULT_DISPUTE_FILTERS.scope;

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
