// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../src/app/routes';
import { mockFetch, resetMockResolvedTokens } from '../src/app/mockFetch';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe('Approval card feature (Step 26)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetMockResolvedTokens();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders approval page with summary, evidence, proposed action, gate reason and time left', async () => {
    await act(async () => {
      renderAt('/approve/valid-test-token-12345678901234567890');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-title')).toBeTruthy();
    });

    // Proposed action
    expect(screen.getByTestId('proposed-action-type').textContent).toContain('MAKE OFFER');
    expect(screen.getByTestId('proposed-amount')).toBeTruthy();

    // Gate reason and rule
    expect(screen.getByTestId('approval-gate-reason-card')).toBeTruthy();
    expect(screen.getByTestId('approval-verdict-chip')).toBeTruthy();

    // Dispute details
    expect(screen.getByTestId('approval-dispute-id').textContent).toBe('PP-D-1002');
    expect(screen.getByTestId('approval-dispute-amount')).toBeTruthy();
    expect(screen.getByTestId('approval-buyer-message')).toBeTruthy();

    // Evidence panel
    expect(screen.getByTestId('approval-evidence-card')).toBeTruthy();
    expect(screen.getByTestId('approval-evidence-badge')).toBeTruthy();

    // No-referrer policy tag in document head
    const meta = document.querySelector('meta[name="referrer"]');
    expect(meta).toBeTruthy();
    expect(meta?.getAttribute('content')).toBe('no-referrer');
  });

  it('approving dispatches request and shows approved outcome screen', async () => {
    await act(async () => {
      renderAt('/approve/valid-test-token-12345678901234567890');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-approve-button')).toBeTruthy();
    });

    const approveBtn = screen.getByTestId('approval-approve-button');
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-approved')).toBeTruthy();
    });
    expect(screen.getByText('Approval confirmed')).toBeTruthy();
  });

  it('denying confirms denial with optional reason and shows denied outcome screen', async () => {
    await act(async () => {
      renderAt('/approve/valid-test-token-12345678901234567890');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-deny-button')).toBeTruthy();
    });

    // Click Deny
    await act(async () => {
      fireEvent.click(screen.getByTestId('approval-deny-button'));
    });

    expect(screen.getByTestId('approval-deny-card')).toBeTruthy();

    // Input denial reason
    const reasonInput = screen.getByTestId('deny-reason-input');
    fireEvent.change(reasonInput, { target: { value: 'Item was already delivered' } });

    // Confirm denial
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-deny-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-denied')).toBeTruthy();
    });
    expect(screen.getByText('Action denied')).toBeTruthy();
  });

  it('editing amount requires confirmation step for money-moving action before final submit', async () => {
    await act(async () => {
      renderAt('/approve/valid-test-token-12345678901234567890');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-edit-button')).toBeTruthy();
    });

    // Click Edit
    await act(async () => {
      fireEvent.click(screen.getByTestId('approval-edit-button'));
    });

    expect(screen.getByTestId('approval-edit-card')).toBeTruthy();

    // Edit amount input with spaces and commas
    const amountInput = screen.getByTestId('edit-amount-input');
    fireEvent.change(amountInput, { target: { value: '  35.50  ' } });

    // Submit edit to trigger confirmation step
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-edit-button'));
    });

    // Confirmation step must be visible
    await waitFor(() => {
      expect(screen.getByTestId('approval-confirm-edit-card')).toBeTruthy();
    });
    expect(screen.getByTestId('confirmed-amount').textContent).toContain('$35.50 USD');

    // Confirm and submit
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-and-submit-edit-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-approved')).toBeTruthy();
    });
  });

  it('renders expired outcome screen for expired tokens', async () => {
    await act(async () => {
      renderAt('/approve/expired-token');
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-expired')).toBeTruthy();
    });
    expect(screen.getByText('Approval expired')).toBeTruthy();
  });

  it('renders already-resolved outcome screen for resolved tokens', async () => {
    await act(async () => {
      renderAt('/approve/resolved-token');
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-already-resolved')).toBeTruthy();
    });
    expect(screen.getByText('Already resolved')).toBeTruthy();
  });

  it('renders invalid link outcome screen for unknown / 404 tokens', async () => {
    await act(async () => {
      renderAt('/approve/invalid-token');
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-invalid-link')).toBeTruthy();
    });
    expect(screen.getByText('Invalid approval link')).toBeTruthy();
  });

  it('renders stale outcome screen when conflict 409 occurs during resolve', async () => {
    await act(async () => {
      renderAt('/approve/conflict-token');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-approve-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('approval-approve-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-stale')).toBeTruthy();
    });
    expect(screen.getByText('Dispute state conflict')).toBeTruthy();
  });

  it('renders outcome unknown screen on network failure and allows re-verifying', async () => {
    await act(async () => {
      renderAt('/approve/network-error-token');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-approve-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('approval-approve-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-outcome-unknown')).toBeTruthy();
    });
    expect(screen.getByText('Outcome unknown')).toBeTruthy();
    expect(screen.getByTestId('refetch-status-button')).toBeTruthy();
  });

  it('rapid double click does not resubmit or error', async () => {
    await act(async () => {
      renderAt('/approve/valid-test-token-12345678901234567890');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-approve-button')).toBeTruthy();
    });

    const approveBtn = screen.getByTestId('approval-approve-button');
    // Double click rapidly
    await act(async () => {
      fireEvent.click(approveBtn);
      fireEvent.click(approveBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-approved')).toBeTruthy();
    });
  });

  it('back navigation after resolution does not allow resubmission', async () => {
    // 1. Resolve approval
    await act(async () => {
      renderAt('/approve/token-to-resolve-123');
    });

    await waitFor(() => {
      expect(screen.getByTestId('approval-approve-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('approval-approve-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('outcome-approved')).toBeTruthy();
    });

    // 2. Simulate user navigating back to that approval URL
    await act(async () => {
      renderAt('/approve/token-to-resolve-123');
    });

    // Should immediately show ALREADY_RESOLVED, not the approve button
    await waitFor(() => {
      expect(screen.getByTestId('outcome-already-resolved')).toBeTruthy();
    });
    expect(screen.queryByTestId('approval-approve-button')).toBeNull();
  });
});

