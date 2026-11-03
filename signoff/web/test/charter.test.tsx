// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@signoff/ui';
import { routes } from '../src/app/routes';
import { advanceMockCharterVersion, mockFetch, resetMockState } from '../src/app/mockFetch';

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

  it('does not create a version when the form is unchanged or reverted', async () => {
    const fetchSpy = vi.fn(mockFetch);
    vi.stubGlobal('fetch', fetchSpy);
    renderAt('/app/policy');
    await waitForLoaded();
    const save = screen.getByTestId<HTMLButtonElement>('charter-save-button');
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    const input = screen.getByLabelText('Auto-offer maximum (USD)');
    fireEvent.change(input, { target: { value: '30' } });
    expect(save.disabled).toBe(false);
    fireEvent.change(input, { target: { value: '25' } });
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
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

  it('saves the missing-delivery choice and retains it after reload', async () => {
    const view = renderAt('/app/charter');
    await waitForLoaded();
    const choice = screen.getByTestId<HTMLSelectElement>('charter-missing-delivery-policy');
    expect(choice.value).toBe('HUMAN_REVIEW');
    fireEvent.change(choice, { target: { value: 'GATED_SETTLEMENT' } });
    fireEvent.click(screen.getByTestId('charter-save-button'));
    await waitFor(() => expect(screen.getByTestId('charter-save-success')).toBeTruthy());
    view.unmount();
    renderAt('/app/charter');
    await waitFor(() => expect(screen.getByTestId<HTMLSelectElement>('charter-missing-delivery-policy').value)
      .toBe('GATED_SETTLEMENT'));
  });

  it('shows the newer version on a conflict instead of overwriting it', async () => {
    await act(async () => {
      renderAt('/app/charter');
    });
    await waitForLoaded();

    advanceMockCharterVersion();
    fireEvent.change(screen.getByLabelText('Auto-offer maximum (USD)'), { target: { value: '30' } });
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
