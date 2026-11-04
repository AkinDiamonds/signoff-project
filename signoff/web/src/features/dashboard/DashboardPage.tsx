import React from 'react';
import { Link } from 'react-router';
import {
  ConceptCard, ConceptIcon, ConceptPageTitle, ConceptPill, ConceptSectionHeading, ConceptStatTile, ErrorState, Money, Skeleton,
  concept, disputePill, formatDeadlineFull, formatDisputeReason, formatMoney, formatMoneyCompact,
} from '@signoff/ui';
import type { DisputeListItem } from '../disputes/types';
import { useDashboardDisputes, useKpis } from './api';

function attentionNote(item: DisputeListItem): string {
  if (item.approval_execution_attention === 'FAILED') return 'Approved action recorded as failed';
  if (item.approval_execution_attention === 'NOT_RECORDED') return 'Approval saved · execution not recorded';
  if (item.analysis_needs_review) return 'Analysis needs review';
  return 'Current approval available';
}

export const DashboardPage: React.FC = () => {
  const disputes = useDashboardDisputes();
  const kpis = useKpis();
  const open = (disputes.data ?? []).filter(item => item.status !== 'RESOLVED').sort((a, b) => (a.seller_response_due_date ?? '9999').localeCompare(b.seller_response_due_date ?? '9999'));
  const nextDeadline = open.find(item => item.seller_response_due_date);
  const attention = open.filter(item => item.current_approval_available === true || item.analysis_needs_review === true || item.approval_execution_attention != null);
  return <div style={{ maxWidth: 900, display: 'grid', gap: 32 }}>
    <ConceptPageTitle title="Home" subtitle="Your shop, at a glance." testId="dashboard-title" />
    <section aria-label="Open dispute summary">
      {kpis.isPending && <Skeleton height="80px" />}
      {kpis.isError && <ErrorState message="Couldn’t load the summary." onRetry={() => void kpis.refetch()} />}
      {kpis.data && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
        <ConceptStatTile testId="kpi-card-open" valueTestId="kpi-open-disputes" value={kpis.data.open_disputes} label="Open disputes" />
        <ConceptStatTile testId="kpi-card-risk" valueTestId="kpi-dollars-at-risk" value={formatMoneyCompact({ value: kpis.data.dollars_at_risk, currency_code: 'USD' })} label="At risk" />
      </div>}
    </section>
    <section aria-labelledby="needs-attention-title" style={{ display: 'grid', gap: 14 }}>
      <ConceptSectionHeading id="needs-attention-title">Needs attention</ConceptSectionHeading>
      {disputes.isPending && <Skeleton height="80px" />}
      {disputes.isError && <ErrorState message="Couldn’t load current approvals." onRetry={() => void disputes.refetch()} />}
      {disputes.isSuccess && attention.length === 0 && <p style={{ margin: 0, color: concept.muted }}>Nothing needs your attention right now.</p>}
      {disputes.isSuccess && attention.map(item => {
        const pill = disputePill(item);
        return <ConceptCard key={item.id} padding={18} style={{ borderRadius: 14 }}>
          <Link to={`/app/disputes/${item.id}`} style={{ display: 'grid', gap: 10, color: concept.ink, textDecoration: 'none' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <strong style={{ fontSize: 17 }}>{item.order_code ?? `Case ${item.id}`}</strong>
              <strong style={{ whiteSpace: 'nowrap' }}><Money money={item.amount} /></strong>
            </span>
            <span>{formatDisputeReason(item.reason)}</span>
            <span><ConceptPill tone={pill.tone}>{pill.label}</ConceptPill></span>
            <span style={{ color: concept.muted, fontSize: 14 }}>{attentionNote(item)}</span>
            <span style={{ color: concept.primary, fontWeight: 650 }}>Inspect case →</span>
          </Link>
        </ConceptCard>;
      })}
    </section>
    <section aria-labelledby="deadlines-title" style={{ display: 'grid', gap: 14 }}>
      <ConceptSectionHeading id="deadlines-title">Upcoming deadline</ConceptSectionHeading>
      {disputes.isSuccess && (nextDeadline
        ? <ConceptCard padding={0} style={{ borderRadius: 14 }}>
          <Link to={`/app/disputes/${nextDeadline.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, color: concept.ink, textDecoration: 'none' }}>
            <ConceptIcon name="calendar" />
            <span style={{ flex: 1, display: 'grid', gap: 2 }}>
              <time dateTime={nextDeadline.seller_response_due_date ?? undefined} style={{ fontSize: 17, fontWeight: 650 }}>{formatDeadlineFull(nextDeadline.seller_response_due_date)}</time>
              <span style={{ color: concept.muted, fontSize: 14 }}>{nextDeadline.order_code ?? nextDeadline.id} · {formatMoney(nextDeadline.amount)}</span>
            </span>
            <ConceptIcon name="chevron-right" color={concept.muted} />
          </Link>
        </ConceptCard>
        : <p style={{ margin: 0, color: concept.muted }}>No deadlines are available.</p>)}
    </section>
  </div>;
};
