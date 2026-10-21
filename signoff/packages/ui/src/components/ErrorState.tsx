import React from 'react';
import { colors, spacing } from '../tokens';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  correlationId?: string | null;
  onRetry?: () => void;
  testId?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  correlationId,
  onRetry,
  testId,
}) => (
  <div
    role="alert"
    data-testid={testId}
    style={{
      padding: spacing[2],
      borderRadius: '6px',
      backgroundColor: colors.verdict.DENY.bg,
      border: `1px solid ${colors.verdict.DENY.border}`,
      color: colors.verdict.DENY.text,
    }}
  >
    <p style={{ margin: '0 0 8px 0' }}>
      <strong>Something went wrong.</strong> {message}
    </p>
    {correlationId && (
      <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>Reference: {correlationId}</p>
    )}
    {onRetry && (
      <Button variant="secondary" onClick={onRetry} testId={testId ? `${testId}-retry` : undefined}>
        Try again
      </Button>
    )}
  </div>
);
