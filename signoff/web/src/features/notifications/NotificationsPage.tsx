import React, { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@signoff/api-client/generated';
import { Button, PageHeader } from '@signoff/ui';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';

type Page = components['schemas']['NotificationPage'];
type Item = components['schemas']['NotificationItem'];

function dayGroup(value: string): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? 'Yesterday' : 'Earlier';
}

export function useNotifications(offset = 0) {
  return useQuery({
    queryKey: ['notifications', offset],
    queryFn: () => unwrap(apiClient.request<Page>('/api/notifications', { params: { query: { offset, limit: 25 } } })),
    refetchInterval: 30_000, retry: false,
  });
}

export const NotificationsPage: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<'all' | 'unread'>('all');
  const query = useNotifications(offset);
  const client = useQueryClient();
  const change = useMutation({
    mutationFn: (item: Item) => unwrap(apiClient.request<Item>('/api/notifications/{notification_id}/read', {
      method: 'POST', params: { path: { notification_id: item.id } }, body: { read: !item.read_at },
    })),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return <div style={{ display: 'grid', gap: 20, maxWidth: 900, width: '100%' }}>
    <PageHeader title="Updates" description="Updates about your disputes and actions." />
    {query.isPending && <p role="status">Loading notifications…</p>}
    {query.isError && <div role="alert"><p>Couldn’t load notifications.</p>
      <Button onClick={() => { void query.refetch(); }}>Try again</Button></div>}
    {change.isError && <p role="alert">Couldn’t update this notification. Please try again.</p>}
    {query.data && <>
      <div aria-label="Update views" style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')} style={{ minHeight: 44, padding: '8px 16px' }}>All</button>
        <button type="button" aria-pressed={view === 'unread'} onClick={() => setView('unread')} style={{ minHeight: 44, padding: '8px 16px' }}>Unread · <span>{query.data.unread_count} unread</span></button>
      </div>
      {query.data.items.length === 0 && <p>No updates here yet.</p>}
      {view === 'unread' && query.data.items.length > 0 && query.data.items.every(item => item.read_at) && <p>No unread updates on this page.</p>}
      {(['Today', 'Yesterday', 'Earlier'] as const).map(group => {
        const items = query.data.items.filter(item => (view === 'all' || !item.read_at) && dayGroup(item.created_at) === group);
        if (items.length === 0) return null;
        return <section key={group} aria-label={group}><h2 style={{ fontSize: 16 }}>{group}</h2><ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {items.map(item => <li key={item.id} style={{ borderBottom: '1px solid #e7e7e2',
          padding: '16px 0', display: 'grid', gap: 10, overflowWrap: 'anywhere' }}>
          <div><strong>{item.message}</strong>{!item.read_at && <span> · Unread</span>}</div>
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to={`/app/disputes/${encodeURIComponent(item.dispute_id)}`}>View dispute</Link>
            <button type="button" style={{ minHeight: 44, background: 'transparent', border: 0, textDecoration: 'underline', color: 'inherit', cursor: 'pointer' }} disabled={change.isPending} onClick={() => change.mutate(item)}>
              {item.read_at ? 'Mark unread' : 'Mark read'}
            </button>
          </div>
        </li>)}
      </ul></section>;
      })}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button>
        <Button variant="secondary" disabled={query.data.next_offset == null}
          onClick={() => { if (query.data.next_offset != null) setOffset(query.data.next_offset); }}>Next</Button>
      </div>
    </>}
  </div>;
};
