import type { Money, ResolveRequest } from '@signoff/api-client';
import type { components } from '@signoff/api-client/generated';

export type ApprovalCardResponse = components['schemas']['ApprovalCardResponse'];

export type ApprovalOutcome =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'EXPIRED'
  | 'STALE'
  | 'ALREADY_RESOLVED'
  | 'INVALID_LINK'
  | 'OUTCOME_UNKNOWN';

export type EditRequestPayload =
  | { amount: Money; message?: string; notes?: string }
  | { amount?: Money; message: string; notes?: string };

/**
 * Builds a strictly typed ResolveRequest for EDIT actions.
 * Enforces compile-time and runtime guarantee that an edit with no fields cannot be created.
 */
export function buildEditResolveRequest(payload: EditRequestPayload): ResolveRequest {
  if (payload.amount && payload.message && payload.message.trim()) {
    return {
      action: 'EDIT',
      amount: payload.amount,
      message: payload.message.trim(),
    };
  }

  if (payload.amount) {
    return {
      action: 'EDIT',
      amount: payload.amount,
      ...(payload.message && payload.message.trim() ? { message: payload.message.trim() } : {}),
    };
  }

  if (payload.message && payload.message.trim()) {
    return {
      action: 'EDIT',
      message: payload.message.trim(),
    };
  }

  throw new Error('Edit action requires at least one of amount or message');
}

