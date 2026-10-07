// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

describe('Shop Application (@signoff/shop)', () => {
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
