import React from 'react';
import { Link } from 'react-router';
import { Deadline, ErrorState, Money, PageHeader, Skeleton, colors, formatDisputeReason } from '@signoff/ui';
import { useDashboardDisputes, useKpis } from './api';

export const DashboardPage: React.FC = () => {
  const disputes = useDashboardDisputes();
  const kpis = useKpis();
  const open = (disputes.data ?? []).filter(item => item.status !== 'RESOLVED').sort((a, b) => (a.seller_response_due_date ?? '9999').localeCompare(b.seller_response_due_date ?? '9999'));
  const deadlines = open.filter(item => item.seller_response_due_date);
  const attention = open.filter(item => item.current_approval_available === true || item.analysis_needs_review === true || item.approval_execution_attention != null);
  const attentionAvailabilityKnown = disputes.data?.every(item => typeof item.current_approval_available === 'boolean' && typeof item.analysis_needs_review === 'boolean' && 'approval_execution_attention' in item) ?? false;
  const review = open.filter(item => !item.current_approval_available && !item.analysis_needs_review && !item.approval_execution_attention && (item.latest_verdict === 'NEEDS_APPROVAL' || item.status === 'UNDER_REVIEW'));
  return <div style={{ maxWidth: 900, display: 'grid', gap: 32 }}>
    <PageHeader title="Home" description="Your shop, at a glance." testId="dashboard-title" />
    <section aria-label="Open dispute summary">
      {kpis.isPending && <Skeleton height="80px" />}
      {kpis.isError && <ErrorState message="Couldn’t load the summary." onRetry={() => void kpis.refetch()} />}
      {kpis.data && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', background: colors.surfaceSubtle, borderRadius: 8 }}>
        <div style={{ padding: 20 }}><strong style={{ fontSize: 24 }}>{kpis.data.open_disputes}</strong><div>Open disputes</div></div>
        <div style={{ padding: 20, borderLeft: `1px solid ${colors.border}` }}><strong style={{ fontSize: 24 }}><Money money={{ value: kpis.data.dollars_at_risk, currency_code: 'USD' }} /></strong><div>Open disputed value</div></div>
      </div>}
      <p style={{ color: colors.inkMuted, fontSize: 13 }}>Open means waiting for seller response or pending approval; value includes USD cases.{kpis.dataUpdatedAt > 0 && <> Last updated <time dateTime={new Date(kpis.dataUpdatedAt).toISOString()}>{new Date(kpis.dataUpdatedAt).toLocaleString()}</time>.</>}</p>
    </section>
    <section aria-labelledby="needs-attention-title">
      <h2 id="needs-attention-title" style={{ fontSize: 18, margin: '0 0 8px' }}>Needs attention</h2>
      {disputes.isPending && <Skeleton height="80px" />}
      {disputes.isError && <ErrorState message="Couldn’t load current approvals." onRetry={() => void disputes.refetch()} />}
      {disputes.isSuccess && <>
        <p style={{ color: colors.inkMuted }}>{attentionAvailabilityKnown ? `${attention.length} case${attention.length === 1 ? '' : 's'} in the loaded disputes ${attention.length === 1 ? 'needs' : 'need'} review.` : 'Some attention information is unavailable for the loaded disputes.'}</p>
        {attention.map(item => <Link key={item.id} to={`/app/disputes/${item.id}`} style={{ display: 'grid', gap: 6, padding: '16px 0', borderTop: `1px solid ${colors.border}`, color: colors.ink, textDecoration: 'none' }}>
          <strong>{item.order_code ? `Order ${item.order_code}` : `Case ${item.id}`} · <Money money={item.amount} /></strong>
          <span>{formatDisputeReason(item.reason)}</span>{item.analysis_needs_review && <span>Analysis needs review</span>}{item.current_approval_available && <span>Current approval available</span>}{item.approval_execution_attention === 'FAILED' && <span>Approved action recorded as failed</span>}{item.approval_execution_attention === 'NOT_RECORDED' && <span>Approval saved · execution not recorded</span>}<span style={{ color: colors.interactive }}>Inspect case →</span>
        </Link>)}
        <p style={{ color: colors.inkMuted, fontSize: 13 }}>Based on up to 50 loaded disputes. Open a case to check its current state.</p>
      </>}
    </section>
    <section aria-labelledby="attention-title">
      <h2 id="attention-title" style={{ fontSize: 18, margin: '0 0 8px' }}>Review history</h2>
      {disputes.isPending && <Skeleton height="100px" />}
      {disputes.isError && <ErrorState message="Couldn’t load disputes. Try again." onRetry={() => void disputes.refetch()} />}
      {disputes.isSuccess && <><p style={{ color: colors.inkMuted }}>{review.length ? `${review.length} dispute${review.length === 1 ? '' : 's'} with a historical review state. Open a case to check whether action is available.` : 'No disputes currently show a review state.'}</p>
        {review.slice(0, 3).map(item => <article key={item.id} style={{ padding: '20px 0', borderTop: `1px solid ${colors.border}` }}>
          <strong>{item.order_code ? `Order ${item.order_code}` : `Case ${item.id}`} · <Money money={item.amount} /></strong>
          <p style={{ margin: '8px 0' }}>{formatDisputeReason(item.reason)}</p>
          <p style={{ margin: '8px 0', color: colors.inkMuted }}><Deadline dueAt={item.seller_response_due_date ?? null} /></p>
          <Link to={`/app/disputes/${item.id}`} style={{ color: colors.interactive, fontWeight: 600 }}>Inspect case</Link>
        </article>)}
      </>}
    </section>
    <section aria-labelledby="deadlines-title" style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 24 }}>
      <h2 id="deadlines-title" style={{ fontSize: 18, margin: '0 0 12px' }}>Deadlines</h2>
      {disputes.isSuccess && (deadlines.length ? deadlines.slice(0, 5).map(item => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '14px 0', borderBottom: `1px solid ${colors.border}` }}><Link to={`/app/disputes/${item.id}`} style={{ color: colors.interactive }}>{item.order_code || item.id}</Link><Deadline dueAt={item.seller_response_due_date ?? null} /></div>) : <p>No deadlines are available. Check disputes for the latest status.</p>)}
      <p><Link to="/app/disputes" style={{ color: colors.interactive, fontWeight: 600 }}>View all disputes</Link></p>
    </section>
  </div>;
};
