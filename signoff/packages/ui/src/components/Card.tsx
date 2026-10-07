import React from 'react';
import { colors, spacing } from '../tokens';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  testId?: string;
}

export const Card: React.FC<CardProps> = ({ children, title, className, testId }) => {
  return (
    <div
      data-testid={testId ?? 'ui-card'}
      className={className}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: spacing[2],
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {title && (
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: colors.ink,
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};
