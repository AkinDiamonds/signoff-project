// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

const MOCK_ORDER = {
  order_code: 'SIGTEST001',
  status: 'PAID',
  customer_email: 'alex.morgan@example.test',
  amount: { value: '42.00', currency_code: 'USD' },
  items: [
    { sku: 'CND-LAV-01', name: 'Lavender Candle', quantity: 2, unit_price: '21.00' },
  ],
  tracking_events: [
    {
      carrier: 'UPS',
      tracking_number: '1Z999AA10SIGTEST001',
      status: 'IN_TRANSIT',
      event_time: '2026-10-22T10:00:00Z',
    },
  ],
  created_at: '2026-10-21T10:00:00Z',
};

const MOCK_DISPUTE = {
  id: 'PP-D-9001',
  status: 'WAITING_FOR_SELLER_RESPONSE',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  amount: { value: '42.00', currency_code: 'USD' },
  created_at: '2026-10-22T12:00:00Z',
  messages: [
    {
      posted_by: 'BUYER',
      time_posted: '2026-10-22T12:00:00Z',
      content: 'Package never arrived &lt;script&gt;alert(1)&lt;/script&gt;',
    },
  ],
  offer: null,
  order_code: 'SIGTEST001',
  transaction_id: 'TX-TEST-001',
};

describe('Buyer Portal Frontend (@signoff/shop/portal)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.scrollTo = vi.fn();
  });

  it('renders order lookup and fills test buyer credentials', async () => {
    window.history.pushState({}, '', '/orders');
    render(<App />);

    expect(screen.getByTestId('portal-lookup-title')).toBeTruthy();
    const codeInput = screen.getByTestId('portal-order-code-input');
    const emailInput = screen.getByTestId('portal-email-input') as HTMLInputElement;

    // Fill test buyer helper button
    fireEvent.click(screen.getByTestId('portal-fill-test-buyer-btn'));
    expect(emailInput.value).toBe('alex.morgan@example.test');

    // Input order code and submit
    fireEvent.change(codeInput, { target: { value: 'SIGTEST001' } });
    fireEvent.click(screen.getByTestId('portal-lookup-submit-btn'));

    expect(window.location.pathname).toBe('/orders/SIGTEST001');
  });

  it('renders order details and tracking timeline', async () => {
    window.history.pushState({}, '', '/orders/SIGTEST001?email=alex.morgan@example.test');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const u = String(url);
        if (u.includes('/dispute')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                order_code: 'SIGTEST001',
                dispute_eligible: true,
                dispute_exists: false,
                dispute: null,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(MOCK_ORDER), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('portal-order-title').textContent).toContain('Order SIGTEST001');
    });

    expect(screen.getByTestId('portal-tracking-timeline')).toBeTruthy();
    expect(screen.getByTestId('portal-tracking-number').textContent).toContain('1Z999AA10SIGTEST001');
    expect(screen.getByTestId('portal-report-problem-btn')).toBeTruthy();
  });

  it('disables dispute creation with explanation on unlinked buyer account', async () => {
    window.history.pushState({}, '', '/orders/SIGTEST001?email=other@example.com');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const u = String(url);
        if (u.includes('/dispute')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                order_code: 'SIGTEST001',
                dispute_eligible: false,
                ineligibility_reason:
                  'This order was paid with an account other than the linked sandbox buyer (alex.morgan@example.test).',
                dispute_exists: false,
                dispute: null,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...MOCK_ORDER,
              customer_email: 'other@example.com',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('portal-dispute-disabled-banner')).toBeTruthy();
    });

    expect(screen.getByTestId('portal-dispute-disabled-banner').textContent).toContain(
      'This order was paid with an account other than the linked sandbox buyer'
    );
    expect(screen.getByTestId('portal-dispute-demo-order-btn')).toBeTruthy();
  });

  it('files dispute and views dispute with deep link to merchant dashboard', async () => {
    window.history.pushState(
      {},
      '',
      '/orders/SIGTEST001/dispute/new?email=alex.morgan@example.test'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const u = String(url);
        if (init?.method === 'POST') {
          return Promise.resolve(
            new Response(JSON.stringify(MOCK_DISPUTE), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        if (u.includes('/dispute')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                order_code: 'SIGTEST001',
                dispute_eligible: true,
                dispute_exists: false,
                dispute: null,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(MOCK_ORDER), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('portal-report-title')).toBeTruthy();
    });

    // Fill message and submit
    const msgInput = screen.getByTestId('portal-message-input');
    fireEvent.change(msgInput, {
      target: { value: 'Never got the candles! <script>alert(1)</script>' },
    });

    fireEvent.click(screen.getByTestId('portal-submit-dispute-btn'));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/orders/SIGTEST001/dispute');
    });
  });

  it('renders dispute view with plain text messages, reply form, and deep link', async () => {
    window.history.pushState({}, '', '/orders/SIGTEST001/dispute?email=alex.morgan@example.test');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ...MOCK_DISPUTE,
                messages: [
                  ...MOCK_DISPUTE.messages,
                  {
                    posted_by: 'BUYER',
                    time_posted: '2026-10-22T13:00:00Z',
                    content: 'Hostile follow-up reply: where is my refund?',
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              order_code: 'SIGTEST001',
              dispute_eligible: false,
              dispute_exists: true,
              dispute: MOCK_DISPUTE,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('portal-dispute-id').textContent).toContain('PP-D-9001');
    });

    // Verify deep link to merchant dashboard
    const deepLink = screen.getByTestId('portal-view-as-merchant-link') as HTMLAnchorElement;
    expect(deepLink.href).toContain('/disputes/PP-D-9001');

    // Message markup was escaped and safely displayed
    expect(screen.getByTestId('portal-message-content-0').textContent).toContain(
      'Package never arrived &lt;script&gt;alert(1)&lt;/script&gt;'
    );

    // Send reply (Scenario D)
    const replyInput = screen.getByTestId('portal-reply-textarea');
    fireEvent.change(replyInput, {
      target: { value: 'Hostile follow-up reply: where is my refund?' },
    });
    fireEvent.click(screen.getByTestId('portal-send-reply-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('portal-message-content-1').textContent).toContain(
        'Hostile follow-up reply: where is my refund?'
      );
    });
  });
});
