// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConceptSegmented, disputePill, formatDeadlineFull, formatDueShort, formatEventTime, formatMoneyCompact, formatRelativeDay } from '../src';

const now = new Date('2026-11-04T10:00:00Z');

describe('concept formatters', () => {
  it('formats compact money', () => {
    expect(formatMoneyCompact({ value: '253.00', currency_code: 'USD' })).toBe('USD 253');
    expect(formatMoneyCompact({ value: '253.00', currency_code: 'USD' }, { space: false })).toBe('USD253');
    expect(formatMoneyCompact({ value: '1274.50', currency_code: 'USD' })).toBe('USD 1,274.50');
    expect(formatMoneyCompact({ value: 'x', currency_code: 'USD' })).toBe('Unknown amount');
  });

  it('formats deadlines in WAT regardless of runtime zone', () => {
    expect(formatDeadlineFull('2026-11-18T21:18:00Z')).toBe('18 Nov · 10:18 PM WAT');
    expect(formatDeadlineFull(null)).toBe('No deadline');
  });

  it('formats short due dates', () => {
    expect(formatDueShort('2026-11-20T09:00:00Z', now)).toBe('Due 20 Nov');
    expect(formatDueShort('2026-11-01T09:00:00Z', now)).toBe('Overdue');
    expect(formatDueShort(null, now)).toBe('No deadline');
  });

  it('formats event and relative times', () => {
    expect(formatEventTime('2026-11-02T09:40:00Z', now)).toBe('2 Nov, 10:40 AM');
    expect(formatRelativeDay('2026-11-04T06:29:00Z', now)).toBe('7:29 AM');
    expect(formatRelativeDay('2026-11-03T06:29:00Z', now)).toBe('Yesterday');
    expect(formatRelativeDay('2026-10-20T06:29:00Z', now)).toBe('20 Oct');
  });

  it('picks one pill by priority', () => {
    expect(disputePill({ approval_execution_attention: 'NOT_RECORDED', current_approval_available: true }).label).toBe('Check execution');
    expect(disputePill({ status: 'WAITING_FOR_BUYER_RESPONSE' })).toEqual({ tone: 'blue', label: 'Waiting for buyer' });
    expect(disputePill({ status: 'UNDER_REVIEW' }).tone).toBe('purple');
  });
});

describe('ConceptSegmented', () => {
  const options = [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }, { value: 'c', label: 'Three' }];

  it('selects on click and marks the active option', () => {
    const onChange = vi.fn();
    render(<ConceptSegmented options={options} value="a" onChange={onChange} ariaLabel="Choose" />);
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('supports arrow-key navigation as tabs', () => {
    const onChange = vi.fn();
    render(<ConceptSegmented options={options} value="a" onChange={onChange} ariaLabel="Tabs" tabs />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'One' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('b');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'One' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });
});
