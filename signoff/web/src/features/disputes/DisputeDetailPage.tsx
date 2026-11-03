import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import {
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  StatusBadge,
  colors,
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
import type { ApiTimelineEvent, DisputeDetail } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const origin: unknown = location.state;
  const backTo = origin && typeof origin === 'object' && 'from' in origin && typeof origin.from === 'string' && origin.from.startsWith('/app/disputes') ? origin.from : '/app/disputes';
  const disputeId = id ?? '';
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
                backgroundColor: '#0F766E',
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

  const shouldTruncateMessage = rawBuyerMessage && rawBuyerMessage.length > 200;
  const messageToDisplay =
    shouldTruncateMessage && !isMessageExpanded
      ? `${rawBuyerMessage.slice(0, 200)}...`
      : rawBuyerMessage;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4], maxWidth: '1300px', minWidth: 0 }}>
      <style>{`
        .seller-dispute-layout { display: block !important; }
        .seller-dispute-layout section { border: 0 !important; border-top: 1px solid #dce2df !important; border-radius: 0 !important; padding: 24px 0 !important; }
        .seller-dispute-layout h2 { font-size: 20px !important; font-weight: 700 !important; }
        .seller-dispute-id { overflow-wrap: anywhere; }
        .seller-mobile-action { display:none; }
        @media (max-width:899px) { .seller-mobile-action { display:block; position:sticky; bottom:calc(64px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid #dce2df; padding:12px 0; z-index:9; } }
        .seller-status-row { display: grid; grid-template-columns: minmax(90px, 120px) minmax(0, 1fr); gap: 12px; padding: 12px 0; border-bottom: 1px solid #dce2ef; }
        .seller-status-row:last-child { border-bottom: 0; }
        @media (max-width: 390px) { .seller-status-row { grid-template-columns: 1fr; gap: 2px; } }
      `}</style>
      <nav aria-label="Case sections" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}><a href="#case-overview">Overview</a><a href="#case-evidence">Evidence</a><a href="#case-activity">Activity</a></nav>
      <span id="case-overview" />
      {/* Navigation Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          to={backTo}
          state={origin && typeof origin === "object" && "scrollY" in origin ? { restoreScrollY: origin.scrollY } : null}
          data-testid="breadcrumb-disputes-link"
          style={{
            fontSize: '13px',
            color: '#0F766E',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Back to disputes
        </Link>
      </nav>
      <div style={{ fontSize: 14, color: "var(--signoff-muted, #686861)", overflowWrap: "anywhere" }}>Case {disputeId}</div>

      {/* Record Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing[2] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                margin: 0,
                color: 'var(--signoff-ink, #252521)',
                letterSpacing: '-0.02em',
              }}
            >
              {plainReason}
            </h1>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--signoff-muted, #686861)' }}>
            <strong style={{ color: 'var(--signoff-ink, #252521)' }}>
              <Money money={displayedDispute.amount} testId="detail-header-amount" />
            </strong>
          </div>
          <div style={{ color: 'var(--signoff-danger-text, #842f2c)', fontWeight: 600 }}><Deadline dueAt={displayedDispute.seller_response_due_date ?? null} /></div>
          <details><summary style={{ cursor: 'pointer', minHeight: 44 }}>Technical details</summary>
            <div className="seller-dispute-id" data-testid="dispute-detail-id">Dispute ID: {displayedDispute.id}</div>
            <button type="button" style={{ minHeight: 44 }} onClick={() => { void copyDisputeLink(); }}>Copy dispute link</button>
          </details>
        </div>

        {lastUpdated && (
          <div
            data-testid="detail-stale-indicator"
            style={{ fontSize: '12px', color: 'var(--signoff-muted, #686861)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: disputeQuery.isFetching ? '#F59E0B' : '#10B981',
              }}
            />
            {disputeQuery.isFetching ? 'Syncing...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </div>
        )}
      </div>

      <section aria-label="Current dispute status" data-testid="dispute-status-summary" style={{ background: 'var(--signoff-surface, #fff)', border: '1px solid #cbd5e1', borderRadius: 12, padding: '4px 16px', color: 'var(--signoff-ink, #252521)' }}>
        <div className="seller-status-row"><strong>PayPal</strong><span><StatusBadge status={displayedDispute.status} testId="detail-status-badge" /></span></div>
        <div className="seller-status-row"><strong>Signoff</strong><span>{reviewLabel}</span></div>
        <div className="seller-status-row"><strong>Action</strong><span>{actionLabel}</span></div>
      </section>
      {uncertainAction && <div role="alert" style={{ border: '2px solid #b45309', borderRadius: 12, background: '#fff7ed', padding: 16, color: '#78350f' }}>
        Signoff cannot yet tell whether PayPal received this action. Sending it again could duplicate the response. Check the PayPal case and this history before taking another step.
      </div>}
      {(approvalState === 'APPROVE' || approvalState === 'EDIT') && !executionState && <div role="status" style={{ border: '1px solid #cbd5e1', borderRadius: 12, background: 'var(--signoff-surface, #fff)', padding: 16 }}>
        Your approval was saved, but no execution was recorded for it. Check this dispute in PayPal before taking another step.
      </div>}

      {timelineQuery.isSuccess && <ExecutionAttempts events={timelineQuery.data.items ?? []} />}

      {currentApprovalUrl && <section style={{ background: '#eef2ff', borderRadius: 12, padding: 20, color: 'var(--signoff-ink, #252521)' }}>
        <h2 style={{ marginTop: 0 }}>Your decision is needed</h2>
        <p>Review the proposed response before anything is sent to PayPal.</p>
        <a href={currentApprovalUrl ?? undefined} data-testid="open-approval-card-button" style={{ display: 'block', background: 'var(--signoff-action-primary, #14532d)', color: '#fff', textAlign: 'center', padding: 14, minHeight: 44, borderRadius: 8, fontWeight: 700 }}>Review reply</a>
      </section>}

      {/* Agent Active Banner (Only if actively evaluating) */}
      {needsDeliveryReview && <div role="status" style={{ padding: 16, borderRadius: radius.card, background: '#fff7ed', color: '#7c2d12' }}>
        <strong>Delivery evidence needs your review</strong>
        <p style={{ marginBottom: 0 }}>Delivery proof is missing or unsafe. No automatic action was taken.</p>
      </div>}
      {needsPolicyReview && <div role="status" style={{ padding: 16, borderRadius: radius.card, background: '#fff7ed', color: '#7c2d12' }}>
        <strong>Signing limits need your review</strong>
        <p style={{ marginBottom: 0 }}>Your limits changed or are unavailable. No action was sent.</p>
      </div>}
      {needsAnalysisReview && <div role="status" style={{ padding: 16, borderRadius: radius.card, background: '#fff7ed', color: '#7c2d12' }}>
        <strong>Analysis needs your review</strong>
        <p style={{ marginBottom: 0 }}>The latest analysis could not produce a valid plan. No action was proposed by this run. Check the audit history for details.</p>
      </div>}
      {isAgentRunning && (
        <div
          data-testid="agent-in-progress-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: '#F0FDFA',
            border: '1px solid #99F6E4',
            borderRadius: radius.card,
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#0F766E',
            }}
          />
          <div>
            <strong style={{ fontSize: '13px', color: '#0F766E' }}>
              Agent actively analyzing PayPal dispute
            </strong>
            <div style={{ fontSize: '12px', color: '#115E59' }}>
              Gathering available order evidence and checking merchant signing limits.
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div
        className="seller-dispute-layout"
        style={{
          display: 'grid',
        }}
      >
        {/* Left Column: Customer Message, Evidence, Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], minWidth: 0, flex: '2 1 500px' }}>
          {/* Customer Claim & Message */}
          <section
            data-testid="dispute-buyer-message-panel"
            style={{
              backgroundColor: 'var(--signoff-surface, #fff)',
              borderRadius: radius.card,
              border: `1px solid ${colors.border}`,
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2],
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--signoff-ink, #252521)' }}>
                What happened
              </h2>
              <span
                data-testid="untrusted-text-label"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--signoff-muted, #686861)',
                  backgroundColor: 'var(--signoff-surface, #fff)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #E5E7EB',
                }}
              >
                Buyer Statement via PayPal
              </span>
            </div>

            {rawBuyerMessage ? (
              <div>
                <div
                  data-testid="buyer-message-content"
                  style={{
                    fontSize: '14px',
                    color: 'var(--signoff-ink, #252521)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backgroundColor: 'var(--signoff-surface, #fff)',
                    padding: '12px 16px',
                    borderRadius: radius.control,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {messageToDisplay}
                </div>
                {shouldTruncateMessage && (
                  <button
                    type="button"
                    data-testid="toggle-buyer-message-button"
                    onClick={() => setIsMessageExpanded(!isMessageExpanded)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0F766E',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '6px 0 0',
                      fontWeight: 600,
                    }}
                  >
                    {isMessageExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--signoff-muted, #686861)' }}>
                No textual statement submitted with this PayPal dispute.
              </p>
            )}
          </section>

          {/* Evidence Gathering Section */}
          <section
            id="case-evidence"
            data-testid="dispute-evidence-panel"
            style={{
              backgroundColor: 'var(--signoff-surface, #fff)',
              borderRadius: radius.card,
              border: `1px solid ${colors.border}`,
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2],
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--signoff-ink, #252521)' }}>
                What we found
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--signoff-muted, #686861)' }}>Historical evidence strength:</span>
                <span
                  data-testid="evidence-strength-badge"
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#ECFDF5',
                    color: '#065F46',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  {evidenceStrength ?? 'Unavailable'}
                </span>
              </div>
            </div>

            {evidenceQuery.isPending && <p role="status">Loading saved evidence…</p>}
            {evidenceQuery.isError && <p role="alert">Saved evidence could not be loaded. Try refreshing.</p>}
            <button type="button" style={{ minHeight: 44, background: colors.surface, color: colors.ink, border: `1px solid ${colors.borderStrong}`, borderRadius: 6, fontSize: 16 }} disabled={refreshingEvidence} onClick={() => { void refreshEvidence(); }}>
              {refreshingEvidence ? 'Refreshing evidence…' : 'Refresh evidence'}
            </button>
            <p>Uses the last synced dispute and current store records. It does not run the agent or contact PayPal.</p>
            {evidenceRefreshMessage && <p role="status">{evidenceRefreshMessage}</p>}
            {evidenceQuery.data?.length === 0 && <p>No saved evidence snapshot is available for this dispute.</p>}
            {evidenceQuery.data?.map(snapshot => <details key={snapshot.run_id} open={evidenceQuery.data?.[0] === snapshot}>
              <summary>{snapshot.capture_kind === 'pre_model_review' ? 'Review before model run' : snapshot.capture_kind === 'manual_refresh' ? 'Manual evidence refresh' : 'Model run'} · {snapshot.run_id} · {new Date(snapshot.captured_at).toLocaleString()}</summary>
              <p>Order: {snapshot.evidence.order_code ?? 'Unavailable'} · Payment: {snapshot.evidence.payment_reference ?? 'Unavailable'}</p>
              {snapshot.evidence.amount && <p>Order total: {snapshot.evidence.currency} {snapshot.evidence.amount}</p>}
              {snapshot.evidence.items.length > 0 && <p>Items: {snapshot.evidence.items.join(', ')}</p>}
              <p>Evidence strength: {snapshot.evidence.strength ?? 'Unavailable'}{snapshot.evidence.score != null ? ` (${snapshot.evidence.score}/100)` : ''}</p>
              <ul>{snapshot.evidence.components.map(component => <li key={component.name}>{component.name}: {component.points} — {component.detail}</li>)}</ul>
              <p>{snapshot.evidence.explanation}</p>
              <p>{snapshot.evidence.buildable ? `Submission preview: ${snapshot.evidence.evidence_type}` : 'No evidence submission prepared.'}</p>
              {snapshot.evidence.buildable && snapshot.evidence.tracking_submission_count === 0 && <p>Order notes only; no carrier tracking is included in the submission.</p>}
              {snapshot.evidence.notes && <p>{snapshot.evidence.notes}</p>}
              {snapshot.evidence.milestones.length > 0 && <><h3>Recorded tracking</h3><ul>
                {snapshot.evidence.milestones.map((event, index) => <li key={`${event.event_time}-${index}`}>
                  {event.status} · {new Date(event.event_time).toLocaleString()} · {event.source === 'simulated' ? 'simulated · not carrier-confirmed' : event.source} · {event.carrier} {event.tracking_number}
                  {event.source_id && <> · Record {event.source_id}</>}
                </li>)}
              </ul></>}
              <p>{snapshot.capture_kind === 'pre_model_review' ? 'Review stopped before a model plan was created.' : snapshot.capture_kind === 'manual_refresh' ? 'Evidence refreshed without running the agent or submitting to PayPal.' : 'Gathered for this run. Check the audit trail for submission and PayPal confirmation.'}</p>
            </details>)}
            {rawEvidence ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ fontWeight: 600, color: 'var(--signoff-ink, #252521)' }}>
                    Recorded tracking
                  </span>
                  <span style={{ color: 'var(--signoff-muted, #686861)' }}>
                    {rawEvidence.delivered_at ? new Date(String(rawEvidence.delivered_at)).toLocaleDateString() : 'Delivery date unavailable'}
                  </span>
                </div>
                <div style={{ color: 'var(--signoff-muted, #686861)', lineHeight: 1.5 }}>
                  Carrier: {String(rawEvidence.carrier ?? 'Unavailable')}; status: {String(rawEvidence.status ?? 'Unavailable')}. {rawEvidence.source === 'simulated' ? 'Simulated · not carrier-confirmed.' : 'Source not verified; carrier confirmation is unavailable.'}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--signoff-muted, #686861)', fontSize: '13px' }}>
                No external evidence package has been correlated for this dispute yet.
              </div>
            )}
          </section>


        </div>

        {/* Right Column: Decision & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], minWidth: 0, flex: '1 1 320px' }}>
          <section aria-label="What’s missing" style={{ borderTop: '1px solid #dce2df', padding: '24px 0' }}>
            <h2 style={{ fontSize: 20, margin: '0 0 12px' }}>What’s missing</h2>
            <p>{needsDeliveryReview ? 'Delivery evidence needs your review. Add available tracking in Shipments.' : 'Review the evidence above for any missing information.'}</p>
            {needsDeliveryReview && <Link to="/app/shipments" style={{ color: 'var(--signoff-action-primary)', fontWeight: 600 }}>Go to shipments</Link>}
          </section>
          {/* Decision & Gate Evaluation */}
          <section
            data-testid="dispute-decision-card"
            style={{
              backgroundColor: 'var(--signoff-surface, #fff)',
              borderRadius: radius.card,
              border: `1px solid ${colors.border}`,
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2],
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--signoff-ink, #252521)' }}>
              Your reply
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontSize: '13px', color: 'var(--signoff-muted, #686861)' }}>Review decision:</span>
              {displayedDispute.latest_verdict
                ? <StatusBadge status={displayedDispute.latest_verdict} testId="detail-verdict-chip" />
                : <span data-testid="detail-verdict-chip">Not recorded</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontSize: '13px', color: 'var(--signoff-muted, #686861)' }}>Signing rule:</span>
              <span
                title={ruleExplanation}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--signoff-surface, #fff)',
                  padding: '2px 8px',
                  borderRadius: radius.control,
                  color: 'var(--signoff-ink, #252521)',
                }}
              >
                {ruleId ?? 'Not recorded'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--signoff-muted, #686861)', lineHeight: 1.5, padding: '4px 0' }}>
              {ruleExplanation}.
            </div>

            {displayedDispute.latest_verdict === 'NEEDS_APPROVAL' && !displayedDispute.approval_url && (
              <p role="status">No current approval card is available. It may have expired, been resolved, or become stale.</p>
            )}
          </section>

          {/* Dispute Context & PayPal Details */}
          <section
            data-testid="dispute-summary-card"
            style={{
              backgroundColor: 'var(--signoff-surface, #fff)',
              borderRadius: radius.card,
              border: `1px solid ${colors.border}`,
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2],
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--signoff-ink, #252521)' }}>
              Case details
            </h2>

            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: spacing[2],
                fontSize: '13px',
              }}
            >
              <div>
                <dt style={{ color: 'var(--signoff-muted, #686861)', fontWeight: 500 }}>Disputed Amount</dt>
                <dd style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '15px', color: 'var(--signoff-ink, #252521)' }}>
                  <Money money={displayedDispute.amount} testId="detail-amount" />
                </dd>
              </div>

              <div>
                <dt style={{ color: 'var(--signoff-muted, #686861)', fontWeight: 500 }}>Store Order Reference</dt>
                <dd style={{ margin: '2px 0 0', color: 'var(--signoff-ink, #252521)', fontWeight: 600 }}>
                  {displayedDispute.order_code ?? 'Not available'}
                </dd>
              </div>

              <div>
                <dt style={{ color: 'var(--signoff-muted, #686861)', fontWeight: 500 }}>PayPal Response Due Date</dt>
                <dd style={{ margin: '2px 0 0' }}>
                  <Deadline dueAt={displayedDispute.seller_response_due_date ?? null} />
                </dd>
              </div>

              <div>
                <dt style={{ color: 'var(--signoff-muted, #686861)', fontWeight: 500 }}>PayPal Dispute ID</dt>
                <dd style={{ margin: '2px 0 0', fontFamily: 'monospace', color: 'var(--signoff-muted, #686861)' }}>
                  {displayedDispute.id}
                </dd>
              </div>
            </dl>
          </section>
          {/* Audit Trail Timeline */}
          <section
            id="case-activity"
            data-testid="decision-timeline-card"
            style={{
              backgroundColor: 'var(--signoff-surface, #fff)',
              borderRadius: radius.card,
              border: `1px solid ${colors.border}`,
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2],
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--signoff-ink, #252521)' }}>
                Updates
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--signoff-muted, #686861)' }}>History</span>
            </div>

            {timelineQuery.isPending && (
              <div role="status" aria-label="Loading timeline" style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
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

            {timelineQuery.isSuccess && (
              <DecisionTimeline events={timelineQuery.data.items ?? []} reverse={true} />
            )}
          </section>
        </div>
      </div>
      {currentApprovalUrl && <div className="seller-mobile-action"><a href={currentApprovalUrl ?? undefined} style={{ display: 'block', minHeight: 48, padding: 14, textAlign: 'center', borderRadius: 8, background: 'var(--signoff-action-primary, #14532d)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Review reply</a></div>}
    </div>
  );
};
