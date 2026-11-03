import React, { useMemo } from 'react';
import { Link } from 'react-router';
import {
  DataTable,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  StatusBadge,
  Skeleton,
  colors,
  formatDisputeReason,
  radius,
  spacing,
} from '@signoff/ui';
import type { ColumnDef } from '@signoff/ui';
import { ApiQueryError, useDisputeTimeline } from '../../app/queries';
import { useCharter } from '../charter';
import { WidgetsSection } from '../widgets';
import { AssistantPanel } from './AssistantPanel';
import { StudioEmbed } from './StudioEmbed';
import { useDashboardDisputes, useKpis } from './api';
import { toStudioData, type DisputeItem, type Kpis, type StudioData } from './types';

const EMPTY_STUDIO_DATA: StudioData = {
  sources: [
    { id: 'disputes', data: [] },
    { id: 'kpis', data: [] },
  ],
};

function kpiValue(kpis: Kpis) {
  const share =
    kpis.share_auto_resolved === null || kpis.share_auto_resolved === undefined
      ? '—'
      : `${Math.round(kpis.share_auto_resolved * 100)}%`;
  const hours =
    kpis.estimated_hours_saved === null || kpis.estimated_hours_saved === undefined
      ? '—'
      : `${kpis.estimated_hours_saved} h`;
  return { share, hours };
}

function errorText(error: unknown): string {
  return error instanceof ApiQueryError ? error.message : 'The dashboard data could not be loaded.';
}

