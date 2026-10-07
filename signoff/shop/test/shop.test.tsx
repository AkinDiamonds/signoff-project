// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

describe('Shop Application (@signoff/shop)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', environment: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
  });

  it('renders shop storefront heading and initial loading status', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Luminary Candles')).toBeTruthy();
    expect(screen.getByTestId('shop-status-card')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('shop-status-card')).toBeTruthy();
    });
  });
});
