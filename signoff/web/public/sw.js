/* Signoff push worker v1: no fetch handler, offline cache, approval or payment requests. */
/* global self */
self.addEventListener('push', event => {
  let data;
  try { data = event.data.json(); } catch { return; }
  if (!data || typeof data.notificationId !== 'string' || typeof data.disputeId !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(data.notificationId) || data.disputeId.length > 100) return;
  event.waitUntil(self.registration.showNotification('Signoff', {
    body: 'A dispute needs your review', icon: '/icon.svg',
    tag: `signoff:${data.notificationId}`, renotify: false,
    data: { path: `/app/disputes/${encodeURIComponent(data.disputeId)}` },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.path;
  if (typeof path !== 'string' || !path.startsWith('/app/disputes/') || path.includes('//')) return;
  const destination = new URL(path, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(destination); return existing.focus(); }
    return self.clients.openWindow(destination);
  }));
});
