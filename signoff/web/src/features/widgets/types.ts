import type { components } from '@signoff/api-client/generated';
import type { Verdict } from '@signoff/api-client';

export type Charter = components['schemas']['CharterResponse'];
export type DisputeItem = components['schemas']['DisputeListItem'];
export type ApiTimelineEvent = components['schemas']['TimelineResponse']['items'][number];

const CENTS = /^(0|[1-9]\d*)\.(\d{2})$/;

export function dollarsToCents(value: string): number {
  const match = CENTS.exec(value);
  if (!match) {
    return 0;
  }
  return Number(match[1] ?? '0') * 100 + Number(match[2] ?? '00');
}

export function formatCents(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const whole = Math.floor(safe / 100);
  const fraction = String(safe % 100).padStart(2, '0');
  return `$${whole}.${fraction}`;
}

// --- Deadline Radar ---

export interface DeadlineItem {
  id: string;
  reason: string;
  amountCents: number;
  currency: string;
  dueAt: string | null;
  verdict: Verdict | null;
}

export type DeadlineUrgency = 'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NONE';

export const DEADLINE_LABELS: Record<DeadlineUrgency, { icon: string; label: string }> = {
  OVERDUE: { icon: '!', label: 'Overdue' },
  DUE_SOON: { icon: '⏰', label: 'Due within 48 hours' },
  SCHEDULED: { icon: '•', label: 'Scheduled' },
  NONE: { icon: '–', label: 'No deadline' },
};

export function classifyDeadline(dueAt: string | null, now: Date): DeadlineUrgency {
  if (dueAt === null) {
    return 'NONE';
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return 'NONE';
  }
  const remaining = due.getTime() - now.getTime();
  if (remaining < 0) {
    return 'OVERDUE';
  }
  if (remaining <= 48 * 3_600_000) {
    return 'DUE_SOON';
  }
  return 'SCHEDULED';
}

export function toDeadlineItems(items: readonly DisputeItem[]): DeadlineItem[] {
  return items.map((item) => ({
    id: item.id,
    reason: item.reason,
    amountCents: dollarsToCents(item.amount.value),
    currency: item.amount.currency_code,
    dueAt: item.seller_response_due_date ?? null,
    verdict: item.latest_verdict ?? null,
  }));
}

// --- Authority Meter ---

export type AuthorityMeterId = 'auto_offer_max' | 'auto_accept_max' | 'auto_act_max_dispute_amount';

export interface AuthorityMeterDatum {
  id: AuthorityMeterId;
  label: string;
  limitCents: number;
  usedCents: number;
  note: string;
}

export function toAuthorityMeters(
  charter: Charter,
  items: readonly DisputeItem[]
): AuthorityMeterDatum[] {
  const openAmounts = items
    .filter((item) => item.status !== 'RESOLVED')
    .map((item) => dollarsToCents(item.amount.value));
  const largestOpen = openAmounts.length > 0 ? Math.max(...openAmounts) : 0;

  return [
    {
      id: 'auto_act_max_dispute_amount',
      label: 'Autonomous dispute size',
      limitCents: dollarsToCents(charter.auto_act_max_dispute_amount.value),
      usedCents: largestOpen,
      note: 'Largest open dispute against the size limit',
    },
    {
      id: 'auto_offer_max',
      label: 'Auto-offer ceiling',
      limitCents: dollarsToCents(charter.auto_offer_max.value),
      usedCents: 0,
      note: 'No offers recorded in this view',
    },
    {
      id: 'auto_accept_max',
      label: 'Auto-accept ceiling',
      limitCents: dollarsToCents(charter.auto_accept_max.value),
      usedCents: 0,
      note: 'No accepted claims recorded in this view',
    },
  ];
}

export function usagePercent(datum: AuthorityMeterDatum): number {
  if (datum.limitCents <= 0) {
    return datum.usedCents > 0 ? 100 : 0;
  }
  return Math.round((datum.usedCents / datum.limitCents) * 100);
}

// --- Decision Timeline ---

export interface TimelineWidgetItem {
  id: string;
  sequence: number;
  kind: string;
  title: string;
  detail: string;
  at: string;
  verdict: string | null;
}

