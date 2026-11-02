// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, toast } from '@signoff/ui';

describe('shared operation feedback', () => {
  it('deduplicates bursts and keeps failures available until dismissed', () => {
    vi.useFakeTimers();
    const view = render(<ToastProvider><p>Page content</p></ToastProvider>);
    act(() => { toast('Saved'); toast('Saved'); toast('Could not save', 'error'); });
    expect(screen.getAllByText('Saved')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toContain('Could not save');
    act(() => { vi.advanceTimersByTime(6001); });
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update' }));
    expect(screen.queryByRole('alert')).toBeNull();
    view.unmount();
    vi.useRealTimers();
  });
});
