import React from 'react';
import { colors, radius, spacing, typography } from '../tokens';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  testId?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  testId,
}) => (
  <section
    data-testid={testId}
    style={{
      padding: `${spacing[4]} ${spacing[3]}`,
      textAlign: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      border: `1px solid ${colors.border}`,
      maxWidth: '560px',
      margin: '0 auto',
    }}
  >
    <h2
      style={{
        fontSize: typography.fontSizeHeading,
        fontWeight: typography.fontWeightSemibold,
        color: colors.ink,
        margin: `0 0 ${spacing[1]} 0`,
        lineHeight: '24px',
      }}
    >
      {title}
    </h2>
    <p
      style={{
        margin: `0 0 ${spacing[2]} 0`,
        fontSize: typography.fontSizeBody,
        lineHeight: typography.lineHeightBody,
        color: colors.inkMuted,
      }}
    >
      {description}
    </p>
    {action ? <div>{action}</div> : null}
  </section>
);
