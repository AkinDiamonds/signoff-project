import React from 'react';

export interface DeadlineProps {
  dueAt: string | null;
  now?: Date;
  testId?: string;
}

const formatUtc = (date: Date): string => `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

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
    return `Overdue, was due ${formatUtc(due)}`;
  }
  if (remainingMs === 0) {
    return 'Due now';
  }
  const hours = Math.floor(remainingMs / 3_600_000);
  if (hours < 48) {
    return `Due in ${hours} h (${formatUtc(due)})`;
  }
  return `Due in ${Math.floor(hours / 24)} days (${formatUtc(due)})`;
}

export const Deadline: React.FC<DeadlineProps> = ({ dueAt, now, testId }) => (
  <time dateTime={dueAt ?? undefined} data-testid={testId}>
    {describeDeadline(dueAt, now ?? new Date())}
  </time>
);
