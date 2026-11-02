// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

it('uses generic deduplicated copy and click opens only the authenticated case', async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);
  const jobs: Promise<unknown>[] = [];
  runInNewContext(readFileSync('signoff/web/public/sw.js', 'utf8'), { URL, self: {
    location: { origin: 'https://merchant.example.test' },
    skipWaiting,
    registration: { showNotification },
    clients: { matchAll: async () => [], openWindow, claim },
    addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
  } });
  expect(handlers.has('fetch')).toBe(false);
  for (const name of ['install', 'activate']) {
    handlers.get(name)?.({ waitUntil: (job: Promise<unknown>) => jobs.push(job) });
  }
  await Promise.all(jobs);
  expect(skipWaiting).toHaveBeenCalledOnce();
  expect(claim).toHaveBeenCalledOnce();
  const data = { notificationId: '12345678-1234-1234-1234-123456789012', disputeId: 'PP-PUSH',
    body: 'PRIVATE BUYER TEXT', url: 'https://evil.example.test' };
  handlers.get('push')?.({ data: { json: () => data }, waitUntil: (job: Promise<unknown>) => jobs.push(job) });
  await Promise.all(jobs);
  expect(showNotification.mock.calls[0]).toEqual(['Signoff', {
    body: 'A dispute needs your review', icon: '/icon-192.png', tag: `signoff:${data.notificationId}`, renotify: false,
    data: { path: '/app/disputes/PP-PUSH' },
  }]);
  handlers.get('notificationclick')?.({ notification: { close: vi.fn(), data: { path: '/app/disputes/PP-PUSH' } },
    waitUntil: (job: Promise<unknown>) => jobs.push(job) });
  await Promise.all(jobs);
  expect(openWindow).toHaveBeenCalledWith('https://merchant.example.test/app/disputes/PP-PUSH');
  handlers.get('notificationclick')?.({ notification: { close: vi.fn(), data: { path: '//evil.example.test' } },
    waitUntil: (job: Promise<unknown>) => jobs.push(job) });
  expect(openWindow).toHaveBeenCalledTimes(1);
});
