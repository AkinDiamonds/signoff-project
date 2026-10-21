import React from 'react';
import { colors, spacing } from '../tokens';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  testId?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, testId }) => (
  <section
    data-testid={testId}
    style={{ padding: spacing[2], textAlign: 'center', color: colors.inkMuted }}
  >
    <h2 style={{ fontSize: '16px', color: colors.ink, margin: '0 0 8px 0' }}>{title}</h2>
    <p style={{ margin: '0 0 16px 0' }}>{description}</p>
    {action}
  </section>
);
