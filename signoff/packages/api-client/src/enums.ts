/**
 * Domain enumerations matching signoff/agent/app/domain/enums.py.
 * Verified by signoff/scripts/check_enum_parity.py.
 */

export const VERDICTS = ['ALLOW', 'NEEDS_APPROVAL', 'DENY'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ACTION_TYPES = [
  'PROVIDE_EVIDENCE',
  'SEND_MESSAGE',
  'MAKE_OFFER',
  'ACCEPT_CLAIM',
  'ESCALATE',
  'APPEAL',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const DISPUTE_REASONS = [
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  'UNAUTHORISED',
  'CREDIT_NOT_PROCESSED',
  'DUPLICATE_TRANSACTION',
  'INCORRECT_AMOUNT',
  'PAYMENT_BY_OTHER_MEANS',
  'CANCELED_RECURRING_BILLING',
  'PROBLEM_WITH_REMITTANCE',
  'OTHER',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const DISPUTE_STATUSES = [
  'WAITING_FOR_SELLER_RESPONSE',
  'WAITING_FOR_BUYER_RESPONSE',
  'UNDER_REVIEW',
  'RESOLVED',
  'OPEN',
  'OTHER',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const EXECUTION_STATUSES = ['INTENDED', 'SENT', 'CONFIRMED', 'FAILED'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const JOB_KINDS = [
  'sync_dispute',
  'run_agent',
  'execute_decision',
  'reconcile',
  'expire_approvals',
] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPROVAL_RESOLUTIONS = ['PENDING', 'APPROVE', 'DENY', 'EDIT', 'EXPIRED'] as const;
export type ApprovalResolution = (typeof APPROVAL_RESOLUTIONS)[number];

export const TIMELINE_EVENT_KINDS = [
  'WEBHOOK_RECEIVED',
  'DISPUTE_SYNCED',
  'RUN_STARTED',
  'EVIDENCE_BUILT',
  'PLAN_PROPOSED',
  'GATE_DECIDED',
  'APPROVAL_REQUESTED',
  'APPROVAL_RESOLVED',
  'EXECUTION_INTENDED',
  'EXECUTION_SENT',
  'EXECUTION_CONFIRMED',
  'EXECUTION_FAILED',
  'INJECTION_FLAGGED',
  'NO_ACTION',
  'RUN_FAILED',
] as const;
export type TimelineEventKind = (typeof TIMELINE_EVENT_KINDS)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRACKING_STATUSES = [
  'PRE_TRANSIT',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'EXCEPTION',
] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const EVIDENCE_STRENGTH_LABELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type EvidenceStrengthLabel = (typeof EVIDENCE_STRENGTH_LABELS)[number];

export const LLM_MODES = ['LIVE', 'CACHED', 'UNAVAILABLE'] as const;
export type LLMMode = (typeof LLM_MODES)[number];

export const SCENARIO_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];
