// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../src/app/routes';
import { advanceMockCharterVersion, mockFetch, resetMockState } from '../src/app/mockFetch';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getByTestId('charter-title')).toBeTruthy();
  });
  await waitFor(() => {
    expect(screen.getByTestId('charter-history-item-1')).toBeTruthy();
  });
}

describe('Charter page (Step 27)', () => {
  beforeEach(() => {
    resetMockState();
    sessionStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders current limits and version history', async () => {
    await act(async () => {
      renderAt('/app/charter');
    });
    await waitForLoaded();

    expect(screen.getByLabelText('Auto-offer maximum (USD)')).toHaveProperty('value', '25.00');
    expect(screen.getByLabelText('Auto-accept maximum (USD)')).toHaveProperty('value', '25.00');
    expect(screen.getByLabelText('Maximum autonomous dispute size (USD)')).toHaveProperty('value', '100.00');
    expect(screen.getByLabelText('Repeat-disputer threshold')).toHaveProperty('value', '2');
    expect(screen.getByTestId('charter-version-history')).toBeTruthy();
  });

  it('shows a field-level error and does not save invalid input', async () => {
    await act(async () => {
      renderAt('/app/charter');
    });
    await waitForLoaded();

    fireEvent.change(screen.getByLabelText('Auto-offer maximum (USD)'), {
      target: { value: '12.345' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('charter-save-button'));
    });

    expect(screen.getByTestId('charter-auto-offer-error').textContent).toContain('two decimals');
    expect(screen.queryByTestId('charter-save-success')).toBeNull();
  });

  it('saves a new version and disables the button while pending', async () => {
    let putCalls = 0;
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          putCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return mockFetch(input, init);
      }
    );

    await act(async () => {
      renderAt('/app/charter');
    });
    await waitForLoaded();

    fireEvent.change(screen.getByLabelText('Auto-offer maximum (USD)'), {
      target: { value: '30' },
    });
    const save = screen.getByTestId('charter-save-button');
    await act(async () => {
      fireEvent.click(save);
      fireEvent.click(save);
    });

    await waitFor(() => {
      expect(screen.getByTestId('charter-save-success').textContent).toContain('v2');
    });
    expect(putCalls).toBe(1);
    await waitFor(() => {
      expect(screen.getByTestId('charter-history-item-2')).toBeTruthy();
    });
  });

  it('shows the newer version on a conflict instead of overwriting it', async () => {
    await act(async () => {
      renderAt('/app/charter');
    });
    await waitForLoaded();

    advanceMockCharterVersion();
    await act(async () => {
      fireEvent.click(screen.getByTestId('charter-save-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('charter-conflict')).toBeTruthy();
    });
    expect(screen.getByTestId('charter-conflict-version').textContent).toBe('v2');
    expect(screen.queryByTestId('charter-save-success')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('charter-load-latest'));
    });
    expect(screen.queryByTestId('charter-conflict')).toBeNull();
  });
});
