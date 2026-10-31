import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
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
} from '@signoff/ui';
import { useDispute, useDisputeTimeline } from '../../app/queries';
import { DecisionTimeline } from './timeline';
import type { DisputeDetail } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const DisputeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const disputeId = id ?? '';

  const disputeQuery = useDispute(disputeId, { refetchInterval: 5000 });
  const timelineQuery = useDisputeTimeline(disputeId, { refetchInterval: 5000 });

  const [displayedDispute, setDisplayedDispute] = useState<DisputeDetail | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const latestTimestampRef = useRef<number>(0);

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

  const shouldTruncateMessage = rawBuyerMessage && rawBuyerMessage.length > 200;
  const messageToDisplay =
    shouldTruncateMessage && !isMessageExpanded
      ? `${rawBuyerMessage.slice(0, 200)}...`
      : rawBuyerMessage;

  const ruleId = displayedDispute.latest_rule_id ?? 'G3-01';
  const ruleExplanation = getRuleExplanation(ruleId);
  const plainReason = formatDisputeReason(displayedDispute.reason);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4], maxWidth: '1300px' }}>
      {/* Navigation Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Link
          to="/app/disputes"
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
          &larr; Back to all disputes
        </Link>
      </nav>

      {/* Record Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing[2] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <h1
              data-testid="dispute-detail-id"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                margin: 0,
                color: '#111827',
                fontFamily: 'monospace',
                letterSpacing: '-0.02em',
              }}
            >
              {displayedDispute.id}
            </h1>
            <StatusBadge
              status={displayedDispute.latest_verdict ?? displayedDispute.status}
              testId="detail-status-badge"
            />
          </div>
          <div style={{ fontSize: '14px', color: '#6B7280' }}>
            <span>{plainReason}</span> &bull;{' '}
            <strong style={{ color: '#111827' }}>
              <Money money={displayedDispute.amount} testId="detail-header-amount" />
            </strong>
          </div>
        </div>

        {lastUpdated && (
          <div
            data-testid="detail-stale-indicator"
            style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}
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

      {/* Agent Active Banner (Only if actively evaluating) */}
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
              Correlating carrier delivery logs and checking merchant signing limits.
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: spacing[3],
          alignItems: 'start',
        }}
      >
        {/* Left Column: Customer Message, Evidence, Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], minWidth: 0, flex: '2 1 500px' }}>
          {/* Customer Claim & Message */}
          <section
            data-testid="dispute-buyer-message-panel"
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
                Customer Submission
              </h2>
              <span
                data-testid="untrusted-text-label"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6B7280',
                  backgroundColor: '#F3F4F6',
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
                    color: '#1F2937',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backgroundColor: '#F9FAFB',
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
              <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                No textual statement submitted with this PayPal dispute.
              </p>
            )}
          </section>

          {/* Evidence Gathering Section */}
          <section
            data-testid="dispute-evidence-panel"
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
                Evidence & Carrier Proof
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>Confidence:</span>
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
                  {evidenceStrength ?? 'HIGH'}
                </span>
              </div>
            </div>

            {rawEvidence ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    Carrier Tracking Proof
                  </span>
                  <span style={{ color: '#6B7280' }}>
                    {rawEvidence.delivered_at ? new Date(String(rawEvidence.delivered_at)).toLocaleDateString() : 'Delivered'}
                  </span>
                </div>
                <div style={{ color: '#4B5563', lineHeight: 1.5 }}>
                  Proof of package delivery matching buyer destination postal code (carrier: {String(rawEvidence.carrier ?? 'Demo carrier')}, status: {String(rawEvidence.status ?? 'Delivered')}).
                </div>
              </div>
            ) : (
              <div style={{ color: '#6B7280', fontSize: '13px' }}>
                No external evidence package has been correlated for this dispute yet.
              </div>
            )}
          </section>

          {/* Audit Trail Timeline */}
          <section
            data-testid="decision-timeline-card"
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
                Audit Trail & History
              </h2>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Immutable Ledger</span>
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

        {/* Right Column: Decision & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], minWidth: 0, flex: '1 1 320px' }}>
          {/* Decision & Gate Evaluation */}
          <section
            data-testid="dispute-decision-card"
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
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#111827' }}>
              Resolution & Gate Evaluation
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>Gate Verdict:</span>
              <StatusBadge status={displayedDispute.latest_verdict ?? 'NEEDS_APPROVAL'} testId="detail-verdict-chip" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>Matching Policy Rule:</span>
              <span
                title={ruleExplanation}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#F3F4F6',
                  padding: '2px 8px',
                  borderRadius: radius.control,
                  color: '#111827',
                }}
              >
                {ruleId}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.5, padding: '4px 0' }}>
              {ruleExplanation}.
            </div>

            {/* Approval Action Button */}
            {(displayedDispute.latest_verdict === 'NEEDS_APPROVAL' || displayedDispute.approval_url) && (
              <div style={{ marginTop: spacing[1] }}>
                <a
                  href={displayedDispute.approval_url ?? `/approve/mock-${displayedDispute.id.toLowerCase()}`}
                  data-testid="open-approval-card-button"
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    backgroundColor: '#0F766E',
                    color: '#FFFFFF',
                    padding: '10px 16px',
                    borderRadius: radius.control,
                    fontWeight: 600,
                    fontSize: '14px',
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  Review & Approve Defense &rarr;
                </a>
              </div>
            )}
          </section>

          {/* Dispute Context & PayPal Details */}
          <section
            data-testid="dispute-summary-card"
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
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#111827' }}>
              Transaction & PayPal Details
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
                <dt style={{ color: '#6B7280', fontWeight: 500 }}>Disputed Amount</dt>
                <dd style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '15px', color: '#111827' }}>
                  <Money money={displayedDispute.amount} testId="detail-amount" />
                </dd>
              </div>

              <div>
                <dt style={{ color: '#6B7280', fontWeight: 500 }}>Store Order Reference</dt>
                <dd style={{ margin: '2px 0 0', color: '#111827', fontWeight: 600 }}>
                  {displayedDispute.order_code ?? '—'}
                </dd>
              </div>

              <div>
                <dt style={{ color: '#6B7280', fontWeight: 500 }}>PayPal Response Due Date</dt>
                <dd style={{ margin: '2px 0 0' }}>
                  <Deadline dueAt={displayedDispute.seller_response_due_date ?? null} />
                </dd>
              </div>

              <div>
                <dt style={{ color: '#6B7280', fontWeight: 500 }}>PayPal Dispute ID</dt>
                <dd style={{ margin: '2px 0 0', fontFamily: 'monospace', color: '#4B5563' }}>
                  {displayedDispute.id}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
};
