// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

const MOCK_ORDER = {
  order_code: 'SIGTEST001', status: 'PAID', customer_email: 'buyer@example.test',
  amount: { value: '42.00', currency_code: 'USD' },
  items: [{ sku: 'CND-LAV-01', name: 'Lavender Candle', quantity: 2, unit_price: '21.00' }],
  tracking_events: [{
    carrier: 'UPS', tracking_number: '1Z999AA10SIGTEST001', status: 'IN_TRANSIT',
    event_time: '2026-10-22T10:00:00Z',
  }],
  created_at: '2026-10-21T10:00:00Z',
};

describe('Buyer order tracking and PayPal handoff', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.scrollTo = vi.fn();
    vi.stubEnv('VITE_STUB_CHECKOUT', 'false');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify(MOCK_ORDER), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )));
  });

  it('looks up an order with its code and buyer email', () => {
    window.history.pushState({}, '', '/orders');
    render(<App />);
    expect(screen.getByTestId('portal-lookup-title')).toBeTruthy();
    fireEvent.change(screen.getByTestId('portal-order-code-input'), { target: { value: 'SIGTEST001' } });
    fireEvent.change(screen.getByTestId('portal-email-input'), { target: { value: 'buyer@example.test' } });
    fireEvent.click(screen.getByTestId('portal-lookup-submit-btn'));
    expect(window.location.pathname).toBe('/orders/SIGTEST001');
  });

  it('shows tracking and sends payment problems to PayPal without fetching an app-hosted dispute', async () => {
    window.history.pushState({}, '', '/orders/SIGTEST001?email=buyer@example.test');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('portal-order-title').textContent).toContain('Order SIGTEST001'));
    expect(screen.getByTestId('portal-tracking-number').textContent).toContain('1Z999AA10SIGTEST001');
    expect(screen.getByTestId('paypal-resolution-link').getAttribute('href')).toBe('https://www.sandbox.paypal.com/disputes/');
    expect(screen.queryByTestId('portal-report-problem-btn')).toBeNull();
    expect(screen.queryByRole('textbox', { name: /message|problem/i })).toBeNull();
    for (const [url, init] of vi.mocked(fetch).mock.calls) {
      expect(String(url)).not.toContain('/dispute');
      expect(init?.method ?? 'GET').toBe('GET');
    }
  });

  it.each(['/orders/SIGTEST001/dispute/new', '/orders/SIGTEST001/dispute'])(
    'old buyer route %s provides only the PayPal handoff', path => {
      window.history.pushState({}, '', path);
      render(<App />);
      expect(screen.getByTestId('paypal-resolution-guidance').textContent).toContain('Disputes are filed on PayPal');
      const link = screen.getByTestId('paypal-resolution-link');
      expect(link.getAttribute('href')).toBe('https://www.sandbox.paypal.com/disputes/');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(screen.queryByRole('textbox')).toBeNull();
      for (const [url, init] of vi.mocked(fetch).mock.calls) {
        expect(String(url)).not.toContain('/dispute');
        expect(init?.method ?? 'GET').toBe('GET');
      }
    }
  );

  it('uses PayPal for every buyer account rather than an app-specific linked-buyer restriction', async () => {
    window.history.pushState({}, '', '/orders/SIGTEST001?email=another@example.test');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('paypal-resolution-link')).toBeTruthy());
    expect(screen.queryByTestId('portal-dispute-disabled-banner')).toBeNull();
    expect(screen.queryByTestId('portal-dispute-demo-order-btn')).toBeNull();
  });
});
