import React from 'react';
import { colors, spacing, typography } from '../tokens';

export interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  className?: string;
  testId?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  primaryAction,
  secondaryActions,
  className,
  testId,
}) => {
  return (
    <header
      data-testid={testId || 'page-header'}
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing[2],
        marginBottom: spacing[2.5],
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: typography.fontSizePageTitle,
            fontWeight: typography.fontWeightSemibold,
            color: colors.ink,
            lineHeight: '28px',
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              margin: `${spacing[0.5]} 0 0 0`,
              fontSize: typography.fontSizeBody,
              lineHeight: typography.lineHeightBody,
              color: colors.inkMuted,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>

      {(primaryAction || secondaryActions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[1],
            marginLeft: 'auto',
          }}
        >
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </header>
  );
};

