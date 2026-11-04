// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { mockFetch } from '../src/app/mockFetch';
import { DecisionTimeline, ExecutionAttempts } from '../src/features/disputes/timeline';
import type { ApiTimelineEvent } from '../src/features/disputes/types';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Disputes UI feature (Step 25)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders dispute list page with filters and table rows', async () => {
    await act(async () => {
      renderAt('/app/disputes');
    });

    await waitFor(() => {
      expect(screen.getByTestId('disputes-table')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByTestId('filter-status')).toBeTruthy();
    expect(screen.getByTestId('filter-reason')).toBeTruthy();
    expect(screen.getByLabelText('All sessions')).toBeTruthy();
    expect(screen.getByLabelText('My demo session')).toBeTruthy();

    expect(screen.getByTestId('dispute-row-PP-D-1001')).toBeTruthy();
    expect(screen.getByTestId('dispute-row-PP-D-1002')).toBeTruthy();
  });

  it('invalid URL filter values fall back to defaults', async () => {
    await act(async () => {
      renderAt('/app/disputes?status=INVALID_STATUS&reason=INVALID_REASON&scope=invalid_scope');
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    const statusSelect = screen.getByTestId<HTMLSelectElement>('filter-status');
    const reasonSelect = screen.getByTestId<HTMLSelectElement>('filter-reason');
    expect(statusSelect.value).toBe('ALL');
    expect(reasonSelect.value).toBe('ALL');
  });

  it('keeps filter changes local until applied', async () => {
    renderAt('/app/disputes');
    await screen.findByTestId('dispute-row-PP-D-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'RESOLVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByTestId<HTMLSelectElement>('filter-status').value).toBe('ALL');
  });

  it('empty list displays empty state and links to demo page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/disputes')) return new Response(JSON.stringify({ items: [], next_cursor: null, total_count: 0 }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
        return mockFetch(input, options);
      })
    );

    await act(async () => {
      renderAt('/app/disputes');
    });

    await waitFor(() => {
      expect(screen.getByTestId('disputes-empty-state')).toBeTruthy();
    });

    const link = screen.getByTestId('empty-state-demo-link');
    expect(link.getAttribute('href')).toBe('/app/demo');
  });

  // Detail-page tab, evidence and activity coverage lives in dispute-detail.test.tsx.

  it('does not claim active analysis or invent an approval link while waiting for approval', async () => {
    await act(async () => {
      renderAt('/app/disputes/PP-D-1002');
    });

    await waitFor(() => {
      expect(screen.getByTestId('dispute-detail-id').textContent).toContain('PP-D-1002');
    });

    expect(screen.queryByTestId('agent-in-progress-banner')).toBeNull();
    const approvalLink = screen.queryByTestId('open-approval-card-button');
    expect(approvalLink?.getAttribute('href') ?? '').not.toContain('/approve/mock-');
  });

  it('shows human review when the latest model run failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/disputes/PP-D-1001/timeline')) {
        return new Response(JSON.stringify({ items: [{ id: 'failed', dispute_id: 'PP-D-1001',
          sequence_number: 20, kind: 'RUN_FAILED', error: 'The model response did not match the schema.',
          created_at: '2026-10-31T20:00:00Z', is_truncated: false }], next_cursor: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return mockFetch(input, options);
    }));
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByText('Analysis needs your review')).toBeTruthy());
    expect(screen.queryByTestId('agent-in-progress-banner')).toBeNull();
    expect(screen.getByText(/No action was proposed by this run/)).toBeTruthy();
  });

  it('does not present a recorded confirmation as independent PayPal proof', () => {
    const event: ApiTimelineEvent = { id: 'ledger-123', dispute_id: 'PP-D-1001', sequence_number: 1,
      kind: 'EXECUTION_CONFIRMED', external_id: '', created_at: '2026-10-31T20:00:00Z', is_truncated: false };
    render(<DecisionTimeline events={[event]} />);
    expect(screen.getByText('Confirmation recorded')).toBeTruthy();
    expect(screen.getByText(/require independent verification/)).toBeTruthy();
    expect(screen.queryByText(/confirmed by PayPal/)).toBeNull();
    expect(screen.getByText(/ledger-123/)).toBeTruthy();
  });

  it('retains separate failed and recorded-confirmation events in mixed history', () => {
    const base = { dispute_id: 'PP-D-1001', created_at: '2026-10-31T20:00:00Z', is_truncated: false };
    const events: ApiTimelineEvent[] = [
      { ...base, id: 'evidence-intended', sequence_number: 1, kind: 'EXECUTION_INTENDED', action_type: 'PROVIDE_EVIDENCE', execution_id: 'evidence-attempt' },
      { ...base, id: 'evidence-failed', sequence_number: 2, kind: 'EXECUTION_FAILED', error_message: 'Evidence was not sent', execution_id: 'evidence-attempt' },
      { ...base, id: 'message-intended', sequence_number: 3, kind: 'EXECUTION_INTENDED', action_type: 'SEND_MESSAGE', execution_id: 'message-attempt' },
      { ...base, id: 'message-confirmed', sequence_number: 4, kind: 'EXECUTION_CONFIRMED', external_id: '', execution_id: 'message-attempt' },
    ];
    render(<DecisionTimeline events={events} />);
    expect(screen.getByText('Execution failed')).toBeTruthy();
    expect(screen.getByText(/Evidence was not sent/)).toBeTruthy();
    expect(screen.getByText('Confirmation recorded')).toBeTruthy();
    expect(screen.getByText('Provide evidence.')).toBeTruthy();
    expect(screen.getByText('Send message.')).toBeTruthy();
    expect(screen.getByText(/require independent verification/)).toBeTruthy();
  });

  it('shows mixed execution attempts independently without implying PayPal success', () => {
    const base = { dispute_id: 'PP-D-1001', created_at: '2026-10-31T20:00:00Z', is_truncated: false };
    const events: ApiTimelineEvent[] = [
      { ...base, id: 'i1', sequence_number: 1, kind: 'EXECUTION_INTENDED', action_type: 'PROVIDE_EVIDENCE', execution_id: 'a' },
      { ...base, id: 'f1', sequence_number: 2, kind: 'EXECUTION_FAILED', error_message: 'Rejected', execution_id: 'a' },
      { ...base, id: 'i2', sequence_number: 3, kind: 'EXECUTION_INTENDED', action_type: 'SEND_MESSAGE', execution_id: 'b' },
      { ...base, id: 'c2', sequence_number: 4, kind: 'EXECUTION_CONFIRMED', external_id: '', execution_id: 'b' },
    ];
    render(<ExecutionAttempts events={events} />);
    expect(screen.getByText('provide evidence')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('send message')).toBeTruthy();
    expect(screen.getByText(/PayPal outcome is not independently verified/)).toBeTruthy();
  });

  it('finds a newer failed run on a later timeline page', async () => {
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/disputes/PP-D-1001/timeline')) {
        requested.push(url);
        const later = new URL(url, 'http://localhost').searchParams.has('cursor');
        const event = later
          ? { id: 'failed', dispute_id: 'PP-D-1001', sequence_number: 101, kind: 'RUN_FAILED',
            error: 'Analysis failed', created_at: '2026-10-31T20:01:00Z', is_truncated: false }
          : { id: 'old', dispute_id: 'PP-D-1001', sequence_number: 100, kind: 'GATE_DECIDED',
            verdict: 'NEEDS_APPROVAL', rule_id: 'G3-01', created_at: '2026-10-31T20:00:00Z', is_truncated: false };
        return new Response(JSON.stringify({ items: [event], next_cursor: later ? null : '100' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return mockFetch(input, options);
    }));
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByText('Analysis needs your review')).toBeTruthy());
    expect(requested.some(url => url.includes('cursor=100'))).toBe(true);
  });

  it('unknown dispute shows not-found state with link back to list', async () => {
    await act(async () => {
      renderAt('/app/disputes/does-not-exist');
    });

    await waitFor(() => {
      expect(screen.getByTestId('dispute-not-found')).toBeTruthy();
    });

    const backLink = screen.getByTestId('back-to-disputes-link');
    expect(backLink.getAttribute('href')).toBe('/app/disputes');
  });

  it('DecisionTimeline renders events strictly ordered by sequence number and renders unknown kinds generically', () => {
    const mixedEvents: ApiTimelineEvent[] = [
      {
        id: 'evt-2',
        dispute_id: 'PP-D-1001',
        sequence_number: 2,
        kind: 'DISPUTE_SYNCED',
        created_at: '2026-10-19T09:00:05Z',
        is_truncated: false,
        status: 'WAITING_FOR_SELLER_RESPONSE',
      },
      {
        id: 'evt-1',
        dispute_id: 'PP-D-1001',
        sequence_number: 1,
        kind: 'WEBHOOK_RECEIVED',
        created_at: '2026-10-19T09:00:00Z',
        is_truncated: false,
        payload: {},
      },
      {
        id: 'evt-99',
        dispute_id: 'PP-D-1001',
        sequence_number: 99,
        kind: 'FUTURE_CUSTOM_EVENT',
        created_at: '2026-10-19T09:05:00Z',
        is_truncated: false,
      },
    ];

    render(<DecisionTimeline events={mixedEvents} />);

    const list = screen.getByTestId('decision-timeline');
    const items = list.querySelectorAll('li');
    expect(items.length).toBe(3);

    // Sequence 1 should be first
    expect(items[0]?.getAttribute('data-testid')).toBe('timeline-event-1');
    expect(items[0]?.textContent).toContain('Webhook received');

    // Sequence 2 second
    expect(items[1]?.getAttribute('data-testid')).toBe('timeline-event-2');
    expect(items[1]?.textContent).toContain('Dispute synced');

    // Sequence 99 rendered generically
    expect(items[2]?.getAttribute('data-testid')).toBe('timeline-event-99');
    expect(items[2]?.textContent).toContain('FUTURE_CUSTOM_EVENT');
  });

  it('labels cached reasoning without calling it a live provider response', () => {
    const event: ApiTimelineEvent = { id: 'plan', dispute_id: 'PP-D-1001', sequence_number: 1,
      kind: 'PLAN_PROPOSED', action_type: 'PROVIDE_EVIDENCE', reasoning_source: 'cached',
      created_at: '2026-10-31T20:00:00Z', is_truncated: false };
    render(<DecisionTimeline events={[event]} />);
    expect(screen.getByText(/Cached reasoning/)).toBeTruthy();
    expect(screen.queryByText(/Provider response/)).toBeNull();
  });

  it('collapses long buyer message and toggles expand/collapse', async () => {
    const longMessage = 'A'.repeat(250);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (urlStr.includes('/api/disputes/PP-D-LONG/timeline')) {
          return Promise.resolve(
            new Response(JSON.stringify({ items: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        if (urlStr.includes('/api/disputes/PP-D-LONG')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'PP-D-LONG',
                status: 'RESOLVED',
                reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
                amount: { value: '45.00', currency_code: 'USD' },
                created_at: '2026-10-19T09:00:00Z',
                updated_at: '2026-10-20T10:00:00Z',
                snapshot: {
                  buyer_message: longMessage,
                },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }
        return mockFetch(input);
      })
    );

    await act(async () => {
      renderAt('/app/disputes/PP-D-LONG');
    });

    await waitFor(() => {
      expect(screen.getByTestId('toggle-buyer-message-button')).toBeTruthy();
    });

    const toggleBtn = screen.getByTestId('toggle-buyer-message-button');
    expect(toggleBtn.textContent).toBe('Show more');
    expect(screen.getByTestId('buyer-message-content').textContent).toContain('...');

    // Expand
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(toggleBtn.textContent).toBe('Show less');
    expect(screen.getByTestId('buyer-message-content').textContent).toBe(longMessage);
  });

  it('preserves pagination cursor in URL and query', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return mockFetch(input, options);
    }));
    await act(async () => {
      renderAt('/app/disputes?cursor=cur-page-2&limit=10');
    });

    await waitFor(() => {
      expect(screen.getByTestId('disputes-table')).toBeTruthy();
    });

    expect(urls.some(url => url.includes('cursor=cur-page-2'))).toBe(true);
  });
});

