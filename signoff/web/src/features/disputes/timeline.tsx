import React from 'react';
import { VERDICTS } from '@signoff/api-client';
import type { Verdict } from '@signoff/api-client';
import { VerdictChip, colors, concept, formatEventTime, getRuleExplanation, radius, spacing, typography } from '@signoff/ui';
import type { ApiTimelineEvent } from './types';

function isVerdict(value: string): value is Verdict {
  return VERDICTS.some((verdict) => verdict === value);
}

const KNOWN_EVENT_KINDS = [
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

type KnownEventKind = (typeof KNOWN_EVENT_KINDS)[number];
type KnownTimelineEvent = Extract<ApiTimelineEvent, { kind: KnownEventKind }>;

function isKnownTimelineEvent(event: ApiTimelineEvent): event is KnownTimelineEvent {
  return KNOWN_EVENT_KINDS.some((kind) => kind === event.kind);
}

export function renderTimelineEventContent(event: KnownTimelineEvent): {
  title: string;
  badge?: React.ReactNode;
  details?: React.ReactNode;
} {
  switch (event.kind) {
    case 'WEBHOOK_RECEIVED':
      return {
        title: 'Webhook received',
        details: 'Received webhook notification from PayPal.',
      };
    case 'DISPUTE_SYNCED':
      return {
        title: 'Dispute synced',
        details: `Dispute record synced with status ${event.status}.`,
      };
    case 'RUN_STARTED':
      return {
        title: 'Agent run started',
        details: `Run session initialized (run ID: ${event.run_id}).`,
      };
    case 'EVIDENCE_BUILT':
      return {
        title: 'Evidence gathered',
        badge: (
          <span
            data-testid="evidence-strength-chip"
            style={{
              fontSize: typography.fontSizeSmall,
              padding: '2px 8px',
              borderRadius: radius.pill,
              backgroundColor: colors.badgeSuccessBg,
              color: colors.badgeSuccessText,
              fontWeight: typography.fontWeightSemibold,
              textTransform: 'uppercase',
            }}
          >
            {event.evidence_strength}
          </span>
        ),
        details: `Evidence pack compiled with ${event.evidence_strength} strength.`,
      };
    case 'PLAN_PROPOSED':
      return {
        title: 'Actions proposed',
        details: `Proposed action: ${event.action_type}. ${event.reasoning_source === 'cached' ? 'Cached reasoning.' : event.reasoning_source === 'provider' ? 'Provider response.' : 'Reasoning source unavailable.'}`,
      };
    case 'GATE_DECIDED':
      return {
        title: event.verdict === 'NEEDS_APPROVAL' ? 'Review required' : 'Gate decided',
        badge: (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {isVerdict(event.verdict) ? (
              <VerdictChip verdict={event.verdict} />
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{event.verdict}</span>
            )}
            <span
              title={getRuleExplanation(event.rule_id)}
              style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                backgroundColor: colors.surfaceSubtle,
                padding: '2px 6px',
                borderRadius: '4px',
                cursor: 'help',
                color: 'var(--signoff-ink, #252521)',
              }}
            >
              {event.rule_id}
            </span>
          </div>
        ),
        details: `Evaluated rule ${event.rule_id}: ${getRuleExplanation(event.rule_id)}.`,
      };
    case 'APPROVAL_REQUESTED':
      return {
        title: 'Review requested',
        details: 'Approval card created; waiting for merchant review.',
      };
    case 'APPROVAL_RESOLVED':
      return {
        title: 'Approval recorded',
        details: `Merchant resolution: ${event.resolution}.`,
      };
    case 'EXECUTION_INTENDED':
      return {
        title: 'Execution intended',
        details: `Preparing execution of ${event.action_type}.`,
      };
    case 'EXECUTION_SENT':
      return {
        title: 'Execution dispatched',
        details: 'Action dispatched to PayPal API.',
      };
    case 'EXECUTION_CONFIRMED':
      return {
        title: 'Confirmation recorded',
        details: 'Signoff recorded a confirmation. The PayPal action and outcome require independent verification.',
      };
    case 'EXECUTION_FAILED':
      return {
        title: 'Execution failed',
        details: `Execution error: ${event.error_message}`,
      };
    case 'INJECTION_FLAGGED':
      return {
        title: 'Prompt injection flagged',
        badge: (
          <span
            style={{
              fontSize: typography.fontSizeSmall,
              padding: '2px 8px',
              borderRadius: radius.pill,
              backgroundColor: colors.badgeCriticalBg,
              color: colors.badgeCriticalText,
              fontWeight: typography.fontWeightSemibold,
            }}
          >
            FLAGGED
          </span>
        ),
        details: `Potential prompt injection flagged under rule ${event.rule_id}.`,
      };
    case 'NO_ACTION':
      return {
        title: 'No action taken',
        details: event.reason === 'tracking_requires_review'
          ? 'Delivery evidence is missing or unsafe. Human review is required.'
          : event.reason === 'signing_policy_changed'
            ? 'Signing limits changed or are unavailable. No action was sent; review is required.'
          : `Reason: ${event.reason}`,
      };
    case 'RUN_FAILED':
      return {
        title: 'Run failed',
        details: `Error: ${event.error}`,
      };
    default: {
      const _exhaustiveCheck: never = event;
      void _exhaustiveCheck;
      return {
        title: 'Unknown event',
        details: 'Generic timeline event record.',
      };
    }
  }
}

