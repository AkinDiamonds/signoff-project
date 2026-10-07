import React from 'react';
import { colors } from '../tokens';

export type BadgeVerdict = 'ALLOW' | 'NEEDS_APPROVAL' | 'DENY';

export interface StatusBadgeProps {
  verdict: BadgeVerdict;
  className?: string;
  testId?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ verdict, className, testId }) => {
  const meta = colors.verdict[verdict];

  return (
    <span
      data-testid={testId ?? `status-badge-${verdict.toLowerCase().replace('_', '-')}`}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.text,
      }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
};
