import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@signoff/api-client/generated';
import { Button, ConceptIcon, ConceptPageTitle, ConceptPill, ConceptSegmented, concept, formatRelativeDay, type ConceptIconName } from '@signoff/ui';
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

export function useNotifications(offset = 0, unreadOnly = false, enabled = true) {
  return useQuery({
    queryKey: ['notifications', offset, unreadOnly],
    queryFn: () => unwrap(apiClient.request<Page>('/api/notifications', { params: { query: { offset, limit: 25, unread_only: unreadOnly } } })),
    refetchInterval: 30_000, retry: false, enabled,
  });
}

const KIND_TILES: Record<string, { icon: ConceptIconName; bg: string }> = {
  new_dispute: { icon: 'bell', bg: '#F1F1EE' },
  approval_requested: { icon: 'clock', bg: '#FEE8B5' },
  action_confirmed: { icon: 'check', bg: '#DCF6E6' },
  action_failed: { icon: 'alert-triangle', bg: '#FBE3E1' },
  review_needed: { icon: 'message', bg: '#E3F1FD' },
};

export const NotificationsPage: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<'all' | 'unread'>('all');
  const [loaded, setLoaded] = useState<Item[]>([]);
  const query = useNotifications(offset, view === 'unread');
  const client = useQueryClient();
  const change = useMutation({
    mutationFn: (item: Item) => unwrap(apiClient.request<Item>('/api/notifications/{notification_id}/read', {
      method: 'POST', params: { path: { notification_id: item.id } }, body: { read: !item.read_at },
    })),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  // Later pages are appended; refetches of an already loaded page replace its rows.
  const pageItems = query.data?.items;
  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...loaded.filter(item => !pageItems?.some(next => next.id === item.id)), ...(pageItems ?? [])].filter(item => !seen.has(item.id) && seen.add(item.id));
  }, [loaded, pageItems]);
  const switchView = (next: 'all' | 'unread') => { setOffset(0); setLoaded([]); setView(next); };
  const loadMore = (nextOffset: number) => { setLoaded(items); setOffset(nextOffset); };
  return <div style={{ display: 'grid', gap: 20, maxWidth: 900, width: '100%' }}>
    <ConceptPageTitle title="Updates" badge={query.data ? <ConceptPill tone="gray">{query.data.unread_count} unread</ConceptPill> : undefined} />
    {query.isPending && <p role="status">Loading notifications…</p>}
    {query.isError && <div role="alert"><p>Couldn’t load notifications.</p>
      <Button onClick={() => { void query.refetch(); }}>Try again</Button></div>}
    {change.isError && <p role="alert">Couldn’t update this notification. Please try again.</p>}
    {query.data && <>
      <ConceptSegmented ariaLabel="Update views" idPrefix="update-view" value={view} onChange={value => switchView(value === 'unread' ? 'unread' : 'all')} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
      {items.length === 0 && <p>{view === 'unread' ? 'No unread updates here.' : 'No updates here yet.'}</p>}
      {(['Today', 'Yesterday', 'Earlier'] as const).map(group => {
        const groupItems = items.filter(item => dayGroup(item.created_at) === group);
        if (groupItems.length === 0) return null;
        return <section key={group} aria-label={group}>
          <h2 style={{ margin: '0 0 4px', padding: '10px 14px', borderRadius: 10, background: concept.subtle, fontSize: 14, fontWeight: 700, color: concept.muted }}>{group}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {groupItems.map(item => {
              const tile = KIND_TILES[item.kind] ?? { icon: 'bell' as const, bg: '#F1F1EE' };
              const unread = !item.read_at;
              return <li key={item.id} data-testid={`notification-${item.id}`} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${concept.border}`, overflowWrap: 'anywhere' }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: tile.bg, display: 'grid', placeItems: 'center', color: '#1B1B19' }}><ConceptIcon name={tile.icon} size={20} /></span>
                <Link to={`/app/disputes/${encodeURIComponent(item.dispute_id)}`} aria-label={`View dispute ${item.dispute_id}: ${item.message}${unread ? ' (unread)' : ''}`} style={{ display: 'grid', gap: 2, color: concept.ink, textDecoration: 'none', minWidth: 0 }}>
                  <strong style={{ fontSize: 17, fontWeight: unread ? 700 : 600 }}>{item.message}</strong>
                  <span style={{ fontSize: 14, color: concept.muted }}>{item.dispute_id}</span>
                </Link>
                <span style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                  <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()} style={{ fontSize: 13, color: concept.muted, whiteSpace: 'nowrap' }}>{formatRelativeDay(item.created_at)}</time>
                  {unread && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: concept.primary }} />}
                  <button type="button" aria-label={item.read_at ? 'Mark unread' : 'Mark read'} title={item.read_at ? 'Mark unread' : 'Mark read'} disabled={change.isPending} onClick={() => change.mutate(item)} style={{ minHeight: 44, minWidth: 44, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, color: concept.muted, cursor: 'pointer' }}>
                    <ConceptIcon name="more" size={18} />
                  </button>
                </span>
              </li>;
            })}
          </ul>
        </section>;
      })}
      {query.data.next_offset != null && <Button variant="secondary" style={{ width: '100%', minHeight: 48 }} onClick={() => { if (query.data.next_offset != null) loadMore(query.data.next_offset); }}>Load more</Button>}
    </>}
  </div>;
};
