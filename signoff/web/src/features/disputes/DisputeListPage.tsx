import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Skeleton,
  StatusBadge,
  colors,
  formatDisputeReason,
  describeDeadline,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import type { DisputeReason, DisputeStatus } from '@signoff/api-client';
import { useDisputes } from '../../app/queries';
import {
  filtersToSearchParams,
  isReasonFilter,
  isStatusFilter,
  parseDisputeFilters,
  VALID_REASONS,
  VALID_STATUSES,
} from './filterSchema';
import type { DisputeListItem } from './types';
const DisputesGrid = lazy(() => import('./DisputesGrid').then(module => ({ default: module.DisputesGrid })));

export const DisputeStatusBadge: React.FC<{ status: string; testId?: string }> = ({
  status,
  testId,
}) => <StatusBadge status={status} testId={testId} />;

function formatDueInfo(dueAt: string | null | undefined): { relative: string; absolute: string } {
  if (!dueAt) return { relative: 'No deadline', absolute: '—' };
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return { relative: 'Unknown deadline', absolute: '—' };
  return {
    relative: describeDeadline(dueAt, new Date()),
    absolute: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

export const DisputeListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [desktop, setDesktop] = useState(() => window.matchMedia?.('(min-width: 900px)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 900px)');
    const update = () => setDesktop(media?.matches ?? false);
    media?.addEventListener?.('change', update);
    return () => media?.removeEventListener?.('change', update);
  }, []);
  const location = useLocation();

  // Parse filters from URL, falling back to defaults on invalid input
  const filters = useMemo(() => parseDisputeFilters(searchParams), [searchParams]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const filterDialog = useRef<HTMLDivElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    filterDialog.current?.querySelector<HTMLElement>('button, select')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setFilterOpen(false); }
      if (event.key !== 'Tab') return;
      const controls = filterDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); filterTrigger.current?.focus(); };
  }, [filterOpen]);

  // Construct query object for API client
  const apiQuery = useMemo(() => {
    const q: {
      status?: DisputeStatus;
      reason?: DisputeReason;
      limit?: number;
      cursor?: string;
    } = { limit: filters.limit };
    if (filters.status !== 'ALL') {
      q.status = filters.status;
    }
    if (filters.reason !== 'ALL') {
      q.reason = filters.reason;
    }
    if (filters.cursor) {
      q.cursor = filters.cursor;
    }
    return q;
  }, [filters]);

  // Query with auto refetch every 10s
  const query = useDisputes(apiQuery);

  const [displayedItems, setDisplayedItems] = useState<DisputeListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (query.data) {
      setDisplayedItems(query.data.items);
      setNextCursor(query.data.next_cursor ?? null);
      setLastUpdated(new Date());
    }
  }, [query.data]);

  useEffect(() => {
    const state: unknown = location.state;
    if (query.isSuccess && state && typeof state === "object" && "restoreScrollY" in state && typeof state.restoreScrollY === "number") {
      window.scrollTo(0, state.restoreScrollY);
    }
  }, [location.state, query.isSuccess, displayedItems]);

  const updateFilter = (patch: Partial<typeof filters>) => {
    const updated = { ...filters, ...patch };
    if ('status' in patch || 'reason' in patch || 'scope' in patch || 'q' in patch) {
      updated.cursor = null;
    }
    setSearchParams(filtersToSearchParams(updated));
  };

  // Filter items client-side by search query if set
  const filteredItems = useMemo(() => {
    if (!filters.q) return displayedItems;
    const queryTerm = filters.q.toLowerCase();
    return displayedItems.filter((item) => {
      const matchId = item.id.toLowerCase().includes(queryTerm);
      const matchOrder = item.order_code && item.order_code.toLowerCase().includes(queryTerm);
      return Boolean(matchId || matchOrder);
    });
  }, [displayedItems, filters.q]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      <PageHeader
        title="Disputes"
        description="Review your cases and their current status."
      />

      {/* Filter Row above the table */}
      <Card testId="disputes-filter-card">
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing[2],
            alignItems: 'flex-end',
          }}
        >
          {/* Search box: matches dispute id or order code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
            <label
              htmlFor="filter-search"
              style={{
                fontSize: typography.fontSizeSmall,
                fontWeight: typography.fontWeightSemibold,
                color: colors.inkMuted,
              }}
            >
              Search
            </label>
            <input
              id="filter-search"
              data-testid="filter-search"
              type="text"
              placeholder="Filter by dispute ID or order code"
              value={filters.q}
              onChange={(e) => updateFilter({ q: e.target.value })}
              style={{
                padding: '6px 10px',
                borderRadius: radius.control,
                border: `1px solid ${colors.borderStrong}`,
                fontSize: typography.fontSizeBody,
                color: colors.ink,
                outline: 'none',
              }}
            />
          </div>

          <button ref={filterTrigger} type="button" onClick={() => { setDraft(filters); setFilterOpen(true); }} style={{ minHeight: 44, padding: '8px 16px', border: `1px solid ${colors.borderStrong}`, background: colors.surface, color: colors.ink, borderRadius: 6 }}>Filter</button>
          {filterOpen && <div role="dialog" aria-modal="true" aria-labelledby="filter-title" ref={filterDialog} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: colors.surface, color: colors.ink, width: 'min(100%, 560px)', maxHeight: '85dvh', overflowY: 'auto', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))', borderRadius: '12px 12px 0 0', display: 'grid', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 id="filter-title" style={{ margin: 0 }}>Filters</h2><button type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters">Close</button></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2], minWidth: 0 }}>
          {/* Status select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            <label
              htmlFor="filter-status"
              style={{
                fontSize: typography.fontSizeSmall,
                fontWeight: typography.fontWeightSemibold,
                color: colors.inkMuted,
              }}
            >
              Status
            </label>
            <select
              id="filter-status"
              data-testid="filter-status"
              value={draft.status}
              onChange={(e) => {
                const value = e.target.value;
                if (isStatusFilter(value)) {
                  setDraft(current => ({ ...current, status: value }));
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: radius.control,
                border: `1px solid ${colors.borderStrong}`,
                fontSize: typography.fontSizeBody,
                backgroundColor: colors.surface,
                color: colors.ink,
              }}
            >
              {VALID_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === 'ALL' ? 'All statuses' : st.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Reason select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            <label
              htmlFor="filter-reason"
              style={{
                fontSize: typography.fontSizeSmall,
                fontWeight: typography.fontWeightSemibold,
                color: colors.inkMuted,
              }}
            >
              Reason
            </label>
            <select
              id="filter-reason"
              data-testid="filter-reason"
              value={draft.reason}
              onChange={(e) => {
                const value = e.target.value;
                if (isReasonFilter(value)) {
                  setDraft(current => ({ ...current, reason: value }));
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: radius.control,
                border: `1px solid ${colors.borderStrong}`,
                fontSize: typography.fontSizeBody,
                backgroundColor: colors.surface,
                color: colors.ink,
              }}
            >
              {VALID_REASONS.map((rs) => (
                <option key={rs} value={rs}>
                  {rs === 'ALL' ? 'All reasons' : formatDisputeReason(rs)}
                </option>
              ))}
            </select>
          </div>

          <p style={{ margin: 0, color: colors.inkMuted, fontSize: 14 }}>Showing all sessions. Session filtering is unavailable.</p>

              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" testId="reset-filters-button" onClick={() => setDraft(current => ({ ...current, status: 'ALL', reason: 'ALL', scope: 'all' }))}>Clear filters</Button>
                <Button onClick={() => { updateFilter({ status: draft.status, reason: draft.reason }); setFilterOpen(false); }}>Apply filters</Button>
              </div>
            </div>
          </div>}
        </form>
      </Card>

      {(filters.status !== 'ALL' || filters.reason !== 'ALL') && <div aria-label="Applied filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {filters.status !== 'ALL' && <button type="button" onClick={() => updateFilter({ status: 'ALL' })}>Status: {filters.status.replaceAll('_', ' ')} ×</button>}
        {filters.reason !== 'ALL' && <button type="button" onClick={() => updateFilter({ reason: 'ALL' })}>Reason: {formatDisputeReason(filters.reason)} ×</button>}
        <button type="button" onClick={() => updateFilter({ status: 'ALL', reason: 'ALL', q: '' })}>Clear all</button>
      </div>}

      {/* Main Content Area */}
      {query.isPending && (
        <Card testId="disputes-loading-card">
          <div
            role="status"
            aria-label="Loading disputes"
            style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}
          >
            <Skeleton height="32px" />
            <Skeleton height="48px" />
            <Skeleton height="48px" />
          </div>
        </Card>
      )}

      {query.isError && (
        <ErrorState
          testId="disputes-error"
          message={query.error.message}
          correlationId={query.error.correlationId}
          onRetry={() => void query.refetch()}
        />
      )}

      {query.isSuccess && filteredItems.length === 0 && (
        <EmptyState
          testId="disputes-empty-state"
          title={filters.q || filters.status !== "ALL" || filters.reason !== "ALL" ? "No disputes match these filters" : "No disputes yet"}
          description={filters.q || filters.status !== "ALL" || filters.reason !== "ALL" ? "Change or reset the filters to see more disputes." : "Disputes appear here when PayPal opens one."}
          action={
            <div style={{ display: 'flex', gap: spacing[2], alignItems: 'center' }}>
              <Link
                to="/guide"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: colors.primaryAction,
                  color: '#FFFFFF',
                  borderRadius: radius.control,
                  textDecoration: 'none',
                  fontWeight: typography.fontWeightSemibold,
                  fontSize: typography.fontSizeBody,
                }}
              >
                See how it works
              </Link>
              {/* Preserved demo link for test compatibility */}
              <Link
                to="/app/demo"
                data-testid="empty-state-demo-link"
                style={{
                  fontSize: typography.fontSizeSmall,
                  color: colors.interactive,
                  textDecoration: 'none',
                }}
              >
                Open demo panel
              </Link>
            </div>
          }
        />
      )}

      {query.isSuccess && filteredItems.length > 0 && (
        <>
          {desktop ? <Suspense fallback={<Skeleton height="180px" />}><DisputesGrid rows={filteredItems} returnTo={`/app/disputes${searchParams.toString() ? `?${searchParams.toString()}` : ""}`} /></Suspense> : <div data-testid="disputes-table" aria-label="Disputes" style={{ borderTop: `1px solid ${colors.border}` }}>
            {filteredItems.map(item => <Link key={item.id} data-testid={`dispute-row-${item.id}`}
              to={`/app/disputes/${item.id}`}
              state={{ from: `/app/disputes${searchParams.toString() ? `?${searchParams.toString()}` : ''}`, scrollY: window.scrollY }}
              style={{ display: 'grid', gap: 8, padding: '18px 0', borderBottom: `1px solid ${colors.border}`, color: colors.ink, textDecoration: 'none', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{item.order_code ? `Order ${item.order_code}` : item.id}</strong><strong><Money money={item.amount} /></strong></div>
              <span>{formatDisputeReason(item.reason)}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><span>PayPal: <StatusBadge status={item.status} /></span><span>Review: <StatusBadge status={item.latest_verdict ?? 'UNKNOWN'} /></span></div>
              <span style={{ color: colors.inkMuted, fontSize: 14 }}>{formatDueInfo(item.seller_response_due_date).relative}</span>
            </Link>)}
          </div>}

          <div
            data-testid="disputes-pagination"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${spacing[2]} 0`,
            }}
          >
            <Button
              variant="secondary"
              disabled={filters.cursor === null}
              onClick={() => updateFilter({ cursor: null })}
              testId="pagination-prev-button"
            >
              First page
            </Button>
            <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
              Showing {displayedItems.length} items
            </span>
            <Button
              variant="secondary"
              disabled={!nextCursor}
              onClick={() => {
                if (nextCursor) {
                  updateFilter({ cursor: nextCursor });
                }
              }}
              testId="pagination-next-button"
            >
              Next page
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
