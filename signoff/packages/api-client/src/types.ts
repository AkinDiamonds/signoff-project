/**
 * Domain types and branded types for @signoff/api-client.
 * Enforces compile-time type safety across API boundaries.
 */

import type {
  ActionType,
  DisputeReason,
  DisputeStatus,
  EvidenceStrengthLabel,
  LLMMode,
  OrderStatus,
  ScenarioId,
  TimelineEventKind,
  TrackingStatus,
  Verdict,
} from './enums';

// --- Branded Types ---

declare const MoneyBrand: unique symbol;
export type Money = {
  readonly value: string;
  readonly currency_code: 'USD';
  readonly [MoneyBrand]: true;
};

declare const DisputeIdBrand: unique symbol;
export type DisputeId = string & { readonly [DisputeIdBrand]: true };

declare const ApprovalTokenBrand: unique symbol;
export type ApprovalToken = string & { readonly [ApprovalTokenBrand]: true };

declare const OrderCodeBrand: unique symbol;
export type OrderCode = string & { readonly [OrderCodeBrand]: true };

declare const SessionIdBrand: unique symbol;
export type SessionId = string & { readonly [SessionIdBrand]: true };

// --- Rule IDs ---

// Format: G<step>-<nn> (e.g. G1-01, G12-15) per CONVENTIONS.md §12.
// Two-digit suffix is intentional — matches Zod ruleIdSchema and gate spec rule IDs.
export type RuleId =
  | `G${number}-${number}${number}`
  | 'A-01'
  | 'EXEC-STALE'
  | 'EXEC-FAILED';

// --- Request / Response Shapes ---

export type ResolveAction = 'APPROVE' | 'DENY' | 'EDIT';

export type ResolveRequest =
  | { action: 'APPROVE' }
  | { action: 'DENY'; reason?: string }
  | ({ action: 'EDIT' } & (
      | { amount: Money; message?: string }
      | { amount?: Money; message: string }
    ));

export interface CreateOrderRequest {
  sku: string;
  quantity: number;
}

export type SupportedDisputeReason = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';

export interface CreateDisputeRequest {
  order_code: OrderCode;
  reason: SupportedDisputeReason;
  amount: Money;
  buyer_message?: string;
}

// Ensure server-owned fields never appear in client requests
export type ServerOwnedKeys = 'verdict' | 'rule_id' | 'fingerprint';

// --- Timeline Events ---

export interface BaseTimelineEvent {
  id: string;
  dispute_id: DisputeId;
  created_at: string;
}

export type TimelineEvent =
  | (BaseTimelineEvent & { kind: 'WEBHOOK_RECEIVED'; payload: Record<string, unknown> })
  | (BaseTimelineEvent & { kind: 'DISPUTE_SYNCED'; status: DisputeStatus })
  | (BaseTimelineEvent & { kind: 'RUN_STARTED'; run_id: string })
  | (BaseTimelineEvent & { kind: 'EVIDENCE_BUILT'; evidence_strength: EvidenceStrengthLabel })
  | (BaseTimelineEvent & { kind: 'PLAN_PROPOSED'; action_type: ActionType })
  | (BaseTimelineEvent & { kind: 'GATE_DECIDED'; verdict: Verdict; rule_id: RuleId })
  | (BaseTimelineEvent & { kind: 'APPROVAL_REQUESTED'; token_hash: string })
  | (BaseTimelineEvent & { kind: 'APPROVAL_RESOLVED'; resolution: string })
  | (BaseTimelineEvent & { kind: 'EXECUTION_INTENDED'; action_type: ActionType })
  | (BaseTimelineEvent & { kind: 'EXECUTION_SENT'; payload: Record<string, unknown> })
  | (BaseTimelineEvent & { kind: 'EXECUTION_CONFIRMED'; external_id: string })
  | (BaseTimelineEvent & { kind: 'EXECUTION_FAILED'; error_message: string })
  | (BaseTimelineEvent & { kind: 'INJECTION_FLAGGED'; rule_id: RuleId })
  | (BaseTimelineEvent & { kind: 'NO_ACTION'; reason: string })
  | (BaseTimelineEvent & { kind: 'RUN_FAILED'; error: string });

// --- Assistant Tools (Constant read-only list per contracts) ---

export const ASSISTANT_TOOLS = [
  'query_disputes',
  'get_dispute_details',
  'get_kpis',
  'get_charter',
] as const;

export type AssistantTool = (typeof ASSISTANT_TOOLS)[number];

// --- Widget Configurations ---

export interface StatusBadgeWidgetConfig {
  verdict: Verdict;
  evidenceStrength: EvidenceStrengthLabel;
}

export interface DisputeRowWidgetConfig {
  id: DisputeId;
  reason: DisputeReason;
  amount: Money;
  verdict: Verdict;
}

// Re-export enums
export type {
  ActionType,
  DisputeReason,
  DisputeStatus,
  EvidenceStrengthLabel,
  LLMMode,
  OrderStatus,
  ScenarioId,
  TimelineEventKind,
  TrackingStatus,
  Verdict,
};
