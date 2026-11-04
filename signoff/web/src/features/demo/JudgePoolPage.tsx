import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ConceptButton,
  ConceptEmptyState,
  ConceptPageTitle,
  ConceptSectionHeading,
  ErrorState,
  Money,
  Skeleton,
  colors,
  concept,
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
      <ConceptPageTitle title="Demo disputes" subtitle="Choose a case to evaluate." />

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
        <ConceptSectionHeading id="available-disputes-heading">
          Available ({pooledDisputes.length})
        </ConceptSectionHeading>

        {pooledDisputes.length === 0 ? (
          <ConceptEmptyState
            testId="pool-empty-state"
            icon="folder"
            title="No demo disputes available"
            body="Choose a scenario to create a sandbox case."
            action={<ConceptButton as={Link} to="/app/demo" fullWidth>Browse scenarios</ConceptButton>}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
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
                    <ConceptButton
                      onClick={() => void handleClaim(item.dispute_id)}
                      disabled={claimingId !== null || isClaiming}
                      testId={`claim-dispute-btn-${item.dispute_id}`}
                      fullWidth
                    >
                      {isClaiming ? 'Claiming...' : 'Open this dispute'}
                    </ConceptButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Finished Runs Section: 2-column card grid */}
      <section aria-labelledby="finished-runs-heading" style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], marginTop: spacing[2] }}>
        <ConceptSectionHeading id="finished-runs-heading">
          Finished runs ({finishedDisputes.length})
        </ConceptSectionHeading>

        {finishedDisputes.length === 0 ? (
          <div style={{ background: concept.subtle, borderRadius: 10, padding: 16, textAlign: 'center', color: concept.muted }}>
            No finished runs yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
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

      <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
        <ConceptButton variant="text" onClick={handleStartOver} testId="pool-start-over-button" style={{ fontWeight: 750 }}>
          Start over
        </ConceptButton>
        <span style={{ fontSize: 13, color: concept.muted }}>Session only · ledger preserved</span>
      </div>
    </div>
  );
};
