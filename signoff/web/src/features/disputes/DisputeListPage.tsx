import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Skeleton,
  StatusBadge,
  colors,
  formatDisputeReason,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import type { ColumnDef } from '@signoff/ui';
import type { DisputeReason, DisputeStatus } from '@signoff/api-client';
import { useDisputes } from '../../app/queries';
import {
  DEFAULT_DISPUTE_FILTERS,
  filtersToSearchParams,
  isReasonFilter,
  isStatusFilter,
  parseDisputeFilters,
  VALID_REASONS,
  VALID_STATUSES,
} from './filterSchema';
import type { DisputeListItem } from './types';

export const DisputeStatusBadge: React.FC<{ status: string; testId?: string }> = ({
  status,
  testId,
}) => <StatusBadge status={status} testId={testId} />;

function formatDueInfo(dueAt: string | null | undefined): { relative: string; absolute: string } {
  if (!dueAt) return { relative: 'No deadline', absolute: '—' };
  const target = new Date(dueAt).getTime();
  const now = Date.now();
  const diffDays = Math.round((target - now) / 86400000);
  const absolute = new Date(dueAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      relative: overdue === 1 ? 'Overdue by 1 day' : `Overdue by ${overdue} days`,
      absolute,
    };
  }
  if (diffDays === 0) {
    return { relative: 'Due today', absolute };
  }
  return {
    relative: diffDays === 1 ? 'Due in 1 day' : `Due in ${diffDays} days`,
    absolute,
  };
}

export const DisputeListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse filters from URL, falling back to defaults on invalid input
  const filters = useMemo(() => parseDisputeFilters(searchParams), [searchParams]);

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const latestTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (query.data) {
      let maxTimestamp = 0;
      for (const item of query.data.items) {
        const ts = new Date(item.updated_at).getTime();
        if (ts > maxTimestamp) {
          maxTimestamp = ts;
        }
      }

      if (latestTimestampRef.current === 0 || maxTimestamp >= latestTimestampRef.current) {
        latestTimestampRef.current = maxTimestamp;
        setDisplayedItems(query.data.items);
        setNextCursor(query.data.next_cursor ?? null);
        setLastUpdated(new Date());
      }
    }
  }, [query.data]);

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

  const columns = useMemo<ColumnDef<DisputeListItem>[]>(
    () => [
      {
        id: 'id',
        header: 'Dispute',
        cell: (row) => (
          <Link
            to={`/app/disputes/${row.id}`}
            data-testid={`dispute-link-${row.id}`}
            style={{
              fontFamily: 'monospace',
              fontWeight: typography.fontWeightSemibold,
              color: colors.interactive,
              textDecoration: 'none',
            }}
          >
            {row.id}
          </Link>
        ),
      },
      {
        id: 'reason',
        header: 'Buyer reason',
        cell: (row) => (
          <span style={{ color: colors.ink }}>{formatDisputeReason(row.reason)}</span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        numeric: true,
        cell: (row) => <Money money={row.amount} testId={`dispute-amount-${row.id}`} />,
      },
      {
        id: 'verdict',
        header: 'Verdict',
        cell: (row) => (
          <StatusBadge
            status={row.latest_verdict ?? row.status}
            testId={`dispute-verdict-${row.id}`}
          />
        ),
      },
      {
        id: 'due',
        header: 'Due',
        cell: (row) => {
          const { relative, absolute } = formatDueInfo(row.seller_response_due_date);
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: colors.ink, fontWeight: typography.fontWeightMedium }}>
                {relative}
              </span>
              <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
                {absolute}
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      <PageHeader
        title="All disputes"
        description="Every dispute PayPal has opened for this store."
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

          {/* Status select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
              value={filters.status}
              onChange={(e) => {
                const value = e.target.value;
                if (isStatusFilter(value)) {
                  updateFilter({ status: value });
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
              value={filters.reason}
              onChange={(e) => {
                const value = e.target.value;
                if (isReasonFilter(value)) {
                  updateFilter({ reason: value });
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

          {/* Scope Toggle (preserved for test compatibility) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span
              style={{
                fontSize: typography.fontSizeSmall,
                fontWeight: typography.fontWeightSemibold,
                color: colors.inkMuted,
              }}
            >
              Scope
            </span>
            <div
              role="radiogroup"
              aria-label="Dispute session scope"
              style={{
                display: 'flex',
                borderRadius: radius.control,
                border: `1px solid ${colors.borderStrong}`,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                data-testid="scope-mine-button"
                aria-checked={filters.scope === 'mine'}
                role="radio"
                onClick={() => updateFilter({ scope: 'mine' })}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  backgroundColor: filters.scope === 'mine' ? colors.primaryAction : colors.surface,
                  color: filters.scope === 'mine' ? '#FFFFFF' : colors.ink,
                  cursor: 'pointer',
                  fontSize: typography.fontSizeBody,
                  fontWeight: typography.fontWeightMedium,
                }}
              >
                My session
              </button>
              <button
                type="button"
                data-testid="scope-all-button"
                aria-checked={filters.scope === 'all'}
                role="radio"
                onClick={() => updateFilter({ scope: 'all' })}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderLeft: `1px solid ${colors.borderStrong}`,
                  backgroundColor: filters.scope === 'all' ? colors.primaryAction : colors.surface,
                  color: filters.scope === 'all' ? '#FFFFFF' : colors.ink,
                  cursor: 'pointer',
                  fontSize: typography.fontSizeBody,
                  fontWeight: typography.fontWeightMedium,
                }}
              >
                All sessions
              </button>
            </div>
          </div>

          {/* Reset Filters */}
          {(filters.status !== DEFAULT_DISPUTE_FILTERS.status ||
            filters.reason !== DEFAULT_DISPUTE_FILTERS.reason ||
            filters.scope !== DEFAULT_DISPUTE_FILTERS.scope ||
            filters.q !== '' ||
            filters.cursor !== null) && (
            <Button
              variant="secondary"
              testId="reset-filters-button"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Reset filters
            </Button>
          )}
        </form>
      </Card>

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
          title="No disputes yet"
          description="Disputes appear here when PayPal opens one."
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
          <DataTable
            columns={columns}
            data={filteredItems}
            keyExtractor={(item) => item.id}
            rowTestId={(item) => `dispute-row-${item.id}`}
            tableTestId="disputes-table"
            caption="All store disputes"
            onRowClick={(item) => navigate(`/app/disputes/${item.id}`)}
          />

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
