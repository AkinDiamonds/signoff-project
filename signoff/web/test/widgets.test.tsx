// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorityMeter } from '../src/features/widgets/AuthorityMeter';
import { DeadlineRadar } from '../src/features/widgets/DeadlineRadar';
import { DecisionTimelineWidget } from '../src/features/widgets/DecisionTimelineWidget';
import {
  toAuthorityMeters,
  type AuthorityMeterDatum,
  type DeadlineItem,
  type TimelineWidgetItem,
} from '../src/features/widgets/types';
import { disputesFixture, charterFixture } from '../../fixtures/ui';

const NOW = new Date('2026-10-21T12:00:00Z');

function deadlineItem(id: string, dueAt: string | null): DeadlineItem {
  return {
    id,
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    amountCents: 4200,
    currency: 'USD',
    dueAt,
    verdict: null,
  };
}

function meter(overrides: Partial<AuthorityMeterDatum>): AuthorityMeterDatum {
  return {
    id: 'auto_offer_max',
    label: 'Auto-offer ceiling',
    limitCents: 2500,
    usedCents: 1000,
    note: 'Test meter',
    ...overrides,
  };
}

function timelineItem(sequence: number): TimelineWidgetItem {
  return {
    id: `evt-${sequence}`,
    sequence,
    kind: 'WEBHOOK_RECEIVED',
    title: 'Webhook received',
    detail: `Step ${sequence}`,
    at: '2026-10-21T10:00:00Z',
    verdict: null,
  };
}

describe('Deadline Radar (Step 29)', () => {
  it('renders an empty state', () => {
    render(<DeadlineRadar items={[]} now={NOW} />);
    expect(screen.getByTestId('deadline-radar-empty')).toBeTruthy();
  });

  it('renders one item with a text urgency label, not colour alone', () => {
    render(<DeadlineRadar items={[deadlineItem('PP-1', '2026-10-23T09:00:00Z')]} now={NOW} />);
    const row = screen.getByTestId('deadline-radar-row-PP-1');
    expect(row.getAttribute('data-urgency')).toBe('DUE_SOON');
    expect(row.textContent).toContain('Due within 48 hours');
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('deadline-radar-count-due_soon').textContent).toContain('1');
  });

  it('handles 200 items, overlapping deadlines and past-due items', () => {
    const items: DeadlineItem[] = [];
    for (let index = 0; index < 198; index += 1) {
      items.push(deadlineItem(`PP-${index}`, '2026-11-30T09:00:00Z'));
    }
    items.push(deadlineItem('PP-OVERDUE-1', '2026-10-20T09:00:00Z'));
    items.push(deadlineItem('PP-OVERDUE-2', '2026-10-20T09:00:00Z'));

    render(<DeadlineRadar items={items} now={NOW} />);

    expect(screen.getByTestId('deadline-radar-count-overdue').textContent).toContain('2');
    expect(screen.getByTestId('deadline-radar-row-PP-OVERDUE-1').getAttribute('data-urgency')).toBe('OVERDUE');
    expect(screen.getByTestId('deadline-radar-row-PP-OVERDUE-2')).toBeTruthy();
    expect(screen.getByTestId('deadline-radar-cap').textContent).toContain('Showing 50 of 200');
    expect(screen.getAllByTestId(/^deadline-radar-row-/)).toHaveLength(50);
  });

  it('shows no-deadline items without inventing a date', () => {
    render(<DeadlineRadar items={[deadlineItem('PP-NONE', null)]} now={NOW} />);
    const row = screen.getByTestId('deadline-radar-row-PP-NONE');
    expect(row.getAttribute('data-urgency')).toBe('NONE');
    expect(row.textContent).toContain('No deadline');
  });
});

describe('Authority Meter (Step 29)', () => {
  it('renders an empty state', () => {
    render(<AuthorityMeter meters={[]} />);
    expect(screen.getByTestId('authority-meter-empty')).toBeTruthy();
  });

  it('renders one limit with an accessible meter', () => {
    render(<AuthorityMeter meters={[meter({})]} />);
    expect(screen.getByTestId('authority-meter-values-auto_offer_max').textContent).toContain('$10.00 of $25.00');
    expect(screen.getByRole('meter', { name: 'Auto-offer ceiling usage' })).toBeTruthy();
  });

  it('shows usage above 100% clearly in text and the meter value', () => {
    render(<AuthorityMeter meters={[meter({ usedCents: 3000 })]} />);
    expect(screen.getByTestId('authority-meter-over-limit-auto_offer_max').textContent).toContain(
      'Over limit (120%)'
    );
    expect(screen.getByTestId('authority-meter-values-auto_offer_max').textContent).toContain('(120%)');
  });

  it('maps charter limits and the largest open dispute, excluding resolved disputes', () => {
    const meters = toAuthorityMeters(charterFixture, disputesFixture.items);
    const disputeSize = meters.find((item) => item.id === 'auto_act_max_dispute_amount');
    expect(disputeSize?.usedCents).toBe(10750);
    expect(disputeSize?.limitCents).toBe(10000);
  });
});

describe('Decision Timeline widget (Step 29)', () => {
  it('renders an empty state', () => {
    render(<DecisionTimelineWidget items={[]} />);
    expect(screen.getByTestId('decision-timeline-widget-empty')).toBeTruthy();
  });

  it('renders a single item in sequence order with a focusable row', () => {
    render(<DecisionTimelineWidget items={[timelineItem(1)]} />);
    const row = screen.getByTestId('widget-timeline-event-evt-1');
    expect(row.textContent).toContain('Webhook received');
    expect(row.getAttribute('tabindex')).toBe('0');
  });

  it('renders 200 items in ascending sequence order', () => {
    const items = Array.from({ length: 200 }, (_, index) => timelineItem(200 - index));
    render(<DecisionTimelineWidget items={items} />);
    const rows = screen.getAllByTestId(/^widget-timeline-event-/);
    expect(rows).toHaveLength(200);
    const first = rows[0];
    expect(first?.textContent).toContain('Step 1');
  });
});
