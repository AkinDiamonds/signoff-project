import React from 'react';

export interface DeadlineProps {
  dueAt: string | null;
  now?: Date;
  testId?: string;
}

const formatLocal = (date: Date): string => date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

export function describeDeadline(dueAt: string | null, now: Date): string {
  if (dueAt === null) {
    return 'No deadline';
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return 'Unknown deadline';
  }
  const remainingMs = due.getTime() - now.getTime();
  if (remainingMs < 0) {
    return `Overdue, was due ${formatLocal(due)}`;
  }
  if (remainingMs === 0) {
    return 'Due now';
  }
  const hours = Math.floor(remainingMs / 3_600_000);
  if (hours < 48) {
    return `Due in ${hours} h (${formatLocal(due)})`;
  }
  return `Due in ${Math.floor(hours / 24)} days (${formatLocal(due)})`;
}

export const Deadline: React.FC<DeadlineProps> = ({ dueAt, now, testId }) => (
  <time dateTime={dueAt ?? undefined} data-testid={testId} title={dueAt && !Number.isNaN(Date.parse(dueAt)) ? new Date(dueAt).toISOString() : undefined}>
    {describeDeadline(dueAt, now ?? new Date())}
  </time>
);
