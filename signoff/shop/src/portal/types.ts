/**
 * Type contracts for the Storefront Buyer Portal (Step 32).
 *
 * CRITICAL CONTRACTS:
 * - Supported reasons strictly limited to:
 *   'MERCHANDISE_OR_SERVICE_NOT_RECEIVED' | 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED'
 * - Amount is strictly typed as MoneyAmount ({ value: string, currency_code: string })
 * - Markup in messages is never rendered as HTML (plain text only)
 */

import type { MoneyAmount } from '@signoff/ui';

export type { MoneyAmount };

export type SupportedDisputeReason =
  | 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED'
  | 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';

export const SUPPORTED_REASON_LABELS: Record<SupportedDisputeReason, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: 'Item not received (Package missing or late)',
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: 'Item not as described (Damaged, wrong item, or defect)',
};

const SUPPORTED_DISPUTE_REASONS: readonly SupportedDisputeReason[] = [
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
];

export function isSupportedDisputeReason(value: string): value is SupportedDisputeReason {
  return SUPPORTED_DISPUTE_REASONS.some((reason) => reason === value);
}

export interface DisputeMessage {
  posted_by: 'BUYER' | 'SELLER' | string;
  time_posted: string;
  content: string;
}

export interface DisputeOffer {
  offer_type: string;
  amount: MoneyAmount;
  note?: string | null;
  status?: string | null;
}

export interface BuyerDisputeDetail {
  id: string;
  status: string;
  reason: string;
  amount: MoneyAmount;
  created_at: string;
  seller_response_due_date?: string | null;
  messages: DisputeMessage[];
  offer?: DisputeOffer | null;
  order_code: string;
  transaction_id: string;
}

export interface OrderDisputeStatus {
  order_code: string;
  dispute_eligible: boolean;
  ineligibility_reason?: string | null;
  dispute_exists: boolean;
  dispute?: BuyerDisputeDetail | null;
}

export interface CreateDisputePayload {
  customer_email: string;
  reason: SupportedDisputeReason;
  amount: MoneyAmount;
  message: string;
}

export interface SendMessagePayload {
  customer_email: string;
  message: string;
}

export interface OfferResponsePayload {
  customer_email: string;
  action: 'ACCEPT' | 'DENY';
}
