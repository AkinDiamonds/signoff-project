import React, { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@signoff/api-client/generated';
import { Button, PageHeader } from '@signoff/ui';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';

type Page = components['schemas']['NotificationPage'];
type Item = components['schemas']['NotificationItem'];

export function useNotifications(offset = 0) {
  return useQuery({
    queryKey: ['notifications', offset],
    queryFn: () => unwrap(apiClient.request<Page>('/api/notifications', { params: { query: { offset, limit: 25 } } })),
    refetchInterval: 30_000, retry: false,
  });
}

export const NotificationsPage: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const query = useNotifications(offset);
  const client = useQueryClient();
  const change = useMutation({
    mutationFn: (item: Item) => unwrap(apiClient.request<Item>('/api/notifications/{notification_id}/read', {
      method: 'POST', params: { path: { notification_id: item.id } }, body: { read: !item.read_at },
    })),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return <div style={{ display: 'grid', gap: 20, maxWidth: 900, width: '100%' }}>
    <PageHeader title="Notifications" description="Updates about your disputes and actions." />
    {query.isPending && <p role="status">Loading notifications…</p>}
    {query.isError && <div role="alert"><p>Couldn’t load notifications.</p>
      <Button onClick={() => { void query.refetch(); }}>Try again</Button></div>}
    {change.isError && <p role="alert">Couldn’t update this notification. Please try again.</p>}
    {query.data && <>
      <p aria-live="polite">{query.data.unread_count} unread</p>
      {query.data.items.length === 0 && <p>No notifications here yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {query.data.items.map(item => <li key={item.id} style={{ background: '#fff', border: '1px solid #dce5df',
          borderRadius: 12, padding: 16, display: 'grid', gap: 10, overflowWrap: 'anywhere' }}>
          <div><strong>{item.message}</strong>{!item.read_at && <span> · Unread</span>}</div>
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to={`/app/disputes/${encodeURIComponent(item.dispute_id)}`}>View dispute</Link>
            <Button variant="secondary" disabled={change.isPending} onClick={() => change.mutate(item)}>
              {item.read_at ? 'Mark unread' : 'Mark read'}
            </Button>
          </div>
        </li>)}
      </ul>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button>
        <Button variant="secondary" disabled={query.data.next_offset == null}
          onClick={() => { if (query.data.next_offset != null) setOffset(query.data.next_offset); }}>Next</Button>
      </div>
    </>}
  </div>;
};
