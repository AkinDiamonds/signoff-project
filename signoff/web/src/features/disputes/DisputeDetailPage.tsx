import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Card,
  Deadline,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
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
        <Skeleton height="36px" width="40%" />
        <Skeleton height="120px" />
        <Skeleton height="200px" />
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
                backgroundColor: colors.primaryAction,
                color: '#FFFFFF',
                borderRadius: radius.control,
                textDecoration: 'none',
                fontWeight: typography.fontWeightSemibold,
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

  const shouldTruncateMessage = rawBuyerMessage && rawBuyerMessage.length > 180;
  const messageToDisplay =
    shouldTruncateMessage && !isMessageExpanded
      ? `${rawBuyerMessage.slice(0, 180)}...`
      : rawBuyerMessage;

  const ruleId = displayedDispute.latest_rule_id ?? 'G3-01';
  const ruleExplanation = getRuleExplanation(ruleId);
  const plainReason = formatDisputeReason(displayedDispute.reason);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      {/* Breadcrumb navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          to="/app/disputes"
          data-testid="breadcrumb-disputes-link"
          style={{
            fontSize: typography.fontSizeSmall,
            color: colors.interactive,
            textDecoration: 'none',
            fontWeight: typography.fontWeightMedium,
          }}
        >
          &larr; All disputes
        </Link>
      </nav>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing[2] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <h1
              data-testid="dispute-detail-id"
              style={{
                fontSize: typography.fontSizePageTitle,
                fontWeight: typography.fontWeightSemibold,
                margin: 0,
                color: colors.ink,
                fontFamily: 'monospace',
              }}
            >
              {displayedDispute.id}
            </h1>
            <StatusBadge
              status={displayedDispute.latest_verdict ?? displayedDispute.status}
              testId="detail-status-badge"
            />
          </div>
          <div style={{ fontSize: typography.fontSizeBody, color: colors.inkMuted }}>
            {plainReason} &bull; <Money money={displayedDispute.amount} testId="detail-header-amount" />
          </div>
        </div>

        {lastUpdated && (
          <div
            data-testid="detail-stale-indicator"
            style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: disputeQuery.isFetching ? '#F59E0B' : '#10B981',
              }}
            />
            {disputeQuery.isFetching ? 'Updating...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </div>
        )}
      </div>

      {/* Agent in progress banner */}
      {isAgentRunning && (
        <div
          data-testid="agent-in-progress-banner"
          style={{
            padding: `${spacing[2]} ${spacing[3]}`,
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: radius.card,
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#16A34A',
            }}
          />
          <div>
            <strong style={{ fontSize: typography.fontSizeBody, color: '#166534' }}>
              Agent actively investigating
            </strong>
            <div style={{ fontSize: typography.fontSizeSmall, color: '#15803D' }}>
              Gathering evidence and checking your merchant signing rules.
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Shopify record layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: spacing[3],
          alignItems: 'start',
        }}
      >
        {/* Left column (about two thirds: timeline, evidence, buyer message) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], gridColumn: 'span 2' }}>
          {/* 1. What happened card: Audit timeline newest first */}
          <Card title="What happened" testId="decision-timeline-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <p style={{ margin: 0, fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
                Immutable audit trail of actions, checks, and gate evaluations.
              </p>
              {timelineQuery.isPending && (
                <div role="status" aria-label="Loading timeline" style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
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
                <DecisionTimeline events={timelineQuery.data.items ?? []} reverse={true} />
              )}
            </div>
          </Card>

          {/* 2. Evidence gathered card */}
          <Card title="Evidence gathered" testId="dispute-evidence-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightSemibold }}>
                  Evidence strength:
                </span>
                <span
                  data-testid="evidence-strength-badge"
                  style={{
                    fontSize: typography.fontSizeSmall,
                    padding: '2px 8px',
                    borderRadius: radius.pill,
                    backgroundColor: colors.badgeSuccessBg,
                    color: colors.badgeSuccessText,
                    fontWeight: typography.fontWeightSemibold,
                    textTransform: 'uppercase',
                  }}
                >
                  {evidenceStrength ?? 'High'}
                </span>
              </div>

              {rawEvidence ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], fontSize: typography.fontSizeBody }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
                    <span style={{ fontWeight: typography.fontWeightSemibold, color: colors.ink }}>
                      Demo carrier tracking
                    </span>
                    <span style={{ color: colors.inkMuted, fontSize: typography.fontSizeSmall }}>
                      {rawEvidence.delivered_at ? new Date(String(rawEvidence.delivered_at)).toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <div style={{ color: colors.inkMuted, fontSize: typography.fontSizeSmall }}>
                    Proves package delivery to buyer postal code (carrier: {String(rawEvidence.carrier ?? 'Demo carrier')}, status: {String(rawEvidence.status ?? 'Delivered')}).
                  </div>
                </div>
              ) : (
                <div style={{ color: colors.inkMuted, fontSize: typography.fontSizeBody }}>
                  No evidence has been gathered for this dispute yet.
                </div>
              )}
            </div>
          </Card>

          {/* 3. Buyer message card */}
          <Card title="Buyer message" testId="dispute-buyer-message-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                <span
                  data-testid="untrusted-text-label"
                  style={{
                    fontSize: '11px',
                    fontWeight: typography.fontWeightSemibold,
                    color: colors.badgeAttentionText,
                    backgroundColor: colors.badgeAttentionBg,
                    padding: '2px 8px',
                    borderRadius: radius.pill,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Untrusted external text
                </span>
                <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
                  Attributed to buyer via PayPal
                </span>
              </div>

              {rawBuyerMessage ? (
                <div>
                  <div
                    data-testid="buyer-message-content"
                    style={{
                      fontSize: typography.fontSizeBody,
                      color: colors.ink,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      backgroundColor: '#FAFAFA',
                      padding: spacing[2],
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
                        color: colors.interactive,
                        fontSize: typography.fontSizeSmall,
                        cursor: 'pointer',
                        padding: '4px 0',
                        marginTop: '4px',
                        fontWeight: typography.fontWeightMedium,
                      }}
                    >
                      {isMessageExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: typography.fontSizeBody, color: colors.inkMuted }}>
                  No buyer message included with this dispute.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right column (about one third: decision & details) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
          {/* Decision card */}
          <Card title="Decision" testId="dispute-decision-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>Gate verdict:</span>
                <StatusBadge status={displayedDispute.latest_verdict ?? 'NEEDS_APPROVAL'} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>Rule:</span>
                <span
                  title={ruleExplanation}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: typography.fontSizeSmall,
                    fontWeight: typography.fontWeightSemibold,
                    backgroundColor: '#F1F1F1',
                    padding: '2px 8px',
                    borderRadius: radius.control,
                    cursor: 'help',
                    color: colors.ink,
                  }}
                >
                  {ruleId}
                </span>
              </div>

              <div style={{ fontSize: typography.fontSizeSmall, color: colors.ink, padding: `${spacing[1]} 0` }}>
                {ruleExplanation}.
              </div>

              {/* If approval needed, full width primary button */}
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
                      backgroundColor: colors.primaryAction,
                      color: '#FFFFFF',
                      padding: '10px 16px',
                      borderRadius: radius.control,
                      fontWeight: typography.fontWeightSemibold,
                      fontSize: typography.fontSizeBody,
                      textDecoration: 'none',
                    }}
                  >
                    Open approval card &rarr;
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Details card */}
          <Card title="Details" testId="dispute-summary-card">
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: spacing[2],
                fontSize: typography.fontSizeBody,
              }}
            >
              <div>
                <dt style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
                  Amount
                </dt>
                <dd style={{ margin: '2px 0 0', fontWeight: typography.fontWeightSemibold }}>
                  <Money money={displayedDispute.amount} testId="detail-amount" />
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
                  Order
                </dt>
                <dd style={{ margin: '2px 0 0', color: colors.ink }}>
                  {displayedDispute.order_code ?? '—'}
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
                  Response due date
                </dt>
                <dd style={{ margin: '2px 0 0' }}>
                  <Deadline dueAt={displayedDispute.seller_response_due_date ?? null} />
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontWeight: typography.fontWeightMedium }}>
                  PayPal reference
                </dt>
                <dd style={{ margin: '2px 0 0', fontFamily: 'monospace', color: colors.inkMuted }}>
                  {displayedDispute.id}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
};
