import React, { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Card,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  ServerVerdictChip,
  Skeleton,
  colors,
  spacing,
} from '@signoff/ui';
import { ApiQueryError, useDisputeTimeline } from '../../app/queries';
import { useCharter } from '../charter';
import { WidgetsSection } from '../widgets';
import { AssistantPanel } from './AssistantPanel';
import { StudioEmbed } from './StudioEmbed';
import { useDashboardDisputes, useKpis } from './api';
import { toStudioData, type Kpis, type StudioData } from './types';

const EMPTY_STUDIO_DATA: StudioData = {
  sources: [
    { id: 'disputes', data: [] },
    { id: 'kpis', data: [] },
  ],
};

const KpiCard: React.FC<{ label: string; value: React.ReactNode; note: string; testId: string }> = ({
  label,
  value,
  note,
  testId,
}) => (
  <div
    data-testid={testId}
    style={{ border: `1px solid ${colors.border}`, borderRadius: '8px', padding: spacing[2], backgroundColor: colors.surface }}
  >
    <div style={{ fontSize: '12px', color: colors.inkMuted, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0' }}>{value}</div>
    <div style={{ fontSize: '12px', color: colors.inkMuted }}>{note}</div>
  </div>
);

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

  if (kpisQuery.isPending) {
    return (
      <div data-testid="dashboard-loading">
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      <header>
        <h1 data-testid="dashboard-title" style={{ margin: 0 }}>Dispute operations</h1>
        <p style={{ color: colors.inkMuted, margin: '4px 0 0' }}>
          Live KPIs and disputes. Every number comes from the API.
        </p>
      </header>

      <section aria-label="Key performance indicators" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing[1] }}>
        <KpiCard
          label="Open disputes"
          value={<span data-testid="kpi-open-disputes">{kpis.open_disputes}</span>}
          note="Seller response or approval pending"
          testId="kpi-card-open"
        />
        <KpiCard
          label="Dollars at risk"
          value={<Money testId="kpi-dollars-at-risk" money={{ value: kpis.dollars_at_risk, currency_code: 'USD' }} />}
          note="Open USD disputes"
          testId="kpi-card-risk"
        />
        <KpiCard
          label="Recovered"
          value={<Money testId="kpi-recovered" money={{ value: kpis.recovered, currency_code: 'USD' }} />}
          note="Resolved in your favor"
          testId="kpi-card-recovered"
        />
        <KpiCard
          label="Conceded"
          value={<Money testId="kpi-conceded" money={{ value: kpis.conceded, currency_code: 'USD' }} />}
          note="Refunded or conceded"
          testId="kpi-card-conceded"
        />
        <KpiCard
          label="Share auto-resolved"
          value={<span data-testid="kpi-share-auto">{values.share}</span>}
          note="Closed without a human"
          testId="kpi-card-share"
        />
        <KpiCard
          label="Estimated hours saved"
          value={<span data-testid="kpi-hours-saved">{values.hours}</span>}
          note={`Assumes ${kpis.assumed_minutes_per_dispute} min per dispute`}
          testId="kpi-card-hours"
        />
      </section>
      <p data-testid="kpi-assumption" style={{ margin: 0, fontSize: '12px', color: colors.inkMuted }}>
        Estimated hours saved assumes {kpis.assumed_minutes_per_dispute} minutes per closed dispute.
        {kpis.non_usd_open_disputes > 0
          ? ` ${kpis.non_usd_open_disputes} open dispute(s) in other currencies are excluded from USD sums.`
          : ''}
      </p>

      {/* Legacy "Ask the dashboard" panel — kept as fallback, hidden unless ?assistant=1 is set. */}
      {new URLSearchParams(window.location.search).get('assistant') === '1' && (
        <AssistantPanel kpis={kpis} disputes={disputes} />
      )}

      <Card title="Recent disputes" testId="dashboard-disputes-card">
        {disputesQuery.isPending && <Skeleton height="120px" />}
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
            action={<Link to="/app/demo" style={{ color: colors.brandPrimary }}>Open the demo panel</Link>}
          />
        )}
        {disputes.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="dashboard-disputes-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: '12px', color: colors.inkMuted }}>
                  <th style={{ padding: '6px' }}>Dispute</th>
                  <th style={{ padding: '6px' }}>Amount</th>
                  <th style={{ padding: '6px' }}>Verdict</th>
                  <th style={{ padding: '6px' }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((dispute) => (
                  <tr key={dispute.id} data-testid={`dashboard-dispute-row-${dispute.id}`} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '6px' }}>
                      <Link to={`/app/disputes/${dispute.id}`} style={{ color: colors.brandPrimary }}>
                        {dispute.id}
                      </Link>
                      <div style={{ fontSize: '12px', color: colors.inkMuted }}>{dispute.reason.replace(/_/g, ' ')}</div>
                    </td>
                    <td style={{ padding: '6px' }}><Money money={dispute.amount} /></td>
                    <td style={{ padding: '6px' }}>
                      <ServerVerdictChip value={dispute.latest_verdict ?? null} />
                    </td>
                    <td style={{ padding: '6px' }}><Deadline dueAt={dispute.seller_response_due_date ?? null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <WidgetsSection
        disputes={disputes}
        charter={charterQuery.data}
        timeline={timelineQuery.data?.items ?? []}
      />

      <StudioEmbed data={studioData} />
    </div>
  );
};
