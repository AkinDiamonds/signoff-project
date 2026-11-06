import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ConceptCard,
  ConceptDisclosure,
  ConceptIcon,
  ConceptPageTitle,
  ConceptPill,
  ConceptSectionHeading,
  ConceptSegmented,
  ConceptStatTile,
  DataTable,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  StatusBadge,
  Skeleton,
  colors,
  concept,
  formatDisputeReason,
  formatMoneyCompact,
  radius,
  spacing,
} from '@signoff/ui';
import type { ColumnDef } from '@signoff/ui';
import { ApiQueryError, useDisputeTimeline } from '../../app/queries';
import { useCharter } from '../charter';
import { getDemoSession } from '../demo/api';
import { WidgetsSection, classifyDeadline } from '../widgets';
import { AssistantPanel } from './AssistantPanel';
import { StudioEmbed } from './StudioEmbed';
import { useDashboardDisputes, useKpis, type KpiScope } from './api';
import { toStudioData, type DisputeItem, type Kpis, type StudioData } from './types';

const EMPTY_STUDIO_DATA: StudioData = {
  sources: [
    { id: 'disputes', data: [] },
    { id: 'kpis', data: [] },
  ],
};

const SR_ONLY: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

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

function lastUpdated(updatedAt: number): string {
  if (updatedAt <= 0) return '';
  const minutes = Math.floor((Date.now() - updatedAt) / 60_000);
  return minutes < 1 ? 'Last updated just now' : `Last updated ${minutes} min ago`;
}

function fitted(text: string): React.ReactNode {
  return text.length > 7 ? <span style={{ fontSize: 24 }}>{text}</span> : text;
}

function openOnDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 900px)').matches;
}

const SCOPE_OPTIONS = [
  { value: 'mine', label: 'My session' },
  { value: 'all', label: 'All time' },
];

