import React from 'react';
import { EmptyState, colors, spacing } from '@signoff/ui';
import {
  DEADLINE_LABELS,
  classifyDeadline,
  formatCents,
  type DeadlineItem,
  type DeadlineUrgency,
} from './types';

export const DEADLINE_RADAR_LIMIT = 50;

const URGENCIES: readonly DeadlineUrgency[] = ['OVERDUE', 'DUE_SOON', 'SCHEDULED', 'NONE'];

function formatUtc(dueAt: string): string {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export interface DeadlineRadarProps {
  items: readonly DeadlineItem[];
  now?: Date;
}

function timestamp(item: DeadlineItem): number {
  if (item.dueAt === null) {
    return Number.POSITIVE_INFINITY;
  }
  const value = new Date(item.dueAt).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export const DeadlineRadar: React.FC<DeadlineRadarProps> = ({ items, now = new Date() }) => {
  if (items.length === 0) {
    return (
      <EmptyState
        testId="deadline-radar-empty"
        title="No disputes to track"
        description="Deadlines appear here as soon as a dispute has a seller response date."
      />
    );
  }

  const ordered = [...items].sort((left, right) => timestamp(left) - timestamp(right));
  const counts: Record<DeadlineUrgency, number> = { OVERDUE: 0, DUE_SOON: 0, SCHEDULED: 0, NONE: 0 };
  for (const item of ordered) {
    counts[classifyDeadline(item.dueAt, now)] += 1;
  }
  const visible = ordered.slice(0, DEADLINE_RADAR_LIMIT);

  return (
    <div data-testid="deadline-radar">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[1] }} aria-label="Deadline summary">
        {URGENCIES.map((urgency) => (
          <span key={urgency} data-testid={`deadline-radar-count-${urgency.toLowerCase()}`} style={{ fontSize: '13px' }}>
            <span aria-hidden="true">{DEADLINE_LABELS[urgency].icon}</span>{' '}
            <strong>{counts[urgency]}</strong> {DEADLINE_LABELS[urgency].label}
          </span>
        ))}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
        {visible.map((item) => {
          const urgency = classifyDeadline(item.dueAt, now);
          const label = DEADLINE_LABELS[urgency];
          return (
            <li
              key={item.id}
              data-testid={`deadline-radar-row-${item.id}`}
              data-urgency={urgency}
              tabIndex={0}
              aria-label={`${item.id}, ${item.currency} ${formatCents(item.amountCents)}, ${label.label}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: spacing[1],
                alignItems: 'center',
                padding: spacing[1],
                border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${
                  urgency === 'OVERDUE'
                    ? colors.verdict.DENY.border
                    : urgency === 'DUE_SOON'
                      ? colors.verdict.NEEDS_APPROVAL.border
                      : colors.borderStrong
                }`,
                borderRadius: '6px',
              }}
            >
              <span>
                <strong>{item.id}</strong>
                <span style={{ display: 'block', fontSize: '12px', color: colors.inkMuted }}>
                  {item.reason.replace(/_/g, ' ')}
                </span>
              </span>
              <span>{item.currency} {formatCents(item.amountCents)}</span>
              <span style={{ fontSize: '13px' }}>
                <span aria-hidden="true">{label.icon}</span> {label.label}
                {item.dueAt !== null && (
                  <span style={{ display: 'block', fontSize: '12px', color: colors.inkMuted }}>
                    {formatUtc(item.dueAt)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {ordered.length > visible.length && (
        <p data-testid="deadline-radar-cap" style={{ fontSize: '12px', color: colors.inkMuted }}>
          Showing {visible.length} of {ordered.length} disputes. Use the dispute list for the rest.
        </p>
      )}
    </div>
  );
};
