import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  Button,
  Card,
  ConceptCard,
  ConceptIcon,
  ConceptPageTitle,
  ConceptPill,
  ConceptSearchField,
  ConceptSegmented,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  StatusBadge,
  buttonStyle,
  colors,
  concept,
  disputePill,
  formatDisputeReason,
  formatDueShort,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import type { DisputeReason, DisputeStatus } from '@signoff/api-client';
import { useDisputes } from '../../app/queries';
import { getDemoSession } from '../demo/api';
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

  const [searchInput, setSearchInput] = useState(filters.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setSearchInput(filters.q); }, [filters.q]);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);
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
      scope?: 'all' | 'mine';
      view?: 'all' | 'attention' | 'waiting' | 'closed';
      search?: string;
    } = { limit: filters.limit, scope: filters.scope, view: filters.view };
    if (filters.q) q.search = filters.q;
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
  const demoSession = getDemoSession();
  const query = useDisputes(apiQuery, filters.scope === 'mine' ? demoSession : null);

  const [displayedItems, setDisplayedItems] = useState<DisputeListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (query.data) {
      const incoming = query.data.items;
      const append = filters.cursor !== null && !desktop;
      setDisplayedItems(current => append ? [...current.filter(item => !incoming.some(next => next.id === item.id)), ...incoming] : incoming);
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
    if ('q' in patch && searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
    const updated = { ...filters, ...patch };
    if ('status' in patch || 'reason' in patch || 'scope' in patch || 'q' in patch || 'view' in patch) {
      updated.cursor = null;
    }
    setSearchParams(filtersToSearchParams(updated));
  };

  const filteredItems = displayedItems;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      <ConceptPageTitle
        title="Disputes"
        badge={query.isSuccess ? <span aria-label={`${displayedItems.length} disputes`}><ConceptPill tone="gray">{displayedItems.length}</ConceptPill></span> : undefined}
      />

      <div data-testid="disputes-filter-card">
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <ConceptSearchField
            id="filter-search"
            data-testid="filter-search"
            aria-label="Search disputes"
            maxLength={200}
            placeholder="Search cases"
            value={searchInput}
            onChange={(event) => {
              const value = event.target.value;
              setSearchInput(value);
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => setSearchParams(current => {
                const next = parseDisputeFilters(current);
                return filtersToSearchParams({ ...next, q: value, cursor: null });
              }), 300);
            }}
          />

          <button ref={filterTrigger} type="button" onClick={() => { setDraft(filters); setFilterOpen(true); }} style={{ ...buttonStyle('secondary', false, false), minHeight: 52 }}><ConceptIcon name="filter" size={20} />Filter{(filters.status !== 'ALL' || filters.reason !== 'ALL' || filters.scope !== 'all') && <span aria-label="Filters active" style={{ width: 8, height: 8, borderRadius: 4, background: concept.primary }} />}</button>
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

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend>Scope</legend>
            <label style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 8 }}><input type="radio" name="scope" checked={draft.scope === 'all'} onChange={() => setDraft(current => ({ ...current, scope: 'all' }))} />All sessions</label>
            <label style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 8 }}><input type="radio" name="scope" checked={draft.scope === 'mine'} onChange={() => setDraft(current => ({ ...current, scope: 'mine' }))} />My demo session</label>
            {!demoSession && draft.scope === 'mine' && <p>No active demo session is available on this device.</p>}
          </fieldset>

          <label style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 8 }}><input type="checkbox" data-testid="filter-closed" checked={draft.view === 'closed'} onChange={event => setDraft(current => ({ ...current, view: event.target.checked ? 'closed' : 'all' }))} />Show closed cases only</label>

              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" testId="reset-filters-button" onClick={() => setDraft(current => ({ ...current, status: 'ALL', reason: 'ALL', scope: 'all' }))}>Clear filters</Button>
                <Button onClick={() => { updateFilter({ status: draft.status, reason: draft.reason, scope: draft.scope, view: draft.view }); setFilterOpen(false); }}>Apply filters</Button>
              </div>
            </div>
          </div>}
        </form>
      </div>

      {desktop && (filters.status !== 'ALL' || filters.reason !== 'ALL' || filters.scope !== 'all') && <div aria-label="Applied filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {filters.status !== 'ALL' && <button type="button" onClick={() => updateFilter({ status: 'ALL' })}>Status: {filters.status.replaceAll('_', ' ')} ×</button>}
        {filters.reason !== 'ALL' && <button type="button" onClick={() => updateFilter({ reason: 'ALL' })}>Reason: {formatDisputeReason(filters.reason)} ×</button>}
        {filters.scope === 'mine' && <button type="button" onClick={() => updateFilter({ scope: 'all' })}>My demo session ×</button>}
        <button type="button" onClick={() => updateFilter({ status: 'ALL', reason: 'ALL', scope: 'all', q: '' })}>Clear all</button>
      </div>}

      <ConceptSegmented
        ariaLabel="Dispute views"
        idPrefix="dispute-view"
        value={filters.view}
        onChange={value => { if (value === 'all' || value === 'attention' || value === 'waiting' || value === 'closed') updateFilter({ view: value, status: 'ALL' }); }}
        options={[{ value: 'all', label: 'All' }, { value: 'attention', label: 'Attention' }, { value: 'waiting', label: 'Waiting' }, ...(desktop || filters.view === 'closed' ? [{ value: 'closed', label: 'Closed' }] : [])]}
      />

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
          title={filters.scope === 'mine' && !demoSession ? 'No active demo session' : filters.q || filters.status !== "ALL" || filters.reason !== "ALL" ? 'No disputes match these filters' : filters.view !== 'all' ? 'No disputes in this view' : filters.scope === 'mine' ? 'No disputes in this session' : 'No disputes yet'}
          description={filters.scope === 'mine' && !demoSession ? 'Run a demo scenario to start a session, or choose all sessions.' : filters.q || filters.status !== "ALL" || filters.reason !== "ALL" || filters.view !== 'all' ? 'Change the view or filters to see more disputes.' : 'Disputes appear here when PayPal opens one.'}
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
          {desktop ? <Suspense fallback={<Skeleton height="180px" />}><DisputesGrid rows={filteredItems} returnTo={`/app/disputes${searchParams.toString() ? `?${searchParams.toString()}` : ""}`} /></Suspense> : <div data-testid="disputes-table" aria-label="Disputes" style={{ display: 'grid', gap: 14 }}>
            {filteredItems.map(item => {
              const pill = disputePill(item);
              const due = formatDueShort(item.seller_response_due_date);
              return <ConceptCard key={item.id} as={Link} testId={`dispute-row-${item.id}`}
                to={`/app/disputes/${item.id}`}
                state={{ from: `/app/disputes${searchParams.toString() ? `?${searchParams.toString()}` : ''}`, scrollY: window.scrollY }}
                aria-label={`${item.order_code ?? item.id}, ${formatDisputeReason(item.reason)}, ${pill.label}, ${due}`}
                style={{ display: 'grid', gap: 10, textDecoration: 'none', minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ flex: 1, minWidth: 0, fontSize: 18, overflowWrap: 'anywhere' }}>{item.order_code ?? item.id}</strong>
                  <strong style={{ whiteSpace: 'nowrap' }}><Money money={item.amount} /></strong>
                  <ConceptIcon name="chevron-right" color={concept.muted} />
                </span>
                <span>{formatDisputeReason(item.reason)}</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <ConceptPill tone={pill.tone}>{pill.label}</ConceptPill>
                  <span style={{ color: concept.muted, fontSize: 14 }}>{due}</span>
                </span>
              </ConceptCard>;
            })}
          </div>}

          {desktop ? <div
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
          </div> : nextCursor && <div data-testid="disputes-pagination" style={{ display: 'grid' }}>
            <button type="button" data-testid="pagination-next-button" onClick={() => updateFilter({ cursor: nextCursor })} style={buttonStyle('secondary', true, false)}>Load more</button>
          </div>}
        </>
      )}
    </div>
  );
};
