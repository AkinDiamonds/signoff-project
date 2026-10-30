import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Money,
  Skeleton,
  colors,
  spacing,
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
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        <Skeleton height="32px" width="240px" />
        <Skeleton height="120px" />
        <Skeleton height="120px" />
      </div>
    );
  }

  if (poolQuery.isError) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <ErrorState
          testId="pool-error"
          message={poolQuery.error?.message ?? 'Failed to load demo dispute pool.'}
          onRetry={() => void poolQuery.refetch()}
        />
      </div>
    );
  }

  const allItems: PooledDispute[] = poolQuery.data ?? [];
  const pooledDisputes = allItems.filter((item) => item.state === 'pooled');
  const finishedDisputes = allItems.filter((item) => item.state === 'done');

  return (
    <div
      data-testid="judge-pool-page"
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[3],
        padding: `0 ${spacing[1]}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: colors.ink }}>Demo disputes</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.inkMuted }}>
            Choose a live scenario to watch the dispute agent evaluate and defend.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
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
            padding: '10px 14px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#166534',
          }}
        >
          {startOverNotice}
        </div>
      )}

      {claimError && (
        <div
          data-testid="pool-claim-error"
          style={{
            padding: '12px 14px',
            backgroundColor: claimError.is409 ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${claimError.is409 ? '#fde68a' : '#fecaca'}`,
            borderRadius: '6px',
            fontSize: '13px',
            color: claimError.is409 ? '#92400e' : '#b91c1c',
          }}
        >
          <strong>{claimError.is409 ? 'Already Claimed' : 'Claim Error'}:</strong> {claimError.message}
        </div>
      )}

      {/* Available Pooled Section */}
      <section aria-labelledby="available-disputes-heading">
        <h2 id="available-disputes-heading" style={{ fontSize: '16px', fontWeight: 600, color: colors.ink, marginBottom: spacing[1] }}>
          Available for Evaluation ({pooledDisputes.length})
        </h2>

        {pooledDisputes.length === 0 ? (
          <EmptyState
            testId="pool-empty-state"
            title="No demo disputes right now"
            message="No live demo disputes right now — three finished runs are available below."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            {pooledDisputes.map((item) => {
              const isClaiming = claimingId === item.dispute_id;
              return (
                <Card key={item.dispute_id} testId={`pool-dispute-card-${item.dispute_id}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: colors.ink }}>
                        {item.scenario_label || `${item.reason.replace(/_/g, ' ')} dispute`}
                      </strong>
                      <Money money={item.amount} testId={`pool-dispute-amount-${item.dispute_id}`} />
                    </div>

                    <div style={{ fontSize: '13px', color: colors.inkMuted }}>
                      Reason: {item.reason.replace(/_/g, ' ')}
                    </div>

                    {item.seller_response_due_date && (
                      <div style={{ fontSize: '12px', color: '#b45309' }}>
                        Due: {new Date(item.seller_response_due_date).toLocaleDateString()}
                      </div>
                    )}

                    <div style={{ marginTop: '8px' }}>
                      <Button
                        variant="primary"
                        onClick={() => void handleClaim(item.dispute_id)}
                        disabled={claimingId !== null}
                        loading={isClaiming}
                        testId={`claim-dispute-btn-${item.dispute_id}`}
                      >
                        {isClaiming ? 'Claiming...' : 'Open this dispute'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Part G: Finished Runs (Replay) */}
      <section aria-labelledby="finished-runs-heading" style={{ marginTop: spacing[2] }}>
        <h2 id="finished-runs-heading" style={{ fontSize: '16px', fontWeight: 600, color: colors.ink, marginBottom: spacing[1] }}>
          Finished runs ({finishedDisputes.length})
        </h2>

        {finishedDisputes.length === 0 ? (
          <div style={{ fontSize: '13px', color: colors.inkMuted, fontStyle: 'italic', padding: '12px 0' }}>
            No finished evaluation runs recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
            {finishedDisputes.map((item) => (
              <Card key={item.dispute_id} testId={`finished-run-card-${item.dispute_id}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <strong style={{ fontSize: '14px', color: colors.ink }}>
                      {item.scenario_label || item.dispute_id}
                    </strong>
                    <Money money={item.amount} testId={`finished-amount-${item.dispute_id}`} />
                  </div>
                  <div style={{ fontSize: '12px', color: colors.inkMuted }}>
                    {item.reason.replace(/_/g, ' ')} &bull; State: {item.state}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void navigate(`/app/disputes/${item.dispute_id}`)}
                      testId={`view-replay-btn-${item.dispute_id}`}
                    >
                      View run detail &rarr;
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

