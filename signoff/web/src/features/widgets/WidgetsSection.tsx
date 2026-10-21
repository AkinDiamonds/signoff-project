import React, { useMemo } from 'react';
import { Card, spacing } from '@signoff/ui';
import { AuthorityMeter } from './AuthorityMeter';
import { DeadlineRadar } from './DeadlineRadar';
import { DecisionTimelineWidget } from './DecisionTimelineWidget';
import {
  toAuthorityMeters,
  toDeadlineItems,
  toTimelineWidgetItems,
  type ApiTimelineEvent,
  type Charter,
  type DisputeItem,
} from './types';

export interface WidgetsSectionProps {
  disputes: readonly DisputeItem[];
  charter: Charter | undefined;
  timeline: readonly ApiTimelineEvent[];
  now?: Date;
}

export const WidgetsSection: React.FC<WidgetsSectionProps> = ({ disputes, charter, timeline, now }) => {
  const deadlineItems = useMemo(() => toDeadlineItems(disputes), [disputes]);
  const timelineItems = useMemo(() => toTimelineWidgetItems(timeline), [timeline]);
  const meters = useMemo(
    () => (charter ? toAuthorityMeters(charter, disputes) : []),
    [charter, disputes]
  );

  return (
    <section aria-label="Custom widgets" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      <h2 style={{ margin: 0, fontSize: '18px' }}>Custom widgets</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing[2] }}>
        <Card title="Decision Timeline" testId="widget-decision-timeline">
          <DecisionTimelineWidget items={timelineItems} />
        </Card>
        <Card title="Deadline Radar" testId="widget-deadline-radar">
          <DeadlineRadar items={deadlineItems} {...(now ? { now } : {})} />
        </Card>
        <Card title="Authority Meter" testId="widget-authority-meter">
          <AuthorityMeter meters={meters} />
        </Card>
      </div>
    </section>
  );
};