const TIMELINE_TITLES: Record<string, string> = {
  WEBHOOK_RECEIVED: 'Webhook received',
  DISPUTE_SYNCED: 'Dispute synced',
  RUN_STARTED: 'Agent run started',
  EVIDENCE_BUILT: 'Evidence gathered',
  PLAN_PROPOSED: 'Plan proposed',
  GATE_DECIDED: 'Gate decided',
  APPROVAL_REQUESTED: 'Approval requested',
  APPROVAL_RESOLVED: 'Approval resolved',
  EXECUTION_INTENDED: 'Execution intended',
  EXECUTION_SENT: 'Execution sent',
  EXECUTION_CONFIRMED: 'Execution confirmed',
  EXECUTION_FAILED: 'Execution failed',
  INJECTION_FLAGGED: 'Injection flagged',
  NO_ACTION: 'No action taken',
  RUN_FAILED: 'Run failed',
};

function readField(event: ApiTimelineEvent, key: string): string | null {
  if (!(key in event)) {
    return null;
  }
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(event));
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function timelineDetail(event: ApiTimelineEvent): string {
  const value = (key: string): string => readField(event, key) ?? 'unknown';
  switch (event.kind) {
    case 'DISPUTE_SYNCED':
      return `Status ${value('status')}.`;
    case 'EVIDENCE_BUILT':
      return `Evidence strength ${value('evidence_strength')}.`;
    case 'PLAN_PROPOSED':
      return `Proposed ${value('action_type')}.`;
    case 'GATE_DECIDED':
      return `Rule ${value('rule_id')} decided ${value('verdict')}.`;
    case 'APPROVAL_REQUESTED':
      return 'Approval card created for a human.';
    case 'APPROVAL_RESOLVED':
      return `Resolution: ${value('resolution')}.`;
    case 'EXECUTION_CONFIRMED':
      return `PayPal acknowledged ${value('external_id')}.`;
    case 'EXECUTION_FAILED':
      return `Execution failed: ${value('error_message')}.`;
    case 'INJECTION_FLAGGED':
      return `Injection rule ${value('rule_id')} triggered; no mutation allowed.`;
    case 'NO_ACTION':
      return value('reason');
    case 'RUN_FAILED':
      return `Run failed: ${value('error')}.`;
    default:
      return 'Recorded in the audit log.';
  }
}

export function toTimelineWidgetItems(events: readonly ApiTimelineEvent[]): TimelineWidgetItem[] {
  return [...events]
    .sort((left, right) => left.sequence_number - right.sequence_number)
    .map((event) => ({
      id: event.id,
      sequence: event.sequence_number,
      kind: event.kind,
      title: TIMELINE_TITLES[event.kind] ?? `Event: ${event.kind}`,
      detail: timelineDetail(event),
      at: event.created_at,
      verdict: event.kind === 'GATE_DECIDED' ? readField(event, 'verdict') : null,
    }));
}

// --- Studio registration metadata ---

export interface WidgetDescriptor {
  id: string;
  title: string;
  assistantDescription: string;
  dataShape: string;
}

export const STUDIO_WIDGET_DESCRIPTIONS = [
  {
    id: 'signoff-decision-timeline',
    title: 'Decision Timeline',
    assistantDescription:
      'Shows the ordered audit trail for one dispute, from webhook to confirmation.',
    dataShape:
      '{ id: string; sequence: number; kind: string; title: string; detail: string; at: string; verdict: string | null }[]',
  },
  {
    id: 'signoff-deadline-radar',
    title: 'Deadline Radar',
    assistantDescription:
      'Shows disputes by time remaining until the seller response deadline, including past-due items.',
    dataShape:
      '{ id: string; reason: string; amountCents: number; currency: string; dueAt: string | null; verdict: string | null }[]',
  },
  {
    id: 'signoff-authority-meter',
    title: 'Authority Meter',
    assistantDescription:
      'Shows each charter limit against observed usage; values above 100% are labelled over limit.',
    dataShape:
      '{ id: string; label: string; limitCents: number; usedCents: number; note: string }[]',
  },
] as const satisfies readonly WidgetDescriptor[];
