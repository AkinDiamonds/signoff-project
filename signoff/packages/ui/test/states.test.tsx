// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  Banner,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  ServerVerdictChip,
  Skeleton,
  TruncatedText,
  VerdictChip,
  describeDeadline,
  formatMoney,
} from '../src';

describe('VerdictChip', () => {
  it('shows icon and label for each verdict', () => {
    render(<VerdictChip verdict="NEEDS_APPROVAL" testId="chip" />);
    expect(screen.getByTestId('chip').textContent).toContain('Needs Approval');
  });

  it('renders a neutral Unknown chip for a value outside the verdict union', () => {
    render(<ServerVerdictChip value="MAYBE" testId="chip" />);
    expect(screen.getByTestId('chip').textContent).toBe('?Unknown');
  });

  it('renders a neutral Unknown chip for null', () => {
    render(<ServerVerdictChip value={null} testId="chip" />);
    expect(screen.getByTestId('chip').textContent).toBe('?Unknown');
  });
});

describe('Money', () => {
  it('formats the exact string with grouping and two places', () => {
    expect(formatMoney({ value: '1234567.00', currency_code: 'USD' })).toBe('USD 1,234,567.00');
  });

  it('never rounds the stored value', () => {
    expect(formatMoney({ value: '0.10', currency_code: 'USD' })).toBe('USD 0.10');
  });

  it('shows a plain message for a malformed value', () => {
    expect(formatMoney({ value: '12.5', currency_code: 'USD' })).toBe('Unknown amount');
  });

  it('renders through the component', () => {
    render(<Money money={{ value: '42.00', currency_code: 'USD' }} testId="money" />);
    expect(screen.getByTestId('money').textContent).toBe('USD 42.00');
  });
});

describe('Deadline', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it('reports a missing deadline', () => {
    expect(describeDeadline(null, now)).toBe('No deadline');
  });

  it('reports a past deadline as overdue', () => {
    expect(describeDeadline('2026-10-20T12:00:00Z', now)).toMatch(/^Overdue/);
  });

  it('treats the exact due time as due now', () => {
    expect(describeDeadline('2026-10-21T12:00:00Z', now)).toBe('Due now');
  });

  it('counts hours under 48 hours', () => {
    expect(describeDeadline('2026-10-22T12:00:00Z', now)).toMatch(/^Due in 24 h/);
  });

  it('counts whole days beyond 48 hours', () => {
    expect(describeDeadline('2026-10-26T12:00:00Z', now)).toMatch(/^Due in 5 days/);
  });

  it('flags an unparseable deadline', () => {
    expect(describeDeadline('not-a-date', now)).toBe('Unknown deadline');
  });

  it('renders a time element for a null deadline', () => {
    render(<Deadline dueAt={null} testId="deadline" />);
    expect(screen.getByTestId('deadline').textContent).toBe('No deadline');
  });
});

describe('State components', () => {
  it('EmptyState renders title, description and action', () => {
    render(
      <EmptyState
        title="No disputes"
        description="Run a demo scenario to create one."
        action={<a href="/app/demo">Open demo</a>}
      />
    );
    expect(screen.getByRole('heading', { name: 'No disputes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open demo' })).toBeTruthy();
  });

  it('ErrorState announces the message, correlation id and retries', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        testId="err"
        message="Could not load disputes."
        correlationId="abc-123"
        onRetry={onRetry}
      />
    );
    expect(screen.getByRole('alert').textContent).toContain('Could not load disputes.');
    expect(screen.getByText('Reference: abc-123')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('Skeleton is hidden from assistive technology', () => {
    render(<Skeleton testId="skel" />);
    expect(screen.getByTestId('skel').getAttribute('aria-hidden')).toBe('true');
  });

  it('Banner renders the cached reasoning label', () => {
    render(<Banner variant="cached" />);
    expect(screen.getByRole('status').textContent).toContain('Cached reasoning');
  });

  it('TruncatedText keeps the full text available as a tooltip', () => {
    const long = 'x'.repeat(200);
    render(<TruncatedText text={long} testId="trunc" />);
    const el = screen.getByTestId('trunc');
    expect(el.getAttribute('title')).toBe(long);
    expect(el.style.textOverflow).toBe('ellipsis');
  });
});
