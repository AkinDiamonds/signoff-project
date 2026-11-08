// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CheckoutPage } from '../src/pages/CheckoutPage';
import { RouterProvider } from '../src/router';

vi.mock('../src/CartContext', () => ({
  useCart: () => ({
    items: [{ sku: 'CND-LAV-01', quantity: 1 }],
    subtotal: { value: '21.00', currency_code: 'USD' },
    clearCart: vi.fn(),
  }),
}));

const renderButtons = vi.fn().mockResolvedValue(undefined);
const buttons = vi.fn(() => ({ render: renderButtons }));
const checkout = () => render(<React.StrictMode><RouterProvider><CheckoutPage /></RouterProvider></React.StrictMode>);
const sdkScript = () => {
  const script = document.getElementById('paypal-js-sdk');
  if (!(script instanceof HTMLScriptElement)) throw new Error('SDK script missing');
  return script;
};
const finishLoading = () => act(() => {
  window.paypal = { Buttons: buttons };
  sdkScript().dispatchEvent(new Event('load'));
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  delete window.paypal;
  document.getElementById('paypal-js-sdk')?.remove();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.paypal;
  document.getElementById('paypal-js-sdk')?.remove();
});

it('renders buttons when the SDK finishes loading on first checkout or refresh', async () => {
  checkout();
  expect(buttons).not.toHaveBeenCalled();
  expect(screen.getByTestId('shop-sdk-loading')).toBeTruthy();
  await finishLoading();
  expect(renderButtons).toHaveBeenCalledTimes(1);
  expect(renderButtons).toHaveBeenCalledWith(screen.getByTestId('shop-paypal-buttons'));
  expect(screen.queryByTestId('shop-sdk-loading')).toBeNull();
});

it('subscribes to a pending SDK after leaving and returning to checkout', async () => {
  const first = checkout();
  const script = sdkScript();
  first.unmount();
  checkout();
  expect(sdkScript()).toBe(script);
  expect(screen.getByTestId('shop-sdk-loading')).toBeTruthy();
  await finishLoading();
  expect(renderButtons).toHaveBeenCalledTimes(1);
});

it('renders already-loaded SDK buttons when returning from cart', () => {
  window.paypal = { Buttons: buttons };
  const first = checkout();
  expect(renderButtons).toHaveBeenCalledTimes(1);
  first.unmount();
  checkout();
  expect(renderButtons).toHaveBeenCalledTimes(2);
});

it('shows a load error and recovers if the SDK arrives after the timeout', async () => {
  checkout();
  await act(async () => { vi.advanceTimersByTime(4000); });
  expect(screen.getByTestId('shop-sdk-error-state')).toBeTruthy();
  expect(buttons).not.toHaveBeenCalled();
  await finishLoading();
  expect(renderButtons).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('shop-sdk-error-state')).toBeNull();
});

it('shows script failures without rendering buttons', async () => {
  checkout();
  await act(async () => { sdkScript().dispatchEvent(new Event('error')); });
  expect(screen.getByTestId('shop-sdk-error-state')).toBeTruthy();
  expect(buttons).not.toHaveBeenCalled();
});
