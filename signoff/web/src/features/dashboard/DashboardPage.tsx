import React from 'react';
import { Link } from 'react-router';
import { Deadline, ErrorState, Money, PageHeader, Skeleton, formatDisputeReason } from '@signoff/ui';
import { useDashboardDisputes, useKpis } from './api';

export const DashboardPage: React.FC = () => {
  const disputes = useDashboardDisputes();
  const kpis = useKpis();
  const open = (disputes.data ?? []).filter(item => item.status !== 'RESOLVED').sort((a, b) => (a.seller_response_due_date ?? '9999').localeCompare(b.seller_response_due_date ?? '9999'));
  const deadlines = open.filter(item => item.seller_response_due_date);
  const review = open.filter(item => item.latest_verdict === 'NEEDS_APPROVAL' || item.status === 'UNDER_REVIEW');
  return <div style={{ maxWidth: 900, display: 'grid', gap: 32 }}>
    <PageHeader title="Home" description="Keep up with the work that needs you." testId="dashboard-title" />
    <section aria-labelledby="attention-title">
      <h2 id="attention-title" style={{ fontSize: 20, margin: '0 0 8px' }}>Needs your attention</h2>
      {disputes.isPending && <Skeleton height="100px" />}
      {disputes.isError && <ErrorState message="Couldn’t load disputes. Try again." onRetry={() => void disputes.refetch()} />}
      {disputes.isSuccess && <><p style={{ color: '#52605a' }}>{review.length ? `${review.length} dispute${review.length === 1 ? '' : 's'} with a review state` : 'No disputes currently show a review state.'}</p>
        {review.slice(0, 3).map(item => <article key={item.id} style={{ padding: '20px 0', borderTop: '1px solid #e3e7e4' }}>
          <strong>{item.order_code ? `Order ${item.order_code}` : `Case ${item.id}`} · <Money money={item.amount} /></strong>
          <p style={{ margin: '8px 0' }}>{formatDisputeReason(item.reason)}</p>
          <p style={{ margin: '8px 0', color: '#52605a' }}><Deadline dueAt={item.seller_response_due_date ?? null} /></p>
          <Link to={`/app/disputes/${item.id}`} style={{ color: '#14532d', fontWeight: 700 }}>Review dispute</Link>
        </article>)}
      </>}
    </section>
    <section aria-labelledby="deadlines-title" style={{ borderTop: '1px solid #e3e7e4', paddingTop: 24 }}>
      <h2 id="deadlines-title" style={{ fontSize: 20, margin: '0 0 12px' }}>Upcoming deadlines</h2>
      {disputes.isSuccess && (deadlines.length ? deadlines.slice(0, 5).map(item => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '14px 0', borderBottom: '1px solid #e3e7e4' }}><Link to={`/app/disputes/${item.id}`} style={{ color: '#14532d' }}>{item.order_code || item.id}</Link><Deadline dueAt={item.seller_response_due_date ?? null} /></div>) : <p>No upcoming deadlines are available. Check disputes for the latest status.</p>)}
      <p><Link to="/app/disputes" style={{ color: '#14532d', fontWeight: 600 }}>View all disputes</Link></p>
    </section>
    <section aria-labelledby="summary-title" style={{ borderTop: '1px solid #e3e7e4', paddingTop: 24 }}><h2 id="summary-title" style={{ fontSize: 20 }}>Summary</h2>
      {kpis.isPending && <Skeleton height="48px" />}
      {kpis.isError && <ErrorState message="Couldn’t load the summary." onRetry={() => void kpis.refetch()} />}
      {kpis.data && <p>{kpis.data.open_disputes} open disputes · <Money money={{ value: kpis.data.dollars_at_risk, currency_code: 'USD' }} /> in open USD disputes</p>}
    </section>
  </div>;
};
