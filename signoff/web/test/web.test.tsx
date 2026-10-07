// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

describe('Web Application (@signoff/web)', () => {
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

  it('renders merchant dashboard heading and initial loading status', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Signoff Merchant Operations')).toBeTruthy();
    expect(screen.getByTestId('merchant-status-card')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('merchant-status-card')).toBeTruthy();
    });
  });
});
