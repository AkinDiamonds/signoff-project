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
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return router;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function stubEvidence(body: unknown, onRefresh?: (method: string) => void) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = urlOf(input);
    if (url.includes('/api/disputes/PP-D-1001/evidence/refresh')) {
      onRefresh?.(options?.method ?? 'GET');
      return new Response('{}', { status: 200, headers: JSON_HEADERS });
    }
    if (url.includes('/api/disputes/PP-D-1001/evidence')) {
      return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
    }
    return mockFetch(input, options);
  }));
}

describe('Dispute detail tabs', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens on Overview with the summary, buyer statement and untrusted text', async () => {
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByTestId('dispute-detail-id').textContent).toContain('PP-D-1001'));

    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('dispute-summary-card')).toBeTruthy();
    expect(screen.getByTestId('dispute-status-summary')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Buyer statement' })).toBeTruthy();
    expect(screen.getByTestId('untrusted-text-label')).toBeTruthy();
    expect(screen.queryByTestId('dispute-evidence-panel')).toBeNull();
    expect(screen.queryByTestId('decision-timeline')).toBeNull();

    const message = screen.getByTestId('buyer-message-content');
    expect(message.textContent).toContain('<script>alert("xss")</script>');
    const injected = Array.from(document.querySelectorAll('script')).filter(script => (script.textContent ?? '').includes('alert("xss")'));
    expect(injected).toHaveLength(0);
  });

  it('switches to Evidence from the tab and from "Inspect details", keeping ?tab= in the URL', async () => {
    await act(async () => { renderAt('/app/disputes/PP-D-1001'); });
    await waitFor(() => expect(screen.getByTestId('dispute-summary-card')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Inspect details/ }));
    await waitFor(() => expect(screen.getByTestId('dispute-evidence-panel')).toBeTruthy());
    expect(window.location.search).toBe('?tab=evidence');
    expect(screen.getByTestId('evidence-strength-badge').textContent?.toLowerCase()).toContain('high');

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    await waitFor(() => expect(screen.getByTestId('decision-timeline-card')).toBeTruthy());
    expect(window.location.search).toBe('?tab=activity');

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    await waitFor(() => expect(screen.getByTestId('dispute-summary-card')).toBeTruthy());
    expect(window.location.search).toBe('');
  });

  it('deep-links straight to a tab and keeps raw ids inside Technical details', async () => {
    stubEvidence([{
      run_id: 'run-example', captured_at: '2026-10-31T20:00:00Z', content_hash: 'abc',
      evidence: { version: 1, order_code: 'SIG-EXAMPLE', payment_reference: 'CAPTURE-EXAMPLE',
        order_created_at: '2026-10-31T19:00:00Z', amount: '24.00', currency: 'USD', items: ['Item'],
        milestones: [{ carrier: 'UPS', tracking_number: 'SIM123', status: 'IN_TRANSIT',
          event_time: '2026-10-31T19:30:00Z', source: 'simulated', source_id: 'rec-1' }],
        buildable: true, evidence_type: 'PROOF_OF_FULFILLMENT', notes: 'Recorded order notes',
        explanation: 'Tracking present', score: 40, strength: 'MEDIUM', tracking_submission_count: 0,
        components: [{ name: 'tracking', points: 40, detail: 'Tracking recorded' }] },
    }]);
    await act(async () => { renderAt('/app/disputes/PP-D-1001?tab=evidence'); });
    await waitFor(() => expect(screen.getByText('Simulated delivery')).toBeTruthy());

    expect(screen.getByText('Medium · 40/100')).toBeTruthy();
    expect(screen.getByText('Order match')).toBeTruthy();
    expect(screen.getByText('Submission preview')).toBeTruthy();
    expect(screen.getByText('Notes only. Does not submit to PayPal.')).toBeTruthy();

    const technical = screen.getByTestId('evidence-technical-details');
    expect(technical.textContent).toMatch(/run-example/);
    expect(technical.textContent).toMatch(/IN_TRANSIT.*simulated.*SIM123/);
    expect(technical.textContent).toMatch(/tracking: 40.*Tracking recorded/);
    expect(technical.textContent).toMatch(/Submission preview: PROOF_OF_FULFILLMENT/);
    expect(screen.queryByText(/run-example/, { ignore: '[data-testid="evidence-technical-details"] *' })).toBeNull();
  });

  it('distinguishes an unavailable store review from a model run or a missing order', async () => {
    stubEvidence([{
      run_id: 'review-example', capture_kind: 'pre_model_review', review_reason: 'store_unavailable',
      captured_at: '2026-10-31T20:00:00Z', content_hash: 'abc',
      evidence: { version: 1, order_code: null, payment_reference: null, order_created_at: null,
        amount: null, currency: null, items: [], milestones: [], buildable: false,
        evidence_type: null, notes: null, explanation: 'The store was unavailable; order evidence could not be checked.',
        score: null, strength: null, components: [] },
    }]);
    await act(async () => { renderAt('/app/disputes/PP-D-1001?tab=evidence'); });
    const technical = await waitFor(() => {
      const element = screen.getByTestId('evidence-technical-details');
      expect(element.textContent).toMatch(/Review before model run.*review-example/);
      return element;
    });
    expect(technical.textContent).toMatch(/store was unavailable/);
    expect(technical.textContent).toMatch(/Review stopped before a model plan was created/);
    expect(screen.queryByText(/Order: Not found/)).toBeNull();
  });

  it('refreshes evidence without claiming an agent run or PayPal action', async () => {
    const requests: string[] = [];
    stubEvidence([], method => requests.push(method));
    await act(async () => { renderAt('/app/disputes/PP-D-1001?tab=evidence'); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh evidence' })).toBeTruthy());
    expect(screen.getByText('Does not submit to PayPal.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await waitFor(() => expect(screen.getByText(/No model plan or PayPal action was started/)).toBeTruthy());
    expect(requests).toEqual(['POST']);
  });

  it('labels the Activity tab, hides audit references until Technical details, and dedupes repeats', () => {
    const base = { dispute_id: 'PP-D-1001', created_at: '2026-11-02T10:40:10Z', is_truncated: false };
    const events: ApiTimelineEvent[] = [
      { ...base, id: 'a1', sequence_number: 1, kind: 'APPROVAL_RESOLVED', resolution: 'APPROVE' },
      { ...base, id: 'a2', sequence_number: 2, kind: 'APPROVAL_RESOLVED', resolution: 'APPROVE', created_at: '2026-11-02T10:40:50Z' },
      { ...base, id: 'g1', sequence_number: 3, kind: 'GATE_DECIDED', verdict: 'NEEDS_APPROVAL', rule_id: 'G5-01' },
    ];
    render(<DecisionTimeline events={events} />);
    expect(screen.getAllByText('Approval recorded')).toHaveLength(1);
    expect(screen.getByText('Review required')).toBeTruthy();
    expect(screen.queryByText('Audit reference')).toBeNull();
    expect(screen.getByTestId('timeline-technical-details').textContent).toContain('Event a1');
  });

  it('does not claim active analysis or invent an approval link while waiting for approval', async () => {
    await act(async () => { renderAt('/app/disputes/PP-D-1002'); });
    await waitFor(() => expect(screen.getByTestId('dispute-detail-id').textContent).toContain('PP-D-1002'));
    expect(screen.queryByTestId('agent-in-progress-banner')).toBeNull();
    expect(screen.queryByTestId('open-approval-card-button')?.getAttribute('href') ?? '').not.toContain('/approve/mock-');
  });
});
