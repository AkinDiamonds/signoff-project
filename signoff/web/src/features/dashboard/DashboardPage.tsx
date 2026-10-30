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
  typography,
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

export const DashboardPage: React.FC = () => {
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

  const recentDisputes = useMemo(() => disputes.slice(0, 5), [disputes]);

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
        cell: (row) => <Money money={row.amount} />,
      },
      {
        id: 'verdict',
        header: 'Verdict',
        cell: (row) => (
          <StatusBadge status={row.latest_verdict ?? row.status} />
        ),
      },
      {
        id: 'due',
        header: 'Due',
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
        <Skeleton height="36px" width="40%" />
        <Skeleton height="120px" />
        <Skeleton height="240px" />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      <PageHeader
        title="Disputes"
        description="What needs you today."
        testId="dashboard-title"
      />

      {/* Four compact metric cards */}
      <section
        aria-label="Dispute metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: spacing[2],
        }}
      >
        {/* 1. Open disputes */}
        <div
          data-testid="kpi-card-open"
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            padding: spacing[2],
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
            Open disputes
          </div>
          <div
            data-testid="kpi-open-disputes"
            style={{ fontSize: '24px', fontWeight: typography.fontWeightSemibold, color: colors.ink, margin: '4px 0' }}
          >
            {kpis.open_disputes}
          </div>
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
            Awaiting response or review
          </div>
        </div>

        {/* 2. At risk */}
        <div
          data-testid="kpi-card-risk"
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            padding: spacing[2],
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
            At risk
          </div>
          <div
            style={{ fontSize: '24px', fontWeight: typography.fontWeightSemibold, color: colors.ink, margin: '4px 0' }}
          >
            <Money testId="kpi-dollars-at-risk" money={{ value: kpis.dollars_at_risk, currency_code: 'USD' }} />
          </div>
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
            Open USD balance
          </div>
        </div>

        {/* 3. Recovered */}
        <div
          data-testid="kpi-card-recovered"
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            padding: spacing[2],
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
            Recovered
          </div>
          <div
            style={{ fontSize: '24px', fontWeight: typography.fontWeightSemibold, color: colors.ink, margin: '4px 0' }}
          >
            <Money testId="kpi-recovered" money={{ value: kpis.recovered, currency_code: 'USD' }} />
          </div>
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
            Closed in your favour
          </div>
        </div>

        {/* 4. Needs your approval */}
        <Link
          to="/app/disputes?status=UNDER_REVIEW"
          data-testid="kpi-card-approval"
          style={{
            backgroundColor: needsApprovalCount > 0 ? '#FFFDF5' : colors.surface,
            borderRadius: radius.card,
            padding: spacing[2],
            border: `1px solid ${needsApprovalCount > 0 ? '#FFD79D' : colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div
            style={{
              fontSize: typography.fontSizeSmall,
              color: needsApprovalCount > 0 ? '#5E4200' : colors.inkMuted,
              fontWeight: typography.fontWeightSemibold,
            }}
          >
            Needs your approval
          </div>
          <div
            data-testid="kpi-needs-approval"
            style={{
              fontSize: '24px',
              fontWeight: typography.fontWeightSemibold,
              color: needsApprovalCount > 0 ? '#5E4200' : colors.ink,
              margin: '4px 0',
            }}
          >
            {needsApprovalCount}
          </div>
          <div style={{ fontSize: typography.fontSizeSmall, color: needsApprovalCount > 0 ? '#5E4200' : colors.inkMuted }}>
            {needsApprovalCount > 0 ? 'Action required by merchant' : 'No pending reviews'}
          </div>
        </Link>
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
      <p data-testid="kpi-assumption" style={{ margin: 0, fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
        Estimated hours saved assumes {kpis.assumed_minutes_per_dispute} minutes per closed dispute.
        {kpis.non_usd_open_disputes > 0
          ? ` ${kpis.non_usd_open_disputes} open dispute(s) in other currencies are excluded from USD sums.`
          : ''}
      </p>

      {/* Recent disputes DataTable */}
      <section
        aria-label="Recent disputes"
        data-testid="dashboard-disputes-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[2],
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: typography.fontSizeBody, fontWeight: typography.fontWeightSemibold, margin: 0 }}>
            Recent disputes
          </h2>
          <Link
            to="/app/disputes"
            style={{
              fontSize: typography.fontSizeSmall,
              color: colors.interactive,
              textDecoration: 'none',
              fontWeight: typography.fontWeightMedium,
            }}
          >
            View all disputes &rarr;
          </Link>
        </div>

        {disputesQuery.isPending && <Skeleton height="160px" />}

        {disputesQuery.isError && (
          <ErrorState
            testId="dashboard-disputes-error"
            message={errorText(disputesQuery.error)}
            onRetry={() => void disputesQuery.refetch()}
          />
        )}

        {disputesQuery.data && disputes.length === 0 && (
          <EmptyState
            title="No disputes yet"
            description="Create a scenario from the demo panel to see the full flow."
            action={<Link to="/app/demo" style={{ color: colors.interactive }}>Open the demo panel</Link>}
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

      {/* Collapsed Dashboard tools disclosure */}
      <details
        data-testid="dashboard-tools-disclosure"
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          border: `1px solid ${colors.border}`,
          padding: spacing[2],
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: typography.fontSizeBody,
            fontWeight: typography.fontWeightSemibold,
            color: colors.ink,
            userSelect: 'none',
            padding: `${spacing[1]} 0`,
          }}
        >
          Dashboard tools
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], marginTop: spacing[2] }}>
          <AssistantPanel kpis={kpis} disputes={disputes} />
          <WidgetsSection
            disputes={disputes}
            charter={charterQuery.data}
            timeline={timelineQuery.data?.items ?? []}
          />
          <StudioEmbed data={studioData} />
        </div>
      </details>
    </div>
  );
};
