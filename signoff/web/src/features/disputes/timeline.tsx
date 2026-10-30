import React from 'react';
import { VERDICTS } from '@signoff/api-client';
import type { Verdict } from '@signoff/api-client';
import { VerdictChip, colors, getRuleExplanation, radius, spacing, typography } from '@signoff/ui';
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
        title: 'Action plan proposed',
        details: `Proposed action: ${event.action_type}.`,
      };
    case 'GATE_DECIDED':
      return {
        title: 'Gate decided',
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
                backgroundColor: '#F1F1F1',
                padding: '2px 6px',
                borderRadius: '4px',
                cursor: 'help',
                color: '#303030',
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
        title: 'Human approval requested',
        details: 'Dispatched approval notification to merchant.',
      };
    case 'APPROVAL_RESOLVED':
      return {
        title: 'Approval resolved',
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
        title: 'Execution confirmed',
        details: `Action confirmed by PayPal (external ID: ${event.external_id}).`,
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
        details: `Reason: ${event.reason}`,
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

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({ events, reverse = false }) => {
  // Sort strictly by sequence_number ascending
  const sorted = [...events].sort((a, b) => {
    const seqA = 'sequence_number' in a && typeof a.sequence_number === 'number' ? a.sequence_number : 0;
    const seqB = 'sequence_number' in b && typeof b.sequence_number === 'number' ? b.sequence_number : 0;
    return reverse ? seqB - seqA : seqA - seqB;
  });

  if (sorted.length === 0) {
    return (
      <div data-testid="timeline-empty" style={{ padding: spacing[2], color: colors.inkMuted, fontSize: typography.fontSizeSmall }}>
        No timeline events recorded yet.
      </div>
    );
  }

  return (
    <ol
      data-testid="decision-timeline"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: `${spacing[1]} 0 ${spacing[1]} ${spacing[2]}`,
        borderLeft: `2px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[2],
      }}
    >
      {sorted.map((item, idx) => {
        let content: { title: string; badge?: React.ReactNode; details?: React.ReactNode };

        // If known event kind, render through exhaustive switch
        if (isKnownTimelineEvent(item)) {
          content = renderTimelineEventContent(item);
        } else {
          // Edge case: unknown timeline event kind renders generically
          content = {
            title: `Event: ${('kind' in item ? item.kind : 'UNKNOWN')}`,
            details: 'Event data recorded in dispute audit log.',
          };
        }

        const createdAt = 'created_at' in item ? item.created_at : '';
        const seqNum = 'sequence_number' in item ? item.sequence_number : idx + 1;

        return (
          <li
            key={item.id ?? idx}
            data-testid={`timeline-event-${seqNum}`}
            data-event-kind={'kind' in item ? item.kind : 'UNKNOWN'}
            style={{
              position: 'relative',
              paddingLeft: spacing[2],
            }}
          >
            {/* Timeline bullet */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '-23px',
                top: '4px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: colors.brandPrimary,
                border: `2px solid ${colors.surface}`,
                boxShadow: `0 0 0 2px ${colors.brandPrimary}`,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[1],
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ fontSize: typography.fontSizeBody, color: colors.ink }}>{content.title}</strong>
                {content.badge}
                {createdAt && (
                  <time
                    dateTime={createdAt}
                    style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, marginLeft: 'auto' }}
                  >
                    {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </time>
                )}
              </div>
              {content.details && (
                <div style={{ fontSize: typography.fontSizeSmall, color: colors.ink }}>{content.details}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
