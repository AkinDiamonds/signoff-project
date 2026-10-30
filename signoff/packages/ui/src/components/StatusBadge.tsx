import React from 'react';
import { colors, radius, typography } from '../tokens';

export type BadgeVerdict = 'ALLOW' | 'NEEDS_APPROVAL' | 'DENY';

export interface StatusBadgeProps {
  verdict?: BadgeVerdict | string;
  status?: string;
  label?: string;
  className?: string;
  testId?: string;
}

interface Palette {
  bg: string;
  text: string;
  border: string;
  icon: string;
  defaultLabel: string;
}

export function resolveBadgePalette(val: string): Palette {
  const norm = (val || '').toUpperCase().trim();
  switch (norm) {
    case 'ALLOW':
    case 'ALLOWED':
    case 'RESOLVED':
    case 'PAID':
    case 'FULFILLED':
    case 'WON':
      return {
        bg: colors.verdict.ALLOW.bg,
        text: colors.verdict.ALLOW.text,
        border: colors.verdict.ALLOW.border,
        icon: colors.verdict.ALLOW.icon,
        defaultLabel: colors.verdict.ALLOW.label,
      };
    case 'NEEDS_APPROVAL':
    case 'PENDING':
    case 'UNDER_REVIEW':
    case 'WAITING_FOR_SELLER':
    case 'WAITING_FOR_BUYER':
    case 'UNFULFILLED':
      return {
        bg: colors.verdict.NEEDS_APPROVAL.bg,
        text: colors.verdict.NEEDS_APPROVAL.text,
        border: colors.verdict.NEEDS_APPROVAL.border,
        icon: colors.verdict.NEEDS_APPROVAL.icon,
        defaultLabel: colors.verdict.NEEDS_APPROVAL.label,
      };
    case 'DENY':
    case 'DENIED':
    case 'CANCELLED':
    case 'REFUNDED':
    case 'LOST':
      return {
        bg: colors.verdict.DENY.bg,
        text: colors.verdict.DENY.text,
        border: colors.verdict.DENY.border,
        icon: colors.verdict.DENY.icon,
        defaultLabel: colors.verdict.DENY.label,
      };
    default:
      return {
        bg: '#F1F1F1',
        text: '#616161',
        border: '#E1E1E1',
        icon: '•',
        defaultLabel: val || 'Unknown',
      };
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  verdict,
  status,
  label,
  className,
  testId,
}) => {
  const effectiveVal = verdict || status || 'UNKNOWN';
  const palette = resolveBadgePalette(effectiveVal);
  const displayLabel = label || palette.defaultLabel;
  const testAttr =
    testId ?? `status-badge-${effectiveVal.toLowerCase().replace(/_/g, '-')}`;

  return (
    <span
      data-testid={testAttr}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '20px',
        padding: '0 8px',
        borderRadius: radius.pill,
        fontSize: typography.fontSizeSmall,
        fontWeight: typography.fontWeightMedium,
        lineHeight: '20px',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '11px' }}>
        {palette.icon}
      </span>
      <span>{displayLabel}</span>
    </span>
  );
};
