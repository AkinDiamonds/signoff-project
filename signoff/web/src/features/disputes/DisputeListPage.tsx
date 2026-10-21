import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  Card,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  VerdictChip,
} from '@signoff/ui';
import type { DisputeReason, DisputeStatus } from '@signoff/api-client';
import type { ApiQueryError } from '../../app/queries';
import { useDisputes } from '../../app/queries';
import {
  DEFAULT_DISPUTE_FILTERS,
  filtersToSearchParams,
  parseDisputeFilters,
  VALID_REASONS,
  VALID_STATUSES,
} from './filterSchema';
import type { DisputeListItem } from './types';

export const DisputeStatusBadge: React.FC<{ status: string; testId?: string }> = ({ status, testId }) => (
  <span
    data-testid={testId}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 8px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: '#f1f5f9',
      color: '#334155',
      border: '1px solid #cbd5e1',
    }}
  >
    {status.replace(/_/g, ' ')}
  </span>
);

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
      q.status = filters.status as DisputeStatus;
    }
    if (filters.reason !== 'ALL') {
      q.reason = filters.reason as DisputeReason;
    }
    if (filters.cursor) {
      q.cursor = filters.cursor;
    }
    return q;
  }, [filters]);

  // Query with auto refetch every 10s
  const query = useDisputes(apiQuery);

  // Stale tracking and ignoring responses older than the one currently shown
  const [displayedItems, setDisplayedItems] = useState<DisputeListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const latestTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (query.data) {
      // Find the maximum updated_at in the incoming items
      let maxTimestamp = 0;
      for (const item of query.data.items) {
        const ts = new Date(item.updated_at).getTime();
        if (ts > maxTimestamp) {
          maxTimestamp = ts;
        }
      }

      // Ignore if response is older than the one shown
      if (latestTimestampRef.current === 0 || maxTimestamp >= latestTimestampRef.current) {
        latestTimestampRef.current = maxTimestamp;
        setDisplayedItems(query.data.items);
        setNextCursor(query.data.next_cursor ?? null);
        setLastUpdated(new Date());
      }
    }
  }, [query.data]);

  // Update URL search params cleanly
  const updateFilter = (patch: Partial<typeof filters>) => {
    const updated = { ...filters, ...patch };
    // Reset cursor when changing status, reason, or scope
    if ('status' in patch || 'reason' in patch || 'scope' in patch) {
      updated.cursor = null;
    }
    setSearchParams(filtersToSearchParams(updated));
  };

  const handleNextPage = () => {
    if (nextCursor) {
      updateFilter({ cursor: nextCursor });
    }
  };

  const handlePrevPage = () => {
    // Reset cursor to start
    updateFilter({ cursor: null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: '0 0 4px 0', color: '#0f172a' }}>Disputes</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Review merchant disputes, gate decisions, and audit timelines.
          </p>
        </div>
        {lastUpdated && (
          <div
            data-testid="disputes-stale-indicator"
            style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: query.isFetching ? '#f59e0b' : '#10b981',
              }}
            />
            {query.isFetching ? 'Refreshing...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </div>
        )}
      </header>

      {/* Filters Bar */}
      <Card testId="disputes-filter-card">
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'flex-end',
          }}
        >
          {/* Status Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="filter-status" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Status
            </label>
            <select
              id="filter-status"
              data-testid="filter-status"
              value={filters.status}
              onChange={(e) => updateFilter({ status: e.target.value })}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            >
              {VALID_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === 'ALL' ? 'All statuses' : st.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="filter-reason" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Reason
            </label>
            <select
              id="filter-reason"
              data-testid="filter-reason"
              value={filters.reason}
              onChange={(e) => updateFilter({ reason: e.target.value })}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            >
              {VALID_REASONS.map((rs) => (
                <option key={rs} value={rs}>
                  {rs === 'ALL' ? 'All reasons' : rs.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Toggle (mine vs all) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Scope</span>
            <div
              role="radiogroup"
              aria-label="Dispute session scope"
              style={{ display: 'flex', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}
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
                  backgroundColor: filters.scope === 'mine' ? '#0f766e' : '#ffffff',
                  color: filters.scope === 'mine' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
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
                  borderLeft: '1px solid #cbd5e1',
                  backgroundColor: filters.scope === 'all' ? '#0f766e' : '#ffffff',
                  color: filters.scope === 'all' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
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
          <div role="status" aria-label="Loading disputes" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          correlationId={(query.error as ApiQueryError).correlationId}
          onRetry={() => void query.refetch()}
        />
      )}

      {query.isSuccess && displayedItems.length === 0 && (
        <EmptyState
          testId="disputes-empty-state"
          title="No disputes found"
          description="There are no disputes matching your current filter settings. You can trigger demo scenarios from the demo page."
          action={
            <Link
              to="/app/demo"
              data-testid="empty-state-demo-link"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#0f766e',
                color: '#ffffff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Go to Demo scenarios
            </Link>
          }
        />
      )}

      {query.isSuccess && displayedItems.length > 0 && (
        <Card testId="disputes-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table
              data-testid="disputes-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 8px' }}>Dispute ID</th>
                  <th style={{ padding: '12px 8px' }}>Order</th>
                  <th style={{ padding: '12px 8px' }}>Reason</th>
                  <th style={{ padding: '12px 8px' }}>Amount</th>
                  <th style={{ padding: '12px 8px' }}>Status</th>
                  <th style={{ padding: '12px 8px' }}>Latest Verdict</th>
                  <th style={{ padding: '12px 8px' }}>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr
                    key={item.id}
                    data-testid={`dispute-row-${item.id}`}
                    onClick={() => navigate(`/app/disputes/${item.id}`)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 8px' }}>
                      <Link
                        to={`/app/disputes/${item.id}`}
                        data-testid={`dispute-link-${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {item.id}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#475569' }}>
                      {item.order_code ?? '—'}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#334155' }}>
                      {item.reason.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <Money money={item.amount} testId={`dispute-amount-${item.id}`} />
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <DisputeStatusBadge status={item.status} testId={`dispute-status-${item.id}`} />
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {item.latest_verdict ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <VerdictChip
                            verdict={item.latest_verdict}
                            testId={`dispute-verdict-${item.id}`}
                          />
                          {item.latest_rule_id && (
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                              {item.latest_rule_id}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <Deadline dueAt={item.seller_response_due_date ?? null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div
            data-testid="disputes-pagination"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <Button
              variant="secondary"
              disabled={filters.cursor === null}
              onClick={handlePrevPage}
              testId="pagination-prev-button"
            >
              First page
            </Button>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {displayedItems.length} items
            </span>
            <Button
              variant="secondary"
              disabled={!nextCursor}
              onClick={handleNextPage}
              testId="pagination-next-button"
            >
              Next page
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