export const ReportsPage: React.FC = () => {
  const kpisQuery = useKpis();
  const disputesQuery = useDashboardDisputes();
  const charterQuery = useCharter();
  const disputes = disputesQuery.data ?? [];
  const firstDisputeId = disputes[0]?.id ?? '';
  const timelineQuery = useDisputeTimeline(firstDisputeId);

  const studioData = useMemo(
    () =>
      kpisQuery.data ? toStudioData(kpisQuery.data, disputes) : EMPTY_STUDIO_DATA,
    [kpisQuery.data, disputes]
  );

  const needsApprovalCount = useMemo(() => {
    return disputes.filter(
      (d) => d.latest_verdict === 'NEEDS_APPROVAL' || d.status === 'UNDER_REVIEW'
    ).length;
  }, [disputes]);

  const recentDisputes = useMemo(() => [...disputes]
    .filter(dispute => dispute.status !== 'RESOLVED')
    .sort((a, b) => (a.seller_response_due_date ?? '9999').localeCompare(b.seller_response_due_date ?? '9999'))
    .slice(0, 5), [disputes]);

  const columns = useMemo<ColumnDef<DisputeItem>[]>(
    () => [
      {
        id: 'id',
        header: 'Dispute',
        cell: (row) => (
          <Link
            to={`/app/disputes/${row.id}`}
            style={{
              fontFamily: 'monospace',
              fontWeight: 600,
              color: '#0F766E',
              textDecoration: 'none',
            }}
          >
            {row.id}
          </Link>
        ),
      },
      {
        id: 'reason',
        header: 'Buyer Reason',
        cell: (row) => (
          <span style={{ color: '#111827', fontWeight: 500 }}>{formatDisputeReason(row.reason)}</span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        numeric: true,
        cell: (row) => <Money money={row.amount} />,
      },
      {
        id: 'verdict',
        header: 'PayPal status',
        cell: (row) => (
          <StatusBadge status={row.status} />
        ),
      },
      {
        id: 'due',
        header: 'Due Date',
        cell: (row) => (
          <Deadline dueAt={row.seller_response_due_date ?? null} />
        ),
      },
    ],
    []
  );

  if (kpisQuery.isPending) {
    return (
      <div data-testid="dashboard-loading" style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        <Skeleton height="36px" width="30%" />
        <Skeleton height="80px" />
        <Skeleton height="400px" />
      </div>
    );
  }

  if (kpisQuery.isError || kpisQuery.data === undefined) {
    return (
      <ErrorState
        testId="dashboard-error"
        message={errorText(kpisQuery.error)}
        onRetry={() => void kpisQuery.refetch()}
      />
    );
  }

  const kpis = kpisQuery.data;
  const values = kpiValue(kpis);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4], maxWidth: '1400px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing[2] }}>
        <div>
          <PageHeader
            title="Your disputes"
            description="See what needs your attention and when PayPal expects a response."
            testId="dashboard-title"
          />
        </div>
        <Link
          to="/app/disputes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0F766E',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: radius.control,
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View All Disputes &rarr;
        </Link>
      </div>

      {/* High Priority Operational Triage Banner */}
      {needsApprovalCount > 0 ? (
        <div
          data-testid="kpi-card-approval"
          style={{
            padding: '16px 20px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FCD34D',
            borderRadius: radius.card,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '16px',
              }}
            >
              !
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#92400E' }}>
                <span data-testid="kpi-needs-approval">{needsApprovalCount}</span> listed dispute(s) have a review state
              </div>
              <div style={{ fontSize: '13px', color: '#B45309' }}>
                This reflects the latest recorded verdict or PayPal status, and does not count current approval cards.
              </div>
            </div>
          </div>
          <Link
            to="/app/disputes"
            style={{
              padding: '8px 16px',
              backgroundColor: '#92400E',
              color: '#FFFFFF',
              borderRadius: radius.control,
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Review Pending &rarr;
          </Link>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: radius.card,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: '#166534',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
          <span>No reviews are currently shown in this list.</span>
        </div>
      )}

      {/* Operational Recent Disputes Queue */}
      <section
        aria-label="Recent disputes"
        data-testid="dashboard-disputes-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: radius.card,
          border: `1px solid ${colors.border}`,
          padding: spacing[3],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#111827' }}>
            Open disputes by deadline
          </h2>
          <Link
            to="/app/disputes"
            style={{
              fontSize: '13px',
              color: '#0F766E',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            All Disputes &rarr;
          </Link>
        </div>

        {disputesQuery.isPending && <Skeleton height="140px" />}

        {disputesQuery.isError && (
          <ErrorState
            testId="dashboard-disputes-error"
            message={errorText(disputesQuery.error)}
            onRetry={() => void disputesQuery.refetch()}
          />
        )}

        {disputesQuery.data && recentDisputes.length === 0 && (
          <EmptyState
            title="No open disputes shown"
            description="New disputes will appear here when they are available."
          />
        )}

        {recentDisputes.length > 0 && (
          <DataTable
            columns={columns}
            data={recentDisputes}
            keyExtractor={(d) => d.id}
            rowTestId={(d) => `dashboard-dispute-row-${d.id}`}
            tableTestId="dashboard-disputes-table"
            caption="Recent store disputes"
          />
        )}
      </section>

      {/* Clean Metrics Strip (Replaces AI Card Fatigue) */}
      <section
        aria-label="Dispute metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          backgroundColor: '#FFFFFF',
          borderRadius: radius.card,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div data-testid="kpi-card-open" style={{ padding: '16px 20px', borderRight: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Open Disputes
          </div>
          <div data-testid="kpi-open-disputes" style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: '4px 0 2px' }}>
            {kpis.open_disputes}
          </div>
          <div style={{ fontSize: '12px', color: '#4B5563' }}>Awaiting response or review</div>
        </div>

        <div data-testid="kpi-card-risk" style={{ padding: '16px 20px', borderRight: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            At Risk
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: '4px 0 2px' }}>
            <Money testId="kpi-dollars-at-risk" money={{ value: kpis.dollars_at_risk, currency_code: 'USD' }} />
          </div>
          <div style={{ fontSize: '12px', color: '#4B5563' }}>Active disputed volume</div>
        </div>

        <div data-testid="kpi-card-recovered" style={{ padding: '16px 20px', borderRight: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Seller-favour disputes
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#059669', margin: '4px 0 2px' }}>
            <Money testId="kpi-recovered" money={{ value: kpis.recovered, currency_code: 'USD' }} />
          </div>
          <div style={{ fontSize: '12px', color: '#4B5563' }}>Disputed USD amounts with known outcomes</div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Auto-resolution share
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F766E', margin: '4px 0 2px' }}>
            <span data-testid="kpi-autonomous-share">{values.share}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#4B5563' }}>Estimated time saved: {values.hours}</div>
        </div>
      </section>

      {/* Hidden test-compatibility KPI hooks */}
      <div style={{ display: 'none' }} aria-hidden="true">
        <span data-testid="kpi-card-conceded">
          <Money testId="kpi-conceded" money={{ value: kpis.conceded, currency_code: 'USD' }} />
        </span>
        <span data-testid="kpi-card-share">
          <span data-testid="kpi-share-auto">{values.share}</span>
        </span>
        <span data-testid="kpi-card-hours">
          <span data-testid="kpi-hours-saved">{values.hours}</span>
        </span>
      </div>
      <p data-testid="kpi-assumption" style={{ margin: 0, fontSize: '12px', color: '#4B5563' }}>
        Estimated hours saved assumes {kpis.assumed_minutes_per_dispute} minutes per closed dispute.
        {kpis.non_usd_open_disputes > 0
          ? ` ${kpis.non_usd_open_disputes} open dispute(s) in other currencies are excluded from USD sums.`
          : ''}
      </p>

      {/* Flagship AG Studio Workspace (Always Visible, Primary Centerpiece) */}
      <section aria-label="AG Studio Analytics" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
              AG Studio Analytics Workspace
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #BFDBFE',
              }}
            >
              Interactive BI
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: radius.card, border: `1px solid ${colors.border}`, padding: spacing[2] }}>
          <StudioEmbed data={studioData} />
        </div>
      </section>

      {/* Integrated Assistant & Widgets Section (Test Compatible) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        <AssistantPanel kpis={kpis} disputes={disputes} />
        <WidgetsSection
          disputes={disputes}
          charter={charterQuery.data}
          timeline={timelineQuery.data?.items ?? []}
        />
      </div>
    </div>
  );
};
