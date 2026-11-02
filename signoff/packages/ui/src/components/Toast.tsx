import React, { useEffect, useState } from 'react';

type Notice = { id: string; message: string; kind: 'success' | 'error' | 'pending' };
const eventName = 'signoff:toast';

/** Call only from a completed operation, never from polling/render effects. */
export function toast(message: string, kind: Notice['kind'] = 'success', id = message): void {
  window.dispatchEvent(new CustomEvent<Notice>(eventName, { detail: { id, message, kind } }));
}

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<Notice[]>([]);
  useEffect(() => {
    const recent = new Map<string, number>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      // This event is internal application state, not a server/buyer message channel.
      const value: unknown = event.detail;
      if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string'
          || !('message' in value) || typeof value.message !== 'string' || !('kind' in value)
          || (value.kind !== 'success' && value.kind !== 'error' && value.kind !== 'pending')) return;
      const item: Notice = { id: value.id, message: value.message, kind: value.kind };
      const now = Date.now();
      if (now - (recent.get(item.id) ?? 0) < 15_000) return;
      for (const [id, time] of recent) if (now - time >= 15_000) recent.delete(id);
      recent.set(item.id, now);
      setItems(previous => [...previous.filter(old => old.id !== item.id), item].slice(-3));
      if (item.kind === 'success') {
        const timer = setTimeout(() => {
          setItems(previous => previous.filter(old => old.id !== item.id));
          timers.delete(timer);
        }, 6000);
        timers.add(timer);
      }
    };
    window.addEventListener(eventName, receive);
    return () => {
      window.removeEventListener(eventName, receive);
      timers.forEach(clearTimeout);
    };
  }, []);
  return <>{children}<aside aria-label="Operation updates" style={{ position: 'fixed', bottom: 'max(16px, env(safe-area-inset-bottom))',
    right: 16, width: 'min(360px, calc(100vw - 32px))', zIndex: 2000, display: 'grid', gap: 8 }}>
    {items.map(item => <div key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}
      style={{ background: '#fff', color: '#16362b', border: '1px solid #98b4a4', borderRadius: 12,
        padding: 12, boxShadow: '0 4px 20px #0002', display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ flex: 1 }}>{item.message}</span><button aria-label="Dismiss update"
        style={{ minWidth: 44, minHeight: 44 }} onClick={() => setItems(previous => previous.filter(old => old.id !== item.id))}>×</button>
    </div>)}
  </aside></>;
};
