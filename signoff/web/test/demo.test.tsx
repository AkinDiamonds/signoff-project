// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { mockFetch, resetMockState, setMockDemoMode } from '../src/app/mockFetch';
import { idempotencyKeyFor } from '../src/features/demo/api';
import { SCENARIO_BUTTONS } from '../src/features/demo/types';

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

async function waitForPanel() {
  await waitFor(() => {
    expect(screen.getByTestId('demo-panel-title')).toBeTruthy();
    expect(screen.getByTestId('demo-pool-status')).toBeTruthy();
  });
}

describe('Demo panel (Step 27)', () => {
  beforeEach(() => {
    resetMockState();
    sessionStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows all five scenario buttons with their expected outcome', async () => {
    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    for (const scenario of SCENARIO_BUTTONS) {
      expect(screen.getByTestId(`demo-scenario-${scenario.id}`)).toBeTruthy();
      expect(screen.getByTestId(`demo-scenario-${scenario.id}-expected`).textContent).toContain(
        scenario.expected
      );
    }
    expect(SCENARIO_BUTTONS).toHaveLength(5);
  });

  it('creates a scenario, waits for the dispute and links to it', async () => {
    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('demo-scenario-C'));
    });

    await waitFor(
      () => {
        expect(screen.getByTestId('demo-created-link').textContent).toContain('PP-DEMO-C-1');
      },
      { timeout: 4000 }
    );
    expect(screen.getByTestId('demo-created-link').getAttribute('href')).toBe(
      '/app/disputes/PP-DEMO-C-1'
    );
  });

  it('disables scenario buttons while creation is pending', async () => {
    let postCalls = 0;
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          postCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return mockFetch(input, init);
      }
    );

    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    const button = screen.getByTestId('demo-scenario-A');
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(button).toHaveProperty('disabled', true);
    await waitFor(() => {
      expect(screen.getByTestId('demo-created-link')).toBeTruthy();
    });
    expect(postCalls).toBe(1);
  });

  it('shows the frozen banner and disables actions when the demo is frozen', async () => {
    setMockDemoMode({ frozen: true });
    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    expect(screen.getByTestId('demo-frozen-banner')).toBeTruthy();
    expect(screen.getByTestId('demo-scenario-A')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('demo-reset-button')).toHaveProperty('disabled', true);
  });

  it('shows a quota message on 429', async () => {
    setMockDemoMode({ quotaExceeded: true });
    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('demo-scenario-B'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('demo-error').textContent).toContain('Daily demo quota reached');
    });
    expect(screen.getByTestId('demo-error').textContent).toContain('Resets at');
  });

  it('shows a distinct message when the pool is empty', async () => {
    setMockDemoMode({ poolEmpty: true });
    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('demo-scenario-D'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('demo-error').textContent).toContain('pool for scenario D is empty');
    });
  });

  it('resets only the current session', async () => {
    await act(async () => {
      renderAt('/app/demo');
    });
    await waitForPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('demo-scenario-A'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('demo-created-link')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('demo-reset-button'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('demo-reset-result').textContent).toContain('ledger rows are kept');
    });
  });

  it('reuses the same idempotency key after leaving and returning', () => {
    const first = idempotencyKeyFor('A');
    const second = idempotencyKeyFor('A');
    const other = idempotencyKeyFor('B');
    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });
});

describe('Judge pool page (Step 06)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetMockState();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/app/pool?mock-pool=judge');
    fetchSpy = vi.fn(mockFetch);
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('lists pooled disputes and finished runs with verdict and rule id', async () => {
    await act(async () => {
      renderAt('/app/pool');
    });

    await waitFor(() => {
      expect(screen.getByTestId('judge-pool-page')).toBeTruthy();
    });

    expect(screen.getByText('Delivered with tracking — the agent fights this one')).toBeTruthy();
    const verdict = screen.getByTestId('finished-verdict-PP-MOCK-POOL-3');
    expect(verdict.textContent).toContain('NEEDS_APPROVAL');
    expect(verdict.textContent).toContain('G3-04');
  });

  it('Start over clears the judge session without mutating the ledger', async () => {
    sessionStorage.setItem('signoff.demo.session', 'demo-session-before-start-over');

    await act(async () => {
      renderAt('/app/pool');
    });
    await waitFor(() => {
      expect(screen.getByTestId('judge-pool-page')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pool-start-over-button'));
    });

    expect(sessionStorage.getItem('signoff.demo.session')).toBeNull();
    expect(screen.getByTestId('pool-start-over-notice')).toBeTruthy();

    const mutatingCalls = fetchSpy.mock.calls.filter(([, init]) => {
      const method = init?.method?.toUpperCase();
      return method !== undefined && method !== 'GET';
    });
    expect(mutatingCalls).toHaveLength(0);
  });
});
