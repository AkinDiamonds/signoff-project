import React, { useEffect, useState } from 'react';
import { Button, toast } from '@signoff/ui';
import type { components } from '@signoff/api-client/generated';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';

type Config = components['schemas']['PushConfig'];
type SubscriptionResult = components['schemas']['SubscriptionResult'];

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)),
    character => character.charCodeAt(0));
}

function encodedKey(subscription: PushSubscription, name: PushEncryptionKeyName): string {
  const key = subscription.getKey(name);
  if (!key) throw new Error('Your browser did not provide notification keys.');
  return btoa(String.fromCharCode(...new Uint8Array(key))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export const PhoneNotifications: React.FC = () => {
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [config, setConfig] = useState<Config | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [testDispute, setTestDispute] = useState('');
  useEffect(() => {
    let disposed = false;
    void unwrap(apiClient.request<Config>('/api/push/config')).then(async value => {
      if (!disposed) setConfig(value);
      if (supported) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (registration) await registration.update();
        const subscription = await registration?.pushManager.getSubscription();
        if (!disposed) setEnabled(Boolean(subscription));
      }
    }).catch(() => { if (!disposed) setMessage('Could not check phone notification setup. Refresh to try again.'); });
    return () => { disposed = true; };
  }, [supported]);

  const enable = async () => {
    if (!supported || !config?.public_key || busy) return;
    setBusy(true); setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(permission === 'denied' ? 'Notifications are blocked. Change your browser’s site settings to enable them.' : 'Permission was not granted. Your inbox is still available.');
        return;
      }
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const previousKey = subscription?.options?.applicationServerKey;
      const nextKey = applicationKey(config.public_key);
      if (subscription && previousKey && (new Uint8Array(previousKey).length !== nextKey.length
          || new Uint8Array(previousKey).some((value, index) => value !== nextKey[index]))) {
        if (!await subscription.unsubscribe()) throw new Error('Could not replace notification key');
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true,
        applicationServerKey: nextKey });
      try {
        await unwrap(apiClient.request<SubscriptionResult>('/api/push/subscriptions', { method: 'POST', body: {
          endpoint: subscription.endpoint, p256dh: encodedKey(subscription, 'p256dh'), auth: encodedKey(subscription, 'auth'),
        } }));
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setEnabled(true); setMessage('Phone notifications enabled for new updates on this device. Delivery has not yet been verified.');
      toast('Phone notifications enabled for this device.');
    } catch {
      setMessage('Could not enable phone notifications. Your inbox still works. Please try again.');
      toast('Could not enable phone notifications.', 'error');
    } finally { setBusy(false); }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const result = await apiClient.request('/api/push/subscriptions/remove', {
          method: 'POST', body: { endpoint: subscription.endpoint },
        });
        if (!result.success) throw new Error('Server unsubscribe failed');
      }
      if (subscription && !await subscription.unsubscribe()) throw new Error('Unsubscribe failed');
      setEnabled(false);
      setMessage('Phone notifications disabled on this device. Your inbox remains available.');
      toast('Phone notifications disabled on this device.');
    } catch { setMessage('Could not finish disabling notifications. Please try again.'); }
    finally { setBusy(false); }
  };
  const sendTest = async () => {
    if (busy || !testDispute.trim()) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error('This device is not subscribed');
      await unwrap(apiClient.request('/api/push/test', { method: 'POST', body: {
        endpoint: subscription.endpoint, dispute_id: testDispute.trim(), request_id: crypto.randomUUID(),
      } }));
      setMessage('Phone test queued. Put this app in the background and check your phone. Delivery is not yet proven.');
      toast('Phone test queued; waiting for delivery.', 'pending');
    } catch {
      setMessage('Could not queue the phone test. Check the dispute ID, device opt-in and connection; wait a minute before retrying.');
    } finally { setBusy(false); }
  };
  return <section aria-label="Phone notifications" style={{ background: '#fff', border: '1px solid #dce5df', borderRadius: 12, padding: 20 }}>
    <h2 style={{ marginTop: 0 }}>Phone notifications</h2>
    <p>Receive a generic review reminder when this site is in the background. Opening it never approves an action.</p>
    <p>On Android, use Chrome over HTTPS. On iPhone or iPad, use iOS/iPadOS 16.4 or later, add this site to your Home Screen, then enable notifications from that app.</p>
    <p>Installation is optional on Android. If alerts don’t appear, check Android’s Chrome notification settings and the notification tray.</p>
    {supported && <p>Browser notification permission: {{ granted: 'Allowed', denied: 'Blocked', default: 'Not chosen' }[Notification.permission]}.</p>}
    {!supported && <p>This browser does not support phone notifications. Use the notification inbox.</p>}
    {supported && config && !config.available && <p>Phone notifications need server setup. Your inbox is available.</p>}
    {config && <p>{config.pending_deliveries} pending deliveries · {config.failed_deliveries} failed deliveries.
      {' '}Push delivery is separate from dispute execution.</p>}
    {enabled ? <Button disabled={busy} onClick={() => { void disable(); }}>Disable phone notifications</Button>
      : <Button disabled={!supported || !config?.available || busy} onClick={() => { void enable(); }}>Enable phone notifications</Button>}
    {enabled && <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
      <label>Dispute ID for phone delivery check<input value={testDispute} onChange={event => setTestDispute(event.target.value)}
        style={{ display: 'block', boxSizing: 'border-box', maxWidth: '100%', minHeight: 44 }} /></label>
      <p>This creates a test notification linked to an existing dispute. It never approves or submits a dispute action.</p>
      <Button disabled={busy || !testDispute.trim()} onClick={() => { void sendTest(); }}>Send phone test</Button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
};
