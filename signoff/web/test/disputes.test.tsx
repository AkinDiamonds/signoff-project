// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { mockFetch } from '../src/app/mockFetch';
import { DecisionTimeline } from '../src/features/disputes/timeline';
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
    });

    expect(screen.getByTestId('filter-status')).toBeTruthy();
    expect(screen.getByTestId('filter-reason')).toBeTruthy();
    expect(screen.getByTestId('scope-mine-button')).toBeTruthy();
    expect(screen.getByTestId('scope-all-button')).toBeTruthy();

    expect(screen.getByTestId('dispute-row-PP-D-1001')).toBeTruthy();
    expect(screen.getByTestId('dispute-row-PP-D-1002')).toBeTruthy();
  });

  it('invalid URL filter values fall back to defaults', async () => {
    await act(async () => {
      renderAt('/app/disputes?status=INVALID_STATUS&reason=INVALID_REASON&scope=invalid_scope');
    });

    await waitFor(() => {
      expect(screen.getByTestId('filter-status')).toBeTruthy();
    });

    const statusSelect = screen.getByTestId<HTMLSelectElement>('filter-status');
    const reasonSelect = screen.getByTestId<HTMLSelectElement>('filter-reason');
    expect(statusSelect.value).toBe('ALL');
    expect(reasonSelect.value).toBe('ALL');
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

  it('renders dispute detail page with summary, evidence panel, and untrusted message', async () => {
    await act(async () => {
      renderAt('/app/disputes/PP-D-1001');
    });

    await waitFor(() => {
      expect(screen.getByTestId('dispute-detail-id').textContent).toContain('PP-D-1001');
    });

    expect(screen.getByTestId('dispute-summary-card')).toBeTruthy();
    expect(screen.getByTestId('dispute-evidence-panel')).toBeTruthy();
    expect(screen.getByTestId('evidence-strength-badge').textContent?.toLowerCase()).toBe('high');

    // Untrusted text label
    expect(screen.getByTestId('untrusted-text-label')).toBeTruthy();

    // Script markup is rendered as plain text
    const messageEl = screen.getByTestId('buyer-message-content');
    expect(messageEl.textContent).toContain('<script>alert("xss")</script>');
    // Ensure no script element was injected with the message payload
    const injectedScripts = Array.from(document.querySelectorAll('script')).filter((script) =>
      (script.textContent ?? '').includes('alert("xss")')
    );
    expect(injectedScripts).toHaveLength(0);
  });

  it('shows the saved run evidence and labels simulated tracking', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/disputes/PP-D-1001/evidence')) {
        return new Response(JSON.stringify([{
          run_id: 'run-example', captured_at: '2026-10-31T20:00:00Z', content_hash: 'abc',
          evidence: { version: 1, order_code: 'SIG-EXAMPLE', payment_reference: 'CAPTURE-EXAMPLE',
            order_created_at: '2026-10-31T19:00:00Z', amount: '24.00', currency: 'USD', items: ['Item'],
            milestones: [{ carrier: 'UPS', tracking_number: 'SIM123', status: 'IN_TRANSIT',
              event_time: '2026-10-31T19:30:00Z', source: 'simulated' }],
            buildable: true, evidence_type: 'PROOF_OF_FULFILLMENT', notes: 'Recorded order notes',
            explanation: 'Tracking present', score: 40, strength: 'MEDIUM',
            components: [{ name: 'Tracking', points: 40, detail: 'Tracking recorded' }] },
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return mockFetch(input, options);
    }));
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByText(/run-example/)).toBeTruthy());
    expect(screen.getByText(/IN_TRANSIT.*simulated.*SIM123/)).toBeTruthy();
    expect(screen.getByText(/Tracking: 40.*Tracking recorded/)).toBeTruthy();
    expect(screen.getByText(/Submission preview: PROOF_OF_FULFILLMENT/)).toBeTruthy();
  });

  it('distinguishes an unavailable store review from a model run or a missing order', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/disputes/PP-D-1001/evidence')) {
        return new Response(JSON.stringify([{
          run_id: 'review-example', capture_kind: 'pre_model_review', review_reason: 'store_unavailable',
          captured_at: '2026-10-31T20:00:00Z', content_hash: 'abc',
          evidence: { version: 1, order_code: null, payment_reference: null, order_created_at: null,
            amount: null, currency: null, items: [], milestones: [], buildable: false,
            evidence_type: null, notes: null, explanation: 'The store was unavailable; order evidence could not be checked.',
            score: null, strength: null, components: [] },
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return mockFetch(input, options);
    }));
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByText(/Review before model run.*review-example/)).toBeTruthy());
    expect(screen.getByText(/store was unavailable/)).toBeTruthy();
    expect(screen.getByText(/Review stopped before a model plan was created/)).toBeTruthy();
    expect(screen.queryByText(/Order: Not found/)).toBeNull();
  });

  it('refreshes evidence without claiming an agent run or PayPal action', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/disputes/PP-D-1001/evidence/refresh')) {
        requests.push(options?.method ?? 'GET');
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/disputes/PP-D-1001/evidence')) {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return mockFetch(input, options);
    }));
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh evidence' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await waitFor(() => expect(screen.getByText(/No model plan or PayPal action was started/)).toBeTruthy());
    expect(requests).toEqual(['POST']);
  });

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
    await act(async () => {
      renderAt('/app/disputes?cursor=cur-page-2&limit=10');
    });

    await waitFor(() => {
      expect(screen.getByTestId('disputes-table')).toBeTruthy();
    });

    // Reset button should be visible when non-default cursor is in URL
    expect(screen.getByTestId('reset-filters-button')).toBeTruthy();
    expect(screen.getByTestId('pagination-prev-button')).not.toBeDisabled();
  });
});

