/**
 * Visual mock tracking timeline component for the buyer portal.
 */

import React from 'react';
import { warmColors, warmShadows } from '../theme';
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
          backgroundColor: warmColors.surfaceMuted,
          borderRadius: '8px',
          color: warmColors.inkMuted,
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        No tracking events scheduled yet. Order status: <strong>{orderStatus}</strong>.
      </div>
    );
  }

  const latestEvent = events[events.length - 1];
  if (!latestEvent) {
    return null;
  }

  return (
    <div
      data-testid="portal-tracking-timeline"
      style={{
        backgroundColor: warmColors.surface,
        borderRadius: '12px',
        border: `1px solid ${warmColors.border}`,
        padding: '20px',
        boxShadow: warmShadows.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${warmColors.borderMuted}`,
        }}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: warmColors.inkMuted, textTransform: 'uppercase' }}>
            Carrier &amp; Tracking
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: warmColors.ink, marginTop: '2px' }}>
            {latestEvent.carrier} ·{' '}
            <code
              data-testid="portal-tracking-number"
              style={{
                fontFamily: 'monospace',
                backgroundColor: warmColors.surfaceMuted,
                padding: '2px 6px',
                borderRadius: '4px',
                color: warmColors.accent,
              }}
            >
              {latestEvent.tracking_number}
            </code>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: warmColors.inkMuted, textTransform: 'uppercase' }}>
            Current Status
          </div>
          <span
            data-testid="portal-tracking-current-status"
            style={{
              display: 'inline-block',
              marginTop: '4px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: latestEvent.status === 'DELIVERED' ? warmColors.successBg : warmColors.surfaceMuted,
              color: latestEvent.status === 'DELIVERED' ? warmColors.successInk : warmColors.accent,
              border: `1px solid ${latestEvent.status === 'DELIVERED' ? warmColors.successBorder : warmColors.border}`,
            }}
          >
            {latestEvent.status}
          </span>
        </div>
      </div>

      {/* Vertical timeline steps */}
      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Timeline connector line */}
        <div
          style={{
            position: 'absolute',
            left: '7px',
            top: '8px',
            bottom: '16px',
            width: '2px',
            backgroundColor: warmColors.border,
          }}
        />

        {events.map((ev, index) => {
          const isLatest = index === events.length - 1;
          const formattedDate = new Date(ev.event_time).toLocaleString(undefined, {
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
                marginBottom: index === events.length - 1 ? '0' : '20px',
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: '-24px',
                  top: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: isLatest ? warmColors.primary : '#ffffff',
                  border: `2px solid ${isLatest ? warmColors.primary : warmColors.border}`,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: isLatest ? 700 : 500,
                    color: isLatest ? warmColors.ink : warmColors.inkMuted,
                  }}
                >
                  {ev.status}
                </span>
                <span style={{ fontSize: '12px', color: warmColors.inkMuted }}>
                  {formattedDate}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: warmColors.inkMuted, marginTop: '2px' }}>
                {ev.carrier} milestone recorded for {ev.tracking_number}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
