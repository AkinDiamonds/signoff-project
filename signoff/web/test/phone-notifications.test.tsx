// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhoneNotifications } from '../src/features/settings/PhoneNotifications';

afterEach(() => vi.unstubAllGlobals());

it('never requests permission on load and explains unsupported devices', async () => {
  const requestPermission = vi.fn();
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false, public_key: null,
    pending_deliveries: 0, failed_deliveries: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  render(<PhoneNotifications />);
  await waitFor(() => expect(screen.getByText(/pending deliveries/)).toBeTruthy());
  expect(requestPermission).not.toHaveBeenCalled();
  expect(screen.getByText(/does not support/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Enable phone notifications' }).hasAttribute('disabled')).toBe(true);
});

it('updates an existing worker on refresh without requesting permission again', async () => {
  const requestPermission = vi.fn();
  const update = vi.fn(async () => undefined);
  const registration = { update, pushManager: { getSubscription: async () => ({ endpoint: 'fixture' }) } };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true,
    value: { getRegistration: async () => registration } });
  vi.stubGlobal('PushManager', function () {});
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: true, public_key: 'AQID',
    pending_deliveries: 0, failed_deliveries: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  const view = render(<PhoneNotifications />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Disable phone notifications' })).toBeTruthy());
  expect(update).toHaveBeenCalledOnce();
  expect(requestPermission).not.toHaveBeenCalled();
  view.unmount();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

it('opts in only on a tap and revokes the server destination before browser unsubscribe', async () => {
  const order: string[] = [];
  const requestPermission = vi.fn(async () => 'granted');
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/fictional',
    getKey: () => new Uint8Array([1, 2, 3]).buffer,
    unsubscribe: vi.fn(async () => { order.push('browser-unsubscribe'); return true; }) };
  const registration = { pushManager: { getSubscription: vi.fn(async (): Promise<typeof subscription | null> => null),
    subscribe: vi.fn(async () => subscription) } };
  const worker = { getRegistration: vi.fn(async (): Promise<typeof registration | undefined> => undefined), register: vi.fn(async () => registration),
    ready: Promise.resolve(registration) };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: worker });
  vi.stubGlobal('PushManager', function () {});
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/remove')) {
      order.push('server-unsubscribe');
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(url.endsWith('/config')
      ? { available: true, public_key: 'AQID', pending_deliveries: 0, failed_deliveries: 0 }
      : { id: 'fictional-id', active: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  const view = render(<PhoneNotifications />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable phone notifications' }).hasAttribute('disabled')).toBe(false));
  expect(requestPermission).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enable phone notifications' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Disable phone notifications' })).toBeTruthy());
  expect(requestPermission).toHaveBeenCalledTimes(1);
  registration.pushManager.getSubscription.mockImplementation(async () => subscription);
  worker.getRegistration.mockImplementation(async () => registration);
  fireEvent.click(screen.getByRole('button', { name: 'Disable phone notifications' }));
  await waitFor(() => expect(screen.getByText(/disabled on this device/)).toBeTruthy());
  expect(order).toEqual(['server-unsubscribe', 'browser-unsubscribe']);
  view.unmount();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});
