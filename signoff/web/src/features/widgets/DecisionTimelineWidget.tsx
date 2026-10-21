import React from 'react';
import { EmptyState, ServerVerdictChip, colors, spacing } from '@signoff/ui';
import type { TimelineWidgetItem } from './types';

export interface DecisionTimelineWidgetProps {
  items: readonly TimelineWidgetItem[];
}

function formatTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export const DecisionTimelineWidget: React.FC<DecisionTimelineWidgetProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <EmptyState
        testId="decision-timeline-widget-empty"
        title="No decisions yet"
        description="The timeline fills in as the agent reads, plans, gates and executes."
      />
    );
  }

  const ordered = [...items].sort((left, right) => left.sequence - right.sequence);

  return (
    <ol
      data-testid="decision-timeline-widget"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: `0 0 0 ${spacing[2]}`,
        borderLeft: `2px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[2],
        maxHeight: '420px',
        overflowY: 'auto',
      }}
    >
      {ordered.map((item) => (
        <li
          key={item.id}
          data-testid={`widget-timeline-event-${item.id}`}
          data-kind={item.kind}
          tabIndex={0}
          aria-label={`Step ${item.sequence}: ${item.title}`}
          style={{ position: 'relative', paddingLeft: spacing[1] }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-25px',
              top: '4px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: colors.brandPrimary,
              border: `2px solid ${colors.surface}`,
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <strong>{item.title}</strong>
            {item.verdict !== null && <ServerVerdictChip value={item.verdict} />}
            <time dateTime={item.at} style={{ marginLeft: 'auto', fontSize: '12px', color: colors.inkMuted }}>
              {formatTime(item.at)}
            </time>
          </div>
          <div style={{ fontSize: '13px', color: colors.inkMuted }}>Step {item.sequence}: {item.detail}</div>
        </li>
      ))}
    </ol>
  );
};
