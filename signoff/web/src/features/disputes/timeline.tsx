import React from 'react';
import { VerdictChip } from '@signoff/ui';
import type { ApiTimelineEvent, TimelineEvent } from './types';

export function renderTimelineEventContent(event: TimelineEvent): {
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
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 600,
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
            <VerdictChip verdict={event.verdict} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{event.rule_id}</span>
          </div>
        ),
        details: `Evaluated rule ${event.rule_id} with verdict ${event.verdict}.`,
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
              fontSize: '12px',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontWeight: 600,
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
      return {
        title: `Unknown event (${(_exhaustiveCheck as { kind?: string }).kind ?? 'unknown'})`,
        details: 'Generic timeline event record.',
      };
    }
  }
}

export interface DecisionTimelineProps {
  events: ApiTimelineEvent[];
}

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({ events }) => {
  // Sort strictly by sequence_number ascending
  const sorted = [...events].sort((a, b) => {
    const seqA = 'sequence_number' in a && typeof a.sequence_number === 'number' ? a.sequence_number : 0;
    const seqB = 'sequence_number' in b && typeof b.sequence_number === 'number' ? b.sequence_number : 0;
    return seqA - seqB;
  });

  if (sorted.length === 0) {
    return (
      <div data-testid="timeline-empty" style={{ padding: '16px', color: '#64748b' }}>
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
        padding: '8px 0 8px 16px',
        borderLeft: '2px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {sorted.map((item, idx) => {
        let content: { title: string; badge?: React.ReactNode; details?: React.ReactNode };

        // If known event kind, render through exhaustive switch
        if (
          'kind' in item &&
          typeof item.kind === 'string' &&
          [
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
          ].includes(item.kind)
        ) {
          content = renderTimelineEventContent(item as unknown as TimelineEvent);
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
              paddingLeft: '16px',
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
                backgroundColor: '#0284c7',
                border: '2px solid #ffffff',
                boxShadow: '0 0 0 2px #0284c7',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{content.title}</strong>
                {content.badge}
                {createdAt && (
                  <time
                    dateTime={createdAt}
                    style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}
                  >
                    {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </time>
                )}
              </div>
              {content.details && (
                <div style={{ fontSize: '13px', color: '#334155' }}>{content.details}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
