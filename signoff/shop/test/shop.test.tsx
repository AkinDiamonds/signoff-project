// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

const MOCK_CATALOG = [
  {
    sku: 'CND-LAV-01',
    name: 'Lavender Fields Soy Candle',
    description: 'Calming French lavender hand-poured in reusable amber glass.',
    price: { value: '21.00', currency_code: 'USD' },
  },
  {
    sku: 'CND-VAN-02',
    name: 'Vanilla Bean & Bourbon Candle',
    description: 'Rich Madagascar vanilla with notes of oak barrel bourbon.',
    price: { value: '19.00', currency_code: 'USD' },
  },
];

describe('Storefront Application (@signoff/shop)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.pushState({}, '', '/');
    window.scrollTo = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const urlStr = String(url);

        // Catalog endpoint
        if (urlStr.includes('/api/shop/catalog') && (!init || init.method === 'GET')) {
          return Promise.resolve(
            new Response(JSON.stringify(MOCK_CATALOG), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        // Create order endpoint
        if (urlStr.includes('/api/shop/orders') && init?.method === 'POST' && !urlStr.includes('/capture')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                order_code: 'SIGTEST123',
                paypal_order_id: 'PP-ORDER-999',
                amount: { value: '42.00', currency_code: 'USD' },
                status: 'PENDING',
              }),
              {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }

        // Capture order endpoint
        if (urlStr.includes('/capture') && init?.method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                order_code: 'SIGTEST123',
                paypal_transaction_id: 'TX-TEST-999',
                status: 'PAID',
                carrier: 'UPS',
                tracking_number: '1Z999AA10SIGTEST123',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }

        // Order detail lookup
        if (urlStr.includes('/api/shop/orders/SIGTEST123')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                order_code: 'SIGTEST123',
                status: 'PAID',
                customer_email: 'alex.morgan@example.test',
                amount: { value: '42.00', currency_code: 'USD' },
                items: [
                  {
                    sku: 'CND-LAV-01',
                    name: 'Lavender Fields Soy Candle',
                    quantity: 2,
                    unit_price: '21.00',
                  },
                ],
                tracking_events: [
                  {
                    carrier: 'UPS',
                    tracking_number: '1Z999AA10SIGTEST123',
                    status: 'IN_TRANSIT',
                    event_time: '2026-10-21T20:00:00Z',
                  },
                ],
                created_at: '2026-10-21T19:55:00Z',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      })
    );
  });

  it('renders storefront persistent sandbox banner with collapsible how-to-pay instructions', async () => {
    await act(async () => {
      render(<App />);
    });

    // Persistent banner
    const banner = screen.getByTestId('shop-banner');
    expect(banner).toBeTruthy();
    expect(screen.getByTestId('shop-banner-text').textContent).toContain('Demo store. Payments use the PayPal sandbox. No real money moves.');

    // External links
    expect(screen.getByTestId('shop-guide-link')).toBeTruthy();
    expect(screen.getByTestId('shop-dashboard-link')).toBeTruthy();

    // Collapsible toggle
    const toggle = screen.getByTestId('shop-banner-how-to-pay-toggle');
    expect(screen.queryByTestId('shop-banner-how-to-pay-content')).toBeNull();

    await act(async () => {
      fireEvent.click(toggle);
    });

    const content = screen.getByTestId('shop-banner-how-to-pay-content');
    expect(content).toBeTruthy();
    expect(screen.getByTestId('shop-buyer-email').textContent).toBe('alex.morgan@example.test');
  });

  it('renders catalog products and money formatted with <Money>', async () => {
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-product-card-CND-LAV-01')).toBeTruthy();
      expect(screen.getByTestId('shop-product-card-CND-VAN-02')).toBeTruthy();
    });

    expect(screen.getByTestId('shop-product-price-CND-LAV-01').textContent).toContain('USD 21.00');
    expect(screen.getByTestId('shop-product-price-CND-VAN-02').textContent).toContain('USD 19.00');
  });

  it('allows adding products to cart and updates cart badge count', async () => {
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-view-product-CND-LAV-01')).toBeTruthy();
    });

    const badge = screen.getByTestId('shop-cart-badge');
    expect(badge.textContent).toBe('0');

    // Click product card to navigate to detail
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-view-product-CND-LAV-01'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-add-to-cart-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-add-to-cart-btn'));
    });

    expect(screen.getByTestId('shop-cart-badge').textContent).toBe('1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-add-to-cart-btn'));
    });

    expect(screen.getByTestId('shop-cart-badge').textContent).toBe('2');
  });

  it('navigates to cart page and displays items with server subtotal', async () => {
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-view-product-CND-LAV-01')).toBeTruthy();
    });

    // Go to product and add to cart
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-view-product-CND-LAV-01'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-add-to-cart-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-add-to-cart-btn'));
    });

    // Navigate to /cart
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-cart-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-cart-row-CND-LAV-01')).toBeTruthy();
    });

    expect(screen.getByTestId('shop-cart-subtotal').textContent).toContain('USD 21.00');
    expect(screen.getByTestId('shop-checkout-btn')).toBeTruthy();
  });

  it('claims a demo order via the shortcut and navigates to confirmation', async () => {
    await act(async () => {
      render(<App />);
    });

    const shortcutBtn = screen.getByTestId('shop-header-demo-order-btn');
    expect(shortcutBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(shortcutBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-confirmation-card')).toBeTruthy();
      expect(screen.getByTestId('shop-order-code').textContent).toBe('SIGTEST123');
    });

    expect(screen.getByTestId('shop-order-status').textContent).toContain('PAID');
    expect(screen.getByTestId('shop-order-amount').textContent).toContain('USD 42.00');
  });

  it('cancel returns with cart items intact', async () => {
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-view-product-CND-LAV-01')).toBeTruthy();
    });

    // Go to product and add
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-view-product-CND-LAV-01'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-add-to-cart-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-add-to-cart-btn'));
    });

    // Go to cart
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-cart-button'));
    });

    // Go to checkout
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-checkout-btn'));
    });

    // Return to cart link
    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-back-to-cart-link'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('shop-cart-row-CND-LAV-01')).toBeTruthy();
    });
    expect(screen.getByTestId('shop-cart-badge').textContent).toBe('1');
  });
});