export interface DecisionTimelineProps {
  events: ApiTimelineEvent[];
  reverse?: boolean;
}

const GREEN = '#2E9E5B';
const AMBER = '#E0A100';
const RED = '#C2362B';
const GRAY = '#B9B9B3';

function dotColor(event: ApiTimelineEvent): string {
  switch (event.kind) {
    case 'APPROVAL_RESOLVED': case 'EVIDENCE_BUILT': case 'EXECUTION_CONFIRMED': return GREEN;
    case 'APPROVAL_REQUESTED': case 'NO_ACTION': return AMBER;
    case 'GATE_DECIDED': return 'verdict' in event && event.verdict === 'NEEDS_APPROVAL' ? AMBER : GRAY;
    case 'EXECUTION_FAILED': case 'RUN_FAILED': case 'INJECTION_FLAGGED': return RED;
    default: return GRAY;
  }
}

/** Drops an event that repeats the previous one (same kind, minute and payload). */
function withoutAdjacentDuplicates(events: ApiTimelineEvent[]): ApiTimelineEvent[] {
  const signature = (event: ApiTimelineEvent) => {
    const payload = Object.fromEntries(Object.entries(event).filter(([key]) => !['id', 'sequence_number', 'created_at'].includes(key)));
    const minute = 'created_at' in event && typeof event.created_at === 'string' ? event.created_at.slice(0, 16) : '';
    return JSON.stringify([minute, payload]);
  };
  return events.filter((event, index) => {
    const previous = events[index - 1];
    return !previous || signature(event) !== signature(previous);
  });
}

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({ events, reverse = false }) => {
  const sorted = withoutAdjacentDuplicates([...events].sort((a, b) => {
    const seqA = 'sequence_number' in a && typeof a.sequence_number === 'number' ? a.sequence_number : 0;
    const seqB = 'sequence_number' in b && typeof b.sequence_number === 'number' ? b.sequence_number : 0;
    return reverse ? seqB - seqA : seqA - seqB;
  }));

  const actionsByAttempt = new Map<string, string>();
  for (const event of sorted) {
    if (event.kind === 'EXECUTION_INTENDED' && 'execution_id' in event && event.execution_id &&
        'action_type' in event && typeof event.action_type === 'string') {
      actionsByAttempt.set(event.execution_id, event.action_type.replaceAll('_', ' ').toLowerCase());
    }
  }

  if (sorted.length === 0) {
    return (
      <div data-testid="timeline-empty" style={{ padding: spacing[2], color: colors.inkMuted, fontSize: typography.fontSizeSmall }}>
        No timeline events recorded yet.
      </div>
    );
  }

  const rows = sorted.map((item, idx) => {
    let content: { title: string; badge?: React.ReactNode; details?: React.ReactNode } = isKnownTimelineEvent(item)
      ? renderTimelineEventContent(item)
      : { title: `Event: ${('kind' in item ? item.kind : 'UNKNOWN')}`, details: 'Event data recorded in dispute audit log.' };
    const attemptId = 'execution_id' in item && typeof item.execution_id === 'string' ? item.execution_id : null;
    const action = attemptId ? actionsByAttempt.get(attemptId) : undefined;
    if (action && item.kind !== 'EXECUTION_INTENDED') {
      content = { ...content, details: <><strong>{action[0]?.toUpperCase()}{action.slice(1)}.</strong> {content.details}</> };
    }
    const seqNum = 'sequence_number' in item ? item.sequence_number : idx + 1;
    return { item, content, attemptId, seqNum };
  });

  return (
    <>
      <ol
        data-testid="decision-timeline"
        style={{ listStyle: 'none', margin: 0, padding: '4px 0 4px 24px', borderLeft: `2px solid ${concept.border}`, marginLeft: 6, display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {rows.map(({ item, content, seqNum }, idx) => {
          const createdAt = 'created_at' in item ? item.created_at : '';
          return (
            <li key={item.id ?? idx} data-testid={`timeline-event-${seqNum}`} data-event-kind={'kind' in item ? item.kind : 'UNKNOWN'} style={{ position: 'relative' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: -32, top: 5, width: 14, height: 14, borderRadius: '50%', background: dotColor(item), border: `2px solid ${concept.surface}` }} />
              <div style={{ display: 'grid', gap: 2 }}>
                <strong style={{ fontSize: 18, color: concept.ink }}>{content.title}</strong>
                {content.details && <div style={{ fontSize: 15, color: concept.muted }}>{content.details}</div>}
                {createdAt && <time dateTime={createdAt} style={{ fontSize: 14, color: concept.muted }}>{formatEventTime(createdAt)}</time>}
              </div>
            </li>
          );
        })}
      </ol>
      <details data-testid="timeline-technical-details" style={{ borderTop: `1px solid ${concept.border}`, paddingTop: 16 }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, color: concept.primary, fontWeight: 650, fontSize: 16 }}>Technical details →</summary>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: concept.muted, display: 'grid', gap: 6, overflowWrap: 'anywhere' }}>
          {rows.map(({ item, attemptId, seqNum }) => <li key={`ref-${item.id ?? seqNum}`}>Event {item.id} · Sequence {seqNum}{attemptId && <> · Attempt {attemptId}</>}</li>)}
        </ul>
      </details>
    </>
  );
};

