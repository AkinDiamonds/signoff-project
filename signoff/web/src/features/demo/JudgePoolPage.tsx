import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Skeleton,
  colors,
  formatDisputeReason,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import { ApiQueryError } from '../../app/queries';
import {
  claimJudgeDispute,
  clearDemoSession,
  useJudgePool,
  type PooledDispute,
} from './api';

export const JudgePoolPage: React.FC = () => {
  const navigate = useNavigate();
  const poolQuery = useJudgePool();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<{ id: string; message: string; is409: boolean } | null>(null);
  const [startOverNotice, setStartOverNotice] = useState<string | null>(null);

  const handleStartOver = () => {
    clearDemoSession();
    setClaimError(null);
    setStartOverNotice('Judge demo session cleared. Ready to evaluate fresh disputes.');
    void poolQuery.refetch();
  };

  const handleClaim = async (disputeId: string) => {
    setClaimingId(disputeId);
    setClaimError(null);
    setStartOverNotice(null);
    try {
      await claimJudgeDispute(disputeId);
      void navigate(`/app/disputes/${disputeId}`);
    } catch (err) {
      if (err instanceof ApiQueryError && err.status === 409) {
        setClaimError({
          id: disputeId,
          message: 'This dispute was just claimed by another reviewer. You can pick another dispute or view the finished run below.',
          is409: true,
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to claim dispute';
        setClaimError({ id: disputeId, message: msg, is409: false });
      }
    } finally {
      setClaimingId(null);
    }
  };

  if (poolQuery.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        <Skeleton height="32px" width="240px" />
        <Skeleton height="120px" />
        <Skeleton height="120px" />
      </div>
    );
  }

  if (poolQuery.isError) {
    return (
      <ErrorState
        testId="pool-error"
        message={poolQuery.error?.message ?? 'Failed to load demo dispute pool.'}
        onRetry={() => void poolQuery.refetch()}
      />
    );
  }

  const allItems: PooledDispute[] = poolQuery.data ?? [];
  const pooledDisputes = allItems.filter((item) => item.state === 'pooled');
  const finishedDisputes = allItems.filter((item) => item.state === 'done');

  return (
    <div
      data-testid="judge-pool-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[3],
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing[2] }}>
        <PageHeader
          title="Demo disputes"
          description="Choose a live scenario to watch the dispute agent evaluate and defend."
        />
        <Button
          variant="secondary"
          onClick={handleStartOver}
          testId="pool-start-over-button"
        >
          Start over
        </Button>
      </div>

      {startOverNotice && (
        <div
          data-testid="pool-start-over-notice"
          style={{
            padding: `${spacing[1]} ${spacing[2]}`,
            backgroundColor: colors.badgeSuccessBg,
            border: `1px solid ${colors.badgeSuccessBorder}`,
            borderRadius: radius.card,
            fontSize: typography.fontSizeSmall,
            color: colors.badgeSuccessText,
          }}
        >
          {startOverNotice}
        </div>
      )}

      {claimError && (
        <div
          data-testid="pool-claim-error"
          style={{
            padding: `${spacing[1]} ${spacing[2]}`,
            backgroundColor: claimError.is409 ? colors.badgeAttentionBg : colors.badgeCriticalBg,
            border: `1px solid ${claimError.is409 ? colors.badgeAttentionBorder : colors.badgeCriticalBorder}`,
            borderRadius: radius.card,
            fontSize: typography.fontSizeSmall,
            color: claimError.is409 ? colors.badgeAttentionText : colors.badgeCriticalText,
          }}
        >
          <strong>{claimError.is409 ? 'Already Claimed' : 'Claim Error'}:</strong> {claimError.message}
        </div>
      )}

      {/* Available Pooled Section: 2-column card grid */}
      <section aria-labelledby="available-disputes-heading" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <h2 id="available-disputes-heading" style={{ fontSize: typography.fontSizeBody, fontWeight: typography.fontWeightSemibold, color: colors.ink, margin: 0 }}>
          Available for Evaluation ({pooledDisputes.length})
        </h2>

        {pooledDisputes.length === 0 ? (
          <EmptyState
            testId="pool-empty-state"
            title="No demo disputes right now"
            description="No live demo disputes right now — three finished runs are available below."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: spacing[2],
            }}
          >
            {pooledDisputes.map((item) => {
              const isClaiming = claimingId === item.dispute_id;
              const plainReason = formatDisputeReason(item.reason);
              return (
                <div
                  key={item.dispute_id}
                  data-testid={`pool-dispute-card-${item.dispute_id}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.card,
                    border: `1px solid ${colors.border}`,
                    padding: spacing[3],
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: spacing[2],
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[1] }}>
                      <strong style={{ fontSize: typography.fontSizeBody, color: colors.ink }}>
                        {item.scenario_label || `${plainReason} dispute`}
                      </strong>
                      <Money money={item.amount} testId={`pool-dispute-amount-${item.dispute_id}`} />
                    </div>

                    <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
                      {plainReason}
                    </div>

                    {item.seller_response_due_date && (
                      <div style={{ fontSize: typography.fontSizeSmall, color: colors.badgeAttentionText }}>
                        Due: {new Date(item.seller_response_due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => void handleClaim(item.dispute_id)}
                      disabled={claimingId !== null || isClaiming}
                      data-testid={`claim-dispute-btn-${item.dispute_id}`}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: colors.primaryAction,
                        color: '#FFFFFF',
                        borderRadius: radius.control,
                        border: 'none',
                        fontSize: typography.fontSizeBody,
                        fontWeight: typography.fontWeightMedium,
                        cursor: claimingId !== null || isClaiming ? 'not-allowed' : 'pointer',
                        opacity: claimingId !== null || isClaiming ? 0.6 : 1,
                      }}
                    >
                      {isClaiming ? 'Claiming...' : 'Open this dispute'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Finished Runs Section: 2-column card grid */}
      <section aria-labelledby="finished-runs-heading" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], marginTop: spacing[2] }}>
        <h2 id="finished-runs-heading" style={{ fontSize: typography.fontSizeBody, fontWeight: typography.fontWeightSemibold, color: colors.ink, margin: 0 }}>
          Finished runs ({finishedDisputes.length})
        </h2>

        {finishedDisputes.length === 0 ? (
          <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted, fontStyle: 'italic', padding: '12px 0' }}>
            No finished evaluation runs recorded yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: spacing[2],
            }}
          >
            {finishedDisputes.map((item) => (
              <div
                key={item.dispute_id}
                data-testid={`finished-run-card-${item.dispute_id}`}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.card,
                  border: `1px solid ${colors.border}`,
                  padding: spacing[3],
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: spacing[2],
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[1] }}>
                    <strong style={{ fontSize: typography.fontSizeBody, color: colors.ink }}>
                      {item.scenario_label || item.dispute_id}
                    </strong>
                    <Money money={item.amount} testId={`finished-amount-${item.dispute_id}`} />
                  </div>
                  <div style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
                    {formatDisputeReason(item.reason)} &bull; State: {item.state}
                  </div>
                  {(item.latest_verdict || item.latest_rule_id) && (
                    <div
                      data-testid={`finished-verdict-${item.dispute_id}`}
                      style={{ fontSize: typography.fontSizeSmall, color: colors.ink }}
                    >
                      {item.latest_verdict && <span>Verdict: {item.latest_verdict}</span>}
                      {item.latest_verdict && item.latest_rule_id && <span> &bull; </span>}
                      {item.latest_rule_id && <span>Rule: {item.latest_rule_id}</span>}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => void navigate(`/app/disputes/${item.dispute_id}`)}
                    data-testid={`view-replay-btn-${item.dispute_id}`}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: colors.surface,
                      color: colors.ink,
                      borderRadius: radius.control,
                      border: `1px solid ${colors.borderStrong}`,
                      fontSize: typography.fontSizeBody,
                      cursor: 'pointer',
                    }}
                  >
                    View run detail &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
