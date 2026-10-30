import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Card,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  VerdictChip,
} from '@signoff/ui';
import { useDispute, useDisputeTimeline } from '../../app/queries';
import { DisputeStatusBadge } from './DisputeListPage';
import { DecisionTimeline } from './timeline';
import type { DisputeDetail } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const disputeId = id ?? '';

  // Poll every 5s
  const disputeQuery = useDispute(disputeId, { refetchInterval: 5000 });
  const timelineQuery = useDisputeTimeline(disputeId, { refetchInterval: 5000 });

  // Stale and timestamp tracking: ignore responses older than the one shown
  const [displayedDispute, setDisplayedDispute] = useState<DisputeDetail | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const latestTimestampRef = useRef<number>(0);

  // Message collapsing
  const [isMessageExpanded, setIsMessageExpanded] = useState<boolean>(false);

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

  // Loading state
  if (disputeQuery.isPending && !displayedDispute) {
    return (
      <Card testId="dispute-detail-loading">
        <div role="status" aria-label="Loading dispute details" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton height="36px" width="40%" />
          <Skeleton height="120px" />
          <Skeleton height="200px" />
        </div>
      </Card>
    );
  }

  // Error handling: 404 Not Found vs other errors
  if (disputeQuery.isError) {
    const error = disputeQuery.error;
    // Check if error is 404 / NOT_FOUND
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
                backgroundColor: '#0f766e',
                color: '#ffffff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
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

  // Extract snapshot details
  const snapshot = displayedDispute.snapshot ?? {};
  const rawBuyerMessage =
    (typeof snapshot.buyer_message === 'string' && snapshot.buyer_message) ||
    (Array.isArray(snapshot.messages) &&
      snapshot.messages[0] &&
      typeof snapshot.messages[0].content === 'string' &&
      snapshot.messages[0].content) ||
    null;

  const rawEvidence = isRecord(snapshot.evidence) ? snapshot.evidence : null;

  // Determine evidence strength: check evidence object or timeline events
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

  // Show agent-in-progress banner when:
  // - No verdict yet (still analyzing), OR
  // - Verdict is NEEDS_APPROVAL (waiting for human review = still in-progress)
  const hasGateDecided = Boolean(
    timelineQuery.data?.items?.some(
      (ev) => 'kind' in ev && (ev.kind === 'GATE_DECIDED' || ev.kind === 'EXECUTION_CONFIRMED')
    )
  );
  const isAgentRunning =
    displayedDispute.status === 'WAITING_FOR_SELLER_RESPONSE' &&
    (!displayedDispute.latest_verdict ||
      displayedDispute.latest_verdict === 'NEEDS_APPROVAL' ||
      !hasGateDecided);

  const shouldTruncateMessage = rawBuyerMessage && rawBuyerMessage.length > 180;
  const messageToDisplay =
    shouldTruncateMessage && !isMessageExpanded
      ? `${rawBuyerMessage.slice(0, 180)}...`
      : rawBuyerMessage;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation & Header */}
      <nav aria-label="Breadcrumb">
        <Link
          to="/app/disputes"
          data-testid="breadcrumb-disputes-link"
          style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}
        >
          &larr; Back to dispute list
        </Link>
      </nav>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1
              data-testid="dispute-detail-id"
              style={{ fontSize: '24px', margin: 0, color: '#0f172a' }}
            >
              Dispute {displayedDispute.id}
            </h1>
            <DisputeStatusBadge status={displayedDispute.status} testId="detail-status-badge" />
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Reason: {displayedDispute.reason.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Polling indicator */}
        {lastUpdated && (
          <div
            data-testid="detail-stale-indicator"
            style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: disputeQuery.isFetching ? '#f59e0b' : '#10b981',
              }}
            />
            {disputeQuery.isFetching ? 'Checking updates...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </div>
        )}
      </div>

      {/* Agent running banner */}
      {isAgentRunning && (
        <div
          data-testid="agent-in-progress-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#16a34a',
              boxShadow: '0 0 0 3px #86efac',
            }}
          />
          <div>
            <strong style={{ fontSize: '14px', color: '#166534' }}>
              Agent running
            </strong>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              The dispute agent is actively gathering evidence and preparing a resolution plan.
            </div>
          </div>
        </div>
      )}

      {/* Demo Approval Card Button */}
      {displayedDispute.approval_url && (
        <div
          data-testid="demo-approval-card-banner"
          style={{
            padding: '16px',
            backgroundColor: '#eff6ff',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong style={{ fontSize: '15px', color: '#1e40af', display: 'block' }}>
              Action Requires Approval
            </strong>
            <span style={{ fontSize: '13px', color: '#1d4ed8' }}>
              {displayedDispute.latest_rule_id ? `Rule: ${displayedDispute.latest_rule_id} — ` : ''}
              Signing limit reached or high-risk exception flagged.
            </span>
          </div>
          <a
            href={displayedDispute.approval_url}
            data-testid="open-approval-card-button"
            style={{
              display: 'inline-block',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            }}
          >
            Open approval card &rarr;
          </a>
        </div>
      )}

      {/* Overview Card */}
      <Card title="Summary" testId="dispute-summary-card">
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            margin: 0,
          }}
        >
          <div>
            <dt style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Amount</dt>
            <dd style={{ margin: '4px 0 0 0' }}>
              <Money money={displayedDispute.amount} testId="detail-amount" />
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Linked Order</dt>
            <dd style={{ margin: '4px 0 0 0', fontWeight: 600, color: '#0f172a' }}>
              {displayedDispute.order_code ?? '—'}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Seller Response Due</dt>
            <dd style={{ margin: '4px 0 0 0' }}>
              <Deadline dueAt={displayedDispute.seller_response_due_date ?? null} />
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Latest Verdict</dt>
            <dd style={{ margin: '4px 0 0 0' }}>
              {displayedDispute.latest_verdict ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <VerdictChip
                    verdict={displayedDispute.latest_verdict}
                    testId="detail-verdict-chip"
                  />
                  {displayedDispute.latest_rule_id && (
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                      {displayedDispute.latest_rule_id}
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Pending evaluation</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Evidence & Untrusted Buyer Message Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Evidence Panel */}
        <Card title="Evidence" testId="dispute-evidence-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                Evidence strength:
              </span>
              <span
                data-testid="evidence-strength-badge"
                style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {evidenceStrength ?? 'Not evaluated'}
              </span>
            </div>

            {rawEvidence ? (
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 12px', fontSize: '13px' }}>
                {rawEvidence.carrier ? (
                  <>
                    <dt style={{ color: '#64748b' }}>Carrier</dt>
                    <dd style={{ margin: 0, fontWeight: 500 }}>{String(rawEvidence.carrier)}</dd>
                  </>
                ) : null}
                {rawEvidence.tracking_number ? (
                  <>
                    <dt style={{ color: '#64748b' }}>Tracking #</dt>
                    <dd style={{ margin: 0, fontFamily: 'monospace' }}>{String(rawEvidence.tracking_number)}</dd>
                  </>
                ) : null}
                {rawEvidence.status ? (
                  <>
                    <dt style={{ color: '#64748b' }}>Tracking Status</dt>
                    <dd style={{ margin: 0, fontWeight: 500 }}>{String(rawEvidence.status)}</dd>
                  </>
                ) : null}
                {rawEvidence.delivered_at ? (
                  <>
                    <dt style={{ color: '#64748b' }}>Delivered At</dt>
                    <dd style={{ margin: 0 }}>{new Date(String(rawEvidence.delivered_at)).toLocaleString()}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Store evidence (order history, fulfillment, tracking) is attached to the dispute dossier.
              </p>
            )}
          </div>
        </Card>

        {/* Buyer Message Panel (labeled as untrusted text, plain text rendering) */}
        <Card title="Buyer message" testId="dispute-buyer-message-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              data-testid="untrusted-text-label"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#b45309',
                backgroundColor: '#fef3c7',
                padding: '2px 6px',
                borderRadius: '4px',
                alignSelf: 'flex-start',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Untrusted text
            </span>

            {rawBuyerMessage ? (
              <div>
                {/* Script or markup in message displays safely as plain text */}
                <div
                  data-testid="buyer-message-content"
                  style={{
                    fontSize: '14px',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
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
                      color: '#0284c7',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '4px 0',
                      marginTop: '4px',
                      fontWeight: 500,
                    }}
                  >
                    {isMessageExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                No buyer message included with this dispute.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Decision Timeline */}
      <Card title="Decision Timeline" testId="decision-timeline-card">
        {timelineQuery.isPending && (
          <div role="status" aria-label="Loading timeline" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton height="24px" width="50%" />
            <Skeleton height="24px" width="70%" />
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
          <DecisionTimeline events={timelineQuery.data.items ?? []} />
        )}
      </Card>
    </div>
  );
};
