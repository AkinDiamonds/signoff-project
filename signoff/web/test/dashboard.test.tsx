// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { mockFetch, resetMockState } from '../src/app/mockFetch';

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

async function waitForDashboard() {
  await waitFor(() => {
    expect(screen.getByTestId('dashboard-title')).toBeTruthy();
    expect(screen.getByTestId('dashboard-disputes-table')).toBeTruthy();
  });
}

describe('Dashboard and read-only assistant (Step 28)', () => {
  beforeEach(() => {
    resetMockState();
    sessionStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders KPI numbers from the API and the assumption footnote', async () => {
    await act(async () => {
      renderAt('/app');
    });
    await waitForDashboard();

    expect(screen.getByTestId('kpi-open-disputes').textContent).toBe('2');
    expect(screen.getByTestId('kpi-dollars-at-risk').textContent).toBe('USD 149.50');
    expect(screen.getByTestId('kpi-recovered').textContent).toBe('USD 42.00');
    expect(screen.getByTestId('kpi-conceded').textContent).toBe('USD 0.00');
    expect(screen.getByTestId('kpi-share-auto').textContent).toBe('50%');
    expect(screen.getByTestId('kpi-hours-saved').textContent).toBe('0.67 h');
    expect(screen.getByTestId('kpi-assumption').textContent).toContain('20 minutes per closed dispute');
    expect(screen.getByTestId('dashboard-dispute-row-PP-D-1001')).toBeTruthy();
    expect(screen.getByTestId('dashboard-dispute-row-PP-D-1002')).toBeTruthy();
  });

  it('offers a plain dispute list and a loadable Studio workspace', async () => {
    await act(async () => {
      renderAt('/app');
    });
    await waitForDashboard();

    expect(screen.getByTestId('studio-prompt')).toBeTruthy();
    expect(screen.getByTestId('studio-load-button')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Or use the plain dispute list' }).getAttribute('href')).toBe(
      '/app/disputes'
    );
  });

  it('answers a sample question through the proxy', async () => {
    await act(async () => {
      renderAt('/app');
    });
    await waitForDashboard();

    expect(screen.getByTestId('assistant-readonly-label').textContent).toContain('cannot approve');

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-sample-0'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('assistant-answer').textContent).toContain('2 open disputes');
    });
    expect(screen.getByTestId('assistant-answer').textContent).toContain('USD 149.50 at risk');
  });

  it('shows a friendly message when the assistant budget is exhausted', async () => {
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/llm')) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'BUDGET_EXHAUSTED',
                message: 'The daily assistant budget is exhausted. Try again tomorrow.',
                correlation_id: 'mock-budget',
                fields: [],
              },
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return mockFetch(input, init);
      }
    );

    await act(async () => {
      renderAt('/app');
    });
    await waitForDashboard();

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-sample-0'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('assistant-error').textContent).toContain('budget is exhausted');
    });
  });
});
