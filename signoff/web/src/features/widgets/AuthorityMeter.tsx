import React from 'react';
import { EmptyState, colors, spacing } from '@signoff/ui';
import { formatCents, usagePercent, type AuthorityMeterDatum } from './types';

export interface AuthorityMeterProps {
  meters: readonly AuthorityMeterDatum[];
}

export const AuthorityMeter: React.FC<AuthorityMeterProps> = ({ meters }) => {
  if (meters.length === 0) {
    return (
      <EmptyState
        testId="authority-meter-empty"
        title="No charter limits to compare"
        description="Set the charter limits to see usage against each ceiling."
      />
    );
  }

  return (
    <ul data-testid="authority-meter" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      {meters.map((datum) => {
        const percent = usagePercent(datum);
        const over = percent > 100;
        const barWidth = Math.min(percent, 100);
        const max = Math.max(datum.limitCents, datum.usedCents, 1);
        return (
          <li key={datum.id} data-testid={`authority-meter-row-${datum.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px' }}>
              <strong>{datum.label}</strong>
              <span data-testid={`authority-meter-values-${datum.id}`}>
                {formatCents(datum.usedCents)} of {formatCents(datum.limitCents)} ({percent}%)
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${datum.label} usage`}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={datum.usedCents}
              aria-valuetext={`${formatCents(datum.usedCents)} of ${formatCents(datum.limitCents)}, ${percent} percent used`}
              style={{
                height: '12px',
                borderRadius: '999px',
                backgroundColor: colors.surfaceSubtle,
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  backgroundColor: over ? colors.verdict.DENY.border : colors.brandPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  overflow: 'hidden',
                }}
              >
                {over && (
                  <span
                    aria-hidden="true"
                    style={{ color: '#fff', fontSize: '9px', fontWeight: 700, paddingRight: '2px', letterSpacing: '1px' }}
                  >
                    !!!
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: colors.inkMuted }}>
              <span>{datum.note}</span>
              {over && (
                <strong data-testid={`authority-meter-over-limit-${datum.id}`} style={{ color: colors.verdict.DENY.text }}>
                  Over limit ({percent}%)
                </strong>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
