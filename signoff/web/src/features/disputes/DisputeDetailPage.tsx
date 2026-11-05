import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import {
  ConceptIcon,
  ConceptSegmented,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  concept,
  conceptType,
  formatDeadlineFull,
  formatDisputeReason,
  getRuleExplanation,
  radius,
  spacing,
  typography,
  toast,
} from '@signoff/ui';
import { useDispute, useDisputeTimeline, useEvidenceSnapshots, unwrap } from '../../app/queries';
import { apiClient } from '../../app/api';
import { DecisionTimeline, ExecutionAttempts } from './timeline';
import { CaseOverviewTab } from './CaseOverviewTab';
import { CaseEvidenceTab } from './CaseEvidenceTab';
import type { ApiTimelineEvent, DisputeDetail } from './types';

type CaseTab = 'overview' | 'evidence' | 'activity';
const TAB_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'activity', label: 'Activity' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const origin: unknown = location.state;
  const backTo = origin && typeof origin === 'object' && 'from' in origin && typeof origin.from === 'string' && origin.from.startsWith('/app/disputes') ? origin.from : '/app/disputes';
  const disputeId = id ?? '';

  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTabState] = useState<CaseTab>(requestedTab === 'evidence' || requestedTab === 'activity' ? requestedTab : 'overview');
  const setTab = (next: string) => {
    const value: CaseTab = next === 'evidence' || next === 'activity' ? next : 'overview';
    setTabState(value);
    const url = new URL(window.location.href);
    if (value === 'overview') url.searchParams.delete('tab'); else url.searchParams.set('tab', value);
    window.history.replaceState(window.history.state, '', url);
  };

  const copyDisputeLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/disputes/${encodeURIComponent(disputeId)}`);
      toast('Dispute link copied.');
    } catch {
      toast('Could not copy the link. Copy the address from your browser instead.', 'error');
    }
  };

  const disputeQuery = useDispute(disputeId, { refetchInterval: 5000 });
  const timelineQuery = useDisputeTimeline(disputeId, { refetchInterval: 5000 });
  const evidenceQuery = useEvidenceSnapshots(disputeId);

  const [displayedDispute, setDisplayedDispute] = useState<DisputeDetail | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const latestTimestampRef = useRef<number>(0);

  const [isMessageExpanded, setIsMessageExpanded] = useState<boolean>(false);
  const [refreshingEvidence, setRefreshingEvidence] = useState(false);
  const [evidenceRefreshMessage, setEvidenceRefreshMessage] = useState<string | null>(null);
  const refreshingEvidenceRef = useRef(false);

  const refreshEvidence = async () => {
    if (refreshingEvidenceRef.current) return;
    refreshingEvidenceRef.current = true;
    setRefreshingEvidence(true);
    setEvidenceRefreshMessage(null);
    try {
      await unwrap(apiClient.request('/api/disputes/{id}/evidence/refresh', {
        method: 'POST', params: { path: { id: disputeId } },
      }));
      const refreshed = await evidenceQuery.refetch();
      toast('Evidence snapshot saved. No PayPal action was started.');
      setEvidenceRefreshMessage(refreshed.isError
        ? 'Evidence was saved, but the history could not be reloaded. Please refresh the page.'
        : 'Evidence refreshed. No model plan or PayPal action was started.');
    } catch {
      setEvidenceRefreshMessage('Evidence could not be refreshed. Please try again.');
      toast('Evidence could not be refreshed.', 'error');
    } finally {
      refreshingEvidenceRef.current = false;
      setRefreshingEvidence(false);
    }
  };

  useEffect(() => {
    if (disputeQuery.data) {
      const incomingTs = new Date(disputeQuery.data.updated_at).getTime();
      if (latestTimestampRef.current === 0 || incomingTs >= latestTimestampRef.current) {
        latestTimestampRef.current = incomingTs;
        setDisplayedDispute(disputeQuery.data);
        setLastUpdated(new Date());
      }
    }
  }, [disputeQuery.data]);

  if (disputeQuery.isPending && !displayedDispute) {
    return (
      <div data-testid="dispute-detail-loading" style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        <Skeleton height="36px" width="30%" />
        <Skeleton height="100px" />
        <Skeleton height="240px" />
      </div>
    );
  }

  if (disputeQuery.isError) {
    const error = disputeQuery.error;
    if (error.message?.toLowerCase().includes('not found') || error.correlationId === 'mock-not-found') {
      return (
        <EmptyState
          testId="dispute-not-found"
          title="Dispute not found"
          description={`The dispute '${disputeId}' does not exist or may have been deleted.`}
          action={
            <Link
              to="/app/disputes"
              data-testid="back-to-disputes-link"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: concept.primary,
                color: '#FFFFFF',
                borderRadius: radius.control,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: typography.fontSizeBody,
              }}
            >
              Back to disputes
            </Link>
          }
        />
      );
    }

    return (
      <ErrorState
        testId="dispute-detail-error"
        message={error.message}
        correlationId={error.correlationId}
        onRetry={() => void disputeQuery.refetch()}
      />
    );
  }

  if (!displayedDispute) {
    return null;
  }

  const snapshot = displayedDispute.snapshot ?? {};
  const rawBuyerMessage =
    (typeof snapshot.buyer_message === 'string' && snapshot.buyer_message) ||
    (Array.isArray(snapshot.messages) &&
      snapshot.messages[0] &&
      typeof snapshot.messages[0].content === 'string' &&
      snapshot.messages[0].content) ||
    null;

  const rawEvidence = isRecord(snapshot.evidence) ? snapshot.evidence : null;

  let evidenceStrength: string | null = null;
  if (rawEvidence && typeof rawEvidence.evidence_strength === 'string') {
    evidenceStrength = rawEvidence.evidence_strength;
  } else if (timelineQuery.data?.items) {
    const evidenceEvt = timelineQuery.data.items.find(
      (ev) => 'kind' in ev && ev.kind === 'EVIDENCE_BUILT'
    );
    if (evidenceEvt && 'evidence_strength' in evidenceEvt && typeof evidenceEvt.evidence_strength === 'string') {
      evidenceStrength = evidenceEvt.evidence_strength;
    }
  }

  const latestRunState = timelineQuery.data?.items?.filter(event =>
    ['RUN_STARTED', 'NO_ACTION', 'RUN_FAILED', 'GATE_DECIDED'].includes(event.kind)
  ).reduce<ApiTimelineEvent | undefined>((latest, event) =>
    !latest || event.sequence_number > latest.sequence_number ? event : latest, undefined);
  const needsDeliveryReview = latestRunState?.kind === 'NO_ACTION' && 'reason' in latestRunState &&
    latestRunState.reason === 'tracking_requires_review';
  const needsPolicyReview = latestRunState?.kind === 'NO_ACTION' && 'reason' in latestRunState &&
    latestRunState.reason === 'signing_policy_changed';
  const needsAnalysisReview = latestRunState?.kind === 'RUN_FAILED';
  const isAgentRunning =
    displayedDispute.status === 'WAITING_FOR_SELLER_RESPONSE' &&
    latestRunState?.kind === 'RUN_STARTED';

  const ruleId = displayedDispute.latest_rule_id;
  const ruleExplanation = ruleId ? getRuleExplanation(ruleId) : 'No gate rule recorded';
  const plainReason = formatDisputeReason(displayedDispute.reason);
  const approvalState = displayedDispute.latest_approval_resolution;
  const executionState = displayedDispute.latest_execution_status;
  const reviewLabel = approvalState === undefined ? 'Status unavailable'
    : approvalState === 'PENDING' ? displayedDispute.approval_url?.startsWith('/app/approvals/') ? 'Your review is needed' : 'Review link unavailable'
    : approvalState === 'APPROVE' || approvalState === 'EDIT' ? 'Approval saved'
    : approvalState === 'DENY' ? 'You declined the proposal'
    : approvalState === 'EXPIRED' ? 'Approval expired'
    : latestRunState?.kind === 'RUN_FAILED' ? 'Analysis could not finish'
    : 'No review is pending';
  const actionLabel = executionState === undefined ? 'Status unavailable'
    : executionState === 'QUEUED' ? 'Waiting to be sent'
    : executionState === 'INTENDED' ? 'Preparing to send; result uncertain'
    : executionState === 'SENT' ? 'Sent; PayPal result uncertain'
    : executionState === 'CONFIRMED' ? 'Recorded as confirmed'
    : executionState === 'FAILED' ? 'Recorded as failed'
    : approvalState === 'APPROVE' || approvalState === 'EDIT' ? 'Approval saved; no execution recorded'
    : 'No action recorded';
  const uncertainAction = executionState === 'INTENDED' || executionState === 'SENT';
  // Only authenticated owner cards are generated after the server checks the
  // pending approval, expiry and dispute fingerprint. Legacy demo links do not
  // establish that a current approval exists.
  const currentApprovalUrl = approvalState === 'PENDING' && displayedDispute.approval_url?.startsWith('/app/approvals/') ? displayedDispute.approval_url : null;
  const approvalSavedWithoutExecution = (approvalState === 'APPROVE' || approvalState === 'EDIT') && !executionState;

  const orderLabel = displayedDispute.order_code ? `Order ${displayedDispute.order_code}` : `Case ${displayedDispute.id}`;
  const dueAt = displayedDispute.seller_response_due_date ?? null;
  const backStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, color: concept.ink, textDecoration: 'none',
    fontSize: 16, background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer',
  };
  const backIcon = <ConceptIcon name="arrow-right" style={{ transform: 'scaleX(-1)' }} />;

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 720, minWidth: 0 }}>
      <style>{`
        .seller-mobile-action { display: none; }
        @media (max-width: 899px) { .seller-mobile-action { display: block; position: sticky; bottom: calc(64px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid ${concept.border}; padding: 12px 0; z-index: 9; } }
        .concept-disclosure > summary::-webkit-details-marker { display: none; }
      `}</style>
      <nav aria-label="Breadcrumb">
        {tab === 'overview' ? (
          <Link
            to={backTo}
            state={origin && typeof origin === 'object' && 'scrollY' in origin ? { restoreScrollY: origin.scrollY } : null}
            data-testid="breadcrumb-disputes-link"
            style={backStyle}
          >
            {backIcon} Disputes
          </Link>
        ) : (
          <button type="button" onClick={() => setTab('overview')} style={backStyle}>{backIcon} {orderLabel}</button>
        )}
      </nav>

      <header style={{ display: 'grid', gap: 8 }}>
        {tab === 'overview' ? <>
          <h1 style={{ margin: 0, color: concept.ink, ...conceptType.caseTitle }}>{plainReason}</h1>
          <div style={{ fontSize: 16, color: concept.muted }}>{orderLabel}</div>
          <div style={{ fontSize: 34, fontWeight: 750, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            <Money money={displayedDispute.amount} testId="detail-header-amount" />
          </div>
          <time dateTime={dueAt ?? undefined} style={{ fontSize: 15, color: concept.muted }}>
            {dueAt ? `Due ${formatDeadlineFull(dueAt)}` : 'No deadline'}
          </time>
        </> : (
          <h1 style={{ margin: 0, color: concept.ink, ...conceptType.pageTitle }}>{tab === 'evidence' ? 'Evidence' : 'Activity'}</h1>
        )}
        {lastUpdated && (
          <div data-testid="detail-stale-indicator" style={{ fontSize: 12, color: concept.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: disputeQuery.isFetching ? '#F59E0B' : '#10B981' }} />
            {disputeQuery.isFetching ? 'Syncing...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </div>
        )}
      </header>

      <ConceptSegmented tabs idPrefix="case-tab" ariaLabel="Case sections" options={TAB_OPTIONS} value={tab} onChange={setTab} testId="case-tabs" />

      <div role="tabpanel" id={`case-tab-panel-${tab}`} aria-labelledby={`case-tab-${tab}`}>
        {tab === 'overview' && (
          <div id="case-overview">
            <CaseOverviewTab
              dispute={displayedDispute}
              buyerMessage={rawBuyerMessage}
              expanded={isMessageExpanded}
              onToggleExpanded={() => setIsMessageExpanded(value => !value)}
              onInspect={() => setTab('evidence')}
              onCopyLink={() => { void copyDisputeLink(); }}
              approvalSavedWithoutExecution={approvalSavedWithoutExecution}
              uncertainAction={uncertainAction}
              reviewLabel={reviewLabel}
              actionLabel={actionLabel}
              ruleId={ruleId}
              ruleExplanation={ruleExplanation}
              currentApprovalUrl={currentApprovalUrl}
              needsDeliveryReview={needsDeliveryReview}
              needsPolicyReview={needsPolicyReview}
              needsAnalysisReview={needsAnalysisReview}
              isAgentRunning={isAgentRunning}
            />
          </div>
        )}
        {tab === 'evidence' && (
          <div id="case-evidence">
            <CaseEvidenceTab
              snapshots={evidenceQuery.data}
              loading={evidenceQuery.isPending}
              failed={evidenceQuery.isError}
              strength={evidenceStrength}
              rawEvidence={rawEvidence}
              refreshing={refreshingEvidence}
              refreshMessage={evidenceRefreshMessage}
              onRefresh={() => { void refreshEvidence(); }}
            />
          </div>
        )}
        {tab === 'activity' && (
          <section id="case-activity" data-testid="decision-timeline-card" style={{ display: 'grid', gap: 20 }}>
            {timelineQuery.isPending && (
              <div role="status" aria-label="Loading timeline" style={{ display: 'grid', gap: spacing[1] }}>
                <Skeleton height="20px" width="40%" />
                <Skeleton height="20px" width="60%" />
              </div>
            )}
            {timelineQuery.isError && (
              <ErrorState
                testId="timeline-error"
                message={timelineQuery.error.message}
                correlationId={timelineQuery.error.correlationId}
                onRetry={() => void timelineQuery.refetch()}
              />
            )}
            {timelineQuery.isSuccess && <>
              <DecisionTimeline events={timelineQuery.data.items ?? []} reverse={true} />
              <ExecutionAttempts events={timelineQuery.data.items ?? []} />
            </>}
          </section>
        )}
      </div>

      {currentApprovalUrl && (
        <div className="seller-mobile-action">
          <a href={currentApprovalUrl} style={{ display: 'block', minHeight: 48, padding: 14, textAlign: 'center', borderRadius: 10, background: concept.primary, color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Review reply</a>
        </div>
      )}
    </div>
  );
};
