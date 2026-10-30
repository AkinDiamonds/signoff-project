/**
 * Simplified buyer tracking timeline.
 *
 * Implements Step 4, Rule 2:
 * - Same visual language as merchant timeline, simplified:
 *   dot, line, one line of text per event, dates in 12px secondary.
 */

import React from 'react';
import { colors, retailTheme } from '../theme';
import type { TrackingMilestone } from '../types';

interface PortalTrackingTimelineProps {
  events: TrackingMilestone[];
  orderStatus: string;
}

export const PortalTrackingTimeline: React.FC<PortalTrackingTimelineProps> = ({
  events,
  orderStatus,
}) => {
  if (!events || events.length === 0) {
    return (
      <div
        data-testid="portal-tracking-empty"
        style={{
          padding: '16px',
          backgroundColor: retailTheme.surfaceWarm,
          borderRadius: '8px',
          color: retailTheme.inkMuted,
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        No tracking events recorded yet. Order status: <strong>{orderStatus}</strong>.
      </div>
    );
  }

  const latestEvent = events[events.length - 1];
  if (!latestEvent) return null;

  return (
    <div
      data-testid="portal-tracking-timeline"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        boxShadow: retailTheme.cardShadow,
        padding: '20px 24px',
        fontFamily: retailTheme.fontFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: `1px solid ${retailTheme.borderSubtle}`,
        }}
      >
        <div>
          <span style={{ fontSize: '13px', color: retailTheme.inkMuted }}>Tracking: </span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: retailTheme.ink }}>
            {latestEvent.carrier}{' '}
            <code
              data-testid="portal-tracking-number"
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                color: retailTheme.ink,
              }}
            >
              {latestEvent.tracking_number}
            </code>
          </span>
        </div>

        <span
          data-testid="portal-tracking-current-status"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: latestEvent.status === 'DELIVERED' ? colors.brandPrimary : retailTheme.inkMuted,
          }}
        >
          {latestEvent.status}
        </span>
      </div>

      {/* Simplified dot + line timeline */}
      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        {/* Continuous connector line */}
        <div
          style={{
            position: 'absolute',
            left: '3px',
            top: '6px',
            bottom: '10px',
            width: '2px',
            backgroundColor: retailTheme.borderSubtle,
          }}
        />

        {events.map((ev, index) => {
          const isLatest = index === events.length - 1;
          const formattedDate = new Date(ev.event_time).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={index}
              data-testid={`portal-tracking-step-${index}`}
              style={{
                position: 'relative',
                marginBottom: index === events.length - 1 ? '0' : '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: '12px',
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: '-20px',
                  top: '5px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isLatest ? colors.actionPrimary : colors.border,
                }}
              />

              {/* One line of text per event */}
              <div style={{ fontSize: '13px', color: isLatest ? retailTheme.ink : retailTheme.inkMuted }}>
                <strong>{ev.carrier}</strong>: {ev.status}
              </div>

              {/* Date in 12px secondary */}
              <div style={{ fontSize: '12px', color: retailTheme.inkMuted, whiteSpace: 'nowrap' }}>
                {formattedDate}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