export const ReportsPage: React.FC = () => {
  const demoSession = getDemoSession();
  const [scope, setScope] = useState<KpiScope>(demoSession ? 'mine' : 'all');
  const assistant = useSearchParams()[0].get('studio') === 'ai';
  const [analyticsOpen] = useState(() => assistant || openOnDesktop());
  const kpisQuery = useKpis(scope, demoSession);
  const disputesQuery = useDashboardDisputes(scope, demoSession);
  const charterQuery = useCharter();
  const disputes = useMemo(() => disputesQuery.data ?? [], [disputesQuery.data]);
  const firstDisputeId = disputes[0]?.id ?? '';
  const timelineQuery = useDisputeTimeline(firstDisputeId);
  const scopeNote = `Scope: ${scope === 'mine' ? 'My session' : 'All time'}`;

  const studioData = useMemo(
    () => (kpisQuery.data ? toStudioData(kpisQuery.data, disputes) : EMPTY_STUDIO_DATA),
    [kpisQuery.data, disputes]
  );

  const needsApprovalCount = useMemo(
    () => disputes.filter((d) => d.latest_verdict === 'NEEDS_APPROVAL' || d.status === 'UNDER_REVIEW').length,
    [disputes]
  );

  const recentDisputes = useMemo(() => [...disputes]
    .filter(dispute => dispute.status !== 'RESOLVED')
    .sort((a, b) => (a.seller_response_due_date ?? '9999').localeCompare(b.seller_response_due_date ?? '9999'))
    .slice(0, 5), [disputes]);

  const radar = useMemo(() => {
    const now = new Date();
    const counts = { OVERDUE: 0, DUE_SOON: 0, SCHEDULED: 0 };
    for (const item of recentDisputes) {
      const urgency = classifyDeadline(item.seller_response_due_date ?? null, now);
      if (urgency !== 'NONE') counts[urgency] += 1;
    }
    const next = recentDisputes.find(item => classifyDeadline(item.seller_response_due_date ?? null, now) !== 'NONE');
    return { counts, next, nextUrgency: next ? classifyDeadline(next.seller_response_due_date ?? null, now) : 'NONE' };
  }, [recentDisputes]);

  const columns = useMemo<ColumnDef<DisputeItem>[]>(
    () => [
      {
        id: 'id',
        header: 'Dispute',
        cell: (row) => (
          <Link to={`/app/disputes/${row.id}`} style={{ fontFamily: 'monospace', fontWeight: 600, color: concept.primary, textDecoration: 'none' }}>
            {row.id}
          </Link>
        ),
      },
      {
        id: 'reason',
        header: 'Buyer Reason',
        cell: (row) => <span style={{ color: 'var(--signoff-ink, #252521)', fontWeight: 500 }}>{formatDisputeReason(row.reason)}</span>,
      },
      { id: 'amount', header: 'Amount', numeric: true, cell: (row) => <Money money={row.amount} /> },
      { id: 'verdict', header: 'PayPal status', cell: (row) => <StatusBadge status={row.status} /> },
      { id: 'due', header: 'Due Date', cell: (row) => <Deadline dueAt={row.seller_response_due_date ?? null} /> },
    ],
    []
  );

  const kpis = kpisQuery.data;
  const values = kpis ? kpiValue(kpis) : null;
  const atRisk = kpis ? { value: kpis.dollars_at_risk, currency_code: 'USD' } : null;
  const recovered = kpis ? { value: kpis.recovered, currency_code: 'USD' } : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28, maxWidth: 900, minWidth: 0 }}>
      <ConceptPageTitle title="Reports" testId="dashboard-title" />
      <ConceptSegmented ariaLabel="Report scope" idPrefix="reports-scope" options={SCOPE_OPTIONS} value={scope} onChange={(value) => setScope(value === 'all' ? 'all' : 'mine')} />

      {kpisQuery.isPending && (
        <div data-testid="dashboard-loading" style={{ display: 'grid', gap: spacing[2] }}>
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      )}

      {kpisQuery.isError && (
        <ErrorState testId="dashboard-error" message={errorText(kpisQuery.error)} onRetry={() => void kpisQuery.refetch()} />
      )}

      {kpis && values && atRisk && recovered && (
        <section aria-label="Dispute metrics" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <ConceptStatTile testId="kpi-card-open" valueTestId="kpi-open-disputes" value={kpis.open_disputes} label="Open disputes" note={scopeNote} />
            <div data-testid="kpi-card-risk" style={{ display: 'contents' }}>
              <ConceptStatTile
                value={<><span aria-hidden="true">{fitted(formatMoneyCompact(atRisk, { space: false }))}</span><span data-testid="kpi-dollars-at-risk" style={SR_ONLY}><Money money={atRisk} /></span></>}
                label="Open disputed value"
                note={scopeNote}
              />
            </div>
            <ConceptStatTile testId="kpi-card-share" valueTestId="kpi-autonomous-share" value={values.share} label="Auto-resolution share" note={scopeNote} />
            <div data-testid="kpi-card-recovered" style={{ display: 'contents' }}>
              <ConceptStatTile
                value={<><span aria-hidden="true">{fitted(formatMoneyCompact(recovered, { space: false }))}</span><span data-testid="kpi-recovered" style={SR_ONLY}><Money money={recovered} /></span></>}
                label="Known seller-favour value"
                note={scopeNote}
              />
            </div>
          </div>
          {kpisQuery.dataUpdatedAt > 0 && <p style={{ margin: 0, fontSize: 13, color: concept.muted }}>{lastUpdated(kpisQuery.dataUpdatedAt)}</p>}
          {scope === 'mine' && !demoSession && <p style={{ margin: 0, fontSize: 13, color: concept.muted }}>No sandbox session yet. Run a demo scenario to see your own totals, or switch to All time.</p>}
        </section>
      )}

      <section aria-labelledby="radar-title" style={{ display: 'grid', gap: 14 }}>
        <ConceptSectionHeading id="radar-title">Deadline radar</ConceptSectionHeading>
        {disputesQuery.isPending && <Skeleton height="96px" />}
        {disputesQuery.isError && (
          <ErrorState testId="dashboard-disputes-error" message={errorText(disputesQuery.error)} onRetry={() => void disputesQuery.refetch()} />
        )}
        {disputesQuery.data && (
          <>
            <div data-testid="reports-radar-summary" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <ConceptPill tone="red">{radar.counts.OVERDUE} Overdue</ConceptPill>
              <ConceptPill tone="amber">{radar.counts.DUE_SOON} Due in 48h</ConceptPill>
              <ConceptPill tone="green">{radar.counts.SCHEDULED} Scheduled</ConceptPill>
            </div>
            {radar.next && radar.next.seller_response_due_date ? (
              <ConceptCard as={Link} to={`/app/disputes/${radar.next.id}`} testId="reports-next-deadline" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
                <ConceptIcon name="calendar" />
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                  <time dateTime={radar.next.seller_response_due_date} style={{ fontSize: 17, fontWeight: 650 }}>
                    {new Date(radar.next.seller_response_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })}
                  </time>
                  <span style={{ fontSize: 14, color: concept.muted }}>{radar.next.order_code ?? radar.next.id} · <Money money={radar.next.amount} /></span>
                </span>
                <ConceptPill tone={radar.nextUrgency === 'OVERDUE' ? 'red' : radar.nextUrgency === 'DUE_SOON' ? 'amber' : 'green'}>
                  {radar.nextUrgency === 'OVERDUE' ? 'Overdue' : radar.nextUrgency === 'DUE_SOON' ? 'Due soon' : 'Scheduled'}
                </ConceptPill>
                <ConceptIcon name="chevron-right" color={concept.muted} />
              </ConceptCard>
            ) : (
              <p style={{ margin: 0, color: concept.muted }}>No upcoming deadlines.</p>
            )}
          </>
        )}
      </section>

      {kpis && <AssistantPanel kpis={kpis} disputes={disputes} />}

      {kpis && values && (
        <ConceptCard padding={0}>
          <ConceptDisclosure title="More analytics" subtitle="Review states, dispute queue, authority and Studio" defaultOpen={analyticsOpen} testId="reports-more-analytics">
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
              {needsApprovalCount > 0 ? (
                <div
                  data-testid="kpi-card-approval"
                  style={{ padding: '16px 20px', backgroundColor: concept.warningBg, borderRadius: radius.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      <span data-testid="kpi-needs-approval">{needsApprovalCount}</span> listed dispute(s) have a review state
                    </div>
                    <div style={{ fontSize: 13, color: concept.muted }}>
                      This reflects the latest recorded verdict or PayPal status, and does not count current approval cards.
                    </div>
                  </div>
                  <Link to="/app/disputes" style={{ fontSize: 14, fontWeight: 650, color: concept.primary }}>View disputes →</Link>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: concept.muted }}>No historical review states are shown in this list.</p>
              )}

              <details>
                <summary style={{ cursor: 'pointer', minHeight: 44, fontWeight: 600 }}>View non-resolved disputes</summary>
                <section
                  aria-label="Recent disputes"
                  data-testid="dashboard-disputes-card"
                  style={{ border: `1px solid ${colors.border}`, borderRadius: radius.card, padding: spacing[3], display: 'flex', flexDirection: 'column', gap: spacing[2] }}
                >
                  <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Non-resolved disputes by deadline</h2>
                  {disputesQuery.data && recentDisputes.length === 0 && (
                    <EmptyState title="No open disputes shown" description="New disputes will appear here when they are available." />
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
              </details>

              <div style={{ display: 'none' }} aria-hidden="true">
                <span data-testid="kpi-card-conceded"><Money testId="kpi-conceded" money={{ value: kpis.conceded, currency_code: 'USD' }} /></span>
                <span data-testid="kpi-share-auto">{values.share}</span>
                <span data-testid="kpi-card-hours"><span data-testid="kpi-hours-saved">{values.hours}</span></span>
              </div>
              <p data-testid="kpi-assumption" style={{ margin: 0, fontSize: 13, color: concept.muted }}>
                Estimated hours saved assumes {kpis.assumed_minutes_per_dispute} minutes per closed dispute.
                {kpis.non_usd_open_disputes > 0
                  ? ` ${kpis.non_usd_open_disputes} open dispute(s) in other currencies are excluded from USD sums.`
                  : ''}
              </p>

              <WidgetsSection disputes={disputes} charter={charterQuery.data} timeline={timelineQuery.data?.items ?? []} />

              <section aria-label="AG Studio Analytics" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>AG Studio Analytics Workspace</h2>
                <div style={{ borderRadius: radius.card, border: `1px solid ${colors.border}`, padding: spacing[2] }}>
                  <StudioEmbed data={studioData} assistant={assistant} />
                </div>
              </section>
            </div>
          </ConceptDisclosure>
        </ConceptCard>
      )}
    </div>
  );
};