/** Shows only associations backed by a recorded execution ID. */
export const ExecutionAttempts: React.FC<{ events: ApiTimelineEvent[] }> = ({ events }) => {
  const sorted = [...events].sort((a, b) => a.sequence_number - b.sequence_number);
  const attempts = new Map<string, { action: string; status: string; detail?: string }>();
  let unmatched = false;
  for (const event of sorted) {
    if (!['EXECUTION_INTENDED', 'EXECUTION_SENT', 'EXECUTION_CONFIRMED', 'EXECUTION_FAILED'].includes(event.kind)) continue;
    const id = 'execution_id' in event && typeof event.execution_id === 'string' ? event.execution_id : null;
    if (!id) { unmatched = true; continue; }
    if (event.kind === 'EXECUTION_INTENDED' && 'action_type' in event && typeof event.action_type === 'string') {
      attempts.set(id, { action: event.action_type.replaceAll('_', ' ').toLowerCase(), status: 'Preparing; result not recorded' });
      continue;
    }
    const attempt = attempts.get(id);
    if (!attempt) { unmatched = true; continue; }
    if (event.kind === 'EXECUTION_SENT') attempt.status = 'Dispatched; result uncertain';
    else if (event.kind === 'EXECUTION_CONFIRMED') attempt.status = 'Confirmation recorded; PayPal outcome is not independently verified';
    else if (event.kind === 'EXECUTION_FAILED') {
      attempt.status = 'Failed';
      if ('error_message' in event && typeof event.error_message === 'string' && event.error_message) attempt.detail = event.error_message;
    }
  }
  if (attempts.size === 0 && !unmatched) return null;
  return <section aria-label="Action attempts" style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 24 }}>
    <h2 style={{ fontSize: 18 }}>Action attempts</h2>
    <p style={{ color: colors.inkMuted }}>Each result applies to its own recorded attempt.</p>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {[...attempts.entries()].map(([id, attempt]) => <li key={id} style={{ padding: '14px 0', borderBottom: `1px solid ${colors.border}` }}>
        <strong style={{ textTransform: 'capitalize' }}>{attempt.action}</strong><div>{attempt.status}</div>
        {attempt.detail && <details><summary>Failure detail</summary><p>{attempt.detail}</p></details>}
        <details><summary>Attempt reference</summary><code style={{ overflowWrap: 'anywhere' }}>{id}</code></details>
      </li>)}
    </ul>
    {unmatched && <p>Some older execution events cannot be matched to an attempt. See the activity history for those records.</p>}
  </section>;
};
