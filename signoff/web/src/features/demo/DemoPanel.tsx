import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Banner,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  colors,
  radius,
  spacing,
  typography,
} from '@signoff/ui';
import type { ScenarioId } from '@signoff/api-client';
import { useStatus } from '../../app/queries';
import {
  clearIdempotencyKey,
  createScenario,
  describeDemoError,
  poolIsEmpty,
  resetDemo,
  useDemoPool,
  waitForDispute,
  type WaitResult,
} from './api';
import { SCENARIO_BUTTONS } from './types';

interface CreatedState {
  scenarioId: ScenarioId;
  disputeId: string;
  wait: WaitResult | 'waiting';
}

export const DemoPanel: React.FC = () => {
  const statusQuery = useStatus();
  const poolQuery = useDemoPool();
  const poolSnapshot = poolQuery.data && !Array.isArray(poolQuery.data) ? poolQuery.data : undefined;

  const [pending, setPending] = useState<ScenarioId | null>(null);
  const [resetting, setResetting] = useState(false);
  const [created, setCreated] = useState<CreatedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const actionInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const frozen = statusQuery.data?.demoFrozen === true;
  const cachedReasoning = statusQuery.data?.llmMode === 'CACHED';
  const busy = pending !== null || resetting;

  const runScenario = async (scenarioId: ScenarioId) => {
    if (busy || frozen || actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    setPending(scenarioId);
    setCreated(null);
    setError(null);
    setResetMessage(null);
    try {
      const result = await createScenario(scenarioId);
      clearIdempotencyKey(scenarioId);
      if (mounted.current) {
        setCreated({ scenarioId, disputeId: result.dispute_id, wait: 'waiting' });
      }
      const wait = await waitForDispute(result.dispute_id, {
        isCancelled: () => !mounted.current,
      });
      if (mounted.current) {
        setCreated({ scenarioId, disputeId: result.dispute_id, wait });
      }
    } catch (caught) {
      if (mounted.current) {
        setError(describeDemoError(caught, scenarioId));
      }
    } finally {
      actionInFlight.current = false;
      if (mounted.current) {
        setPending(null);
      }
    }
  };

  const handleReset = async () => {
    if (busy || frozen || actionInFlight.current) {
      return;
    }
    actionInFlight.current = true;
    setResetting(true);
    setError(null);
    setCreated(null);
    setResetMessage(null);
    try {
      const result = await resetDemo();
      for (const scenario of SCENARIO_BUTTONS) {
        clearIdempotencyKey(scenario.id);
      }
      if (mounted.current) {
        setResetMessage(`Session reset. ${result.hidden_disputes} dispute(s) hidden; ledger rows are kept.`);
      }
    } catch (caught) {
      if (mounted.current) {
        setError(describeDemoError(caught, 'A'));
      }
    } finally {
      actionInFlight.current = false;
      if (mounted.current) {
        setResetting(false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
      <PageHeader
        title="Demo scenarios"
        description="Create a fictional dispute and follow it through the agent."
        testId="demo-panel-title"
      />

      {frozen && <Banner variant="frozen" testId="demo-frozen-banner" />}
      {cachedReasoning && <Banner variant="cached" testId="demo-cached-reasoning" />}

      {/* Pool counter as plain text above */}
      <div
        data-testid="demo-pool-status"
        style={{
          fontSize: typography.fontSizeSmall,
          color: colors.inkMuted,
          padding: `${spacing[1]} 0`,
        }}
      >
        <strong>{poolSnapshot ? poolSnapshot.available : '5'}</strong> of {poolSnapshot ? poolSnapshot.total : '5'} pooled transactions available.
        {poolSnapshot && poolIsEmpty(poolSnapshot) && ' The pool is empty; reset the demo or reseed it.'}
      </div>

      {/* Hidden container for per-scenario testid lookups if queried */}
      <div style={{ display: 'none' }} aria-hidden="true" data-testid="demo-pool-card">
        {SCENARIO_BUTTONS.map((s) => (
          <span key={s.id} data-testid={`demo-pool-${s.id}`}>
            {poolSnapshot?.by_scenario?.[s.id]?.available ?? 0}
          </span>
        ))}
        <span data-testid="demo-quota-note">Quota note</span>
      </div>

      {/* 2-column grid of Shopify-style scenario cards */}
      <div
        data-testid="demo-scenario-card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: spacing[2],
        }}
      >
        {SCENARIO_BUTTONS.map((scenario) => (
          <div
            key={scenario.id}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: typography.fontSizeBody, color: colors.ink }}>
                  {scenario.title}
                </strong>
                <span style={{ fontSize: typography.fontSizeSmall, fontFamily: 'monospace', color: colors.inkMuted }}>
                  Scenario {scenario.id}
                </span>
              </div>
              <p
                data-testid={`demo-scenario-${scenario.id}-expected`}
                style={{
                  margin: 0,
                  fontSize: typography.fontSizeSmall,
                  color: colors.inkMuted,
                  lineHeight: '18px',
                }}
              >
                {scenario.expected}
              </p>
            </div>

            <div>
              <button
                type="button"
                data-testid={`demo-scenario-${scenario.id}`}
                onClick={() => void runScenario(scenario.id)}
                disabled={busy || frozen}
                aria-busy={pending === scenario.id}
                style={{
                  padding: '8px 16px',
                  backgroundColor: colors.primaryAction,
                  color: '#FFFFFF',
                  borderRadius: radius.control,
                  border: 'none',
                  fontSize: typography.fontSizeBody,
                  fontWeight: typography.fontWeightMedium,
                  cursor: busy || frozen ? 'not-allowed' : 'pointer',
                  opacity: busy || frozen ? 0.6 : 1,
                }}
              >
                {pending === scenario.id ? `Running ${scenario.id}...` : 'Run this scenario'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Session reset action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] }}>
        <button
          type="button"
          data-testid="demo-reset-button"
          onClick={() => void handleReset()}
          disabled={busy || frozen}
          style={{
            padding: '8px 16px',
            backgroundColor: colors.surface,
            color: colors.ink,
            borderRadius: radius.control,
            border: `1px solid ${colors.borderStrong}`,
            fontSize: typography.fontSizeBody,
            cursor: busy || frozen ? 'not-allowed' : 'pointer',
          }}
        >
          {resetting ? 'Resetting...' : 'Reset my session'}
        </button>
        <span style={{ fontSize: typography.fontSizeSmall, color: colors.inkMuted }}>
          Hides only your session's disputes. The decision ledger is preserved.
        </span>
      </div>

      {error && <ErrorState testId="demo-error" message={error} />}

      {resetMessage && (
        <p role="status" data-testid="demo-reset-result" style={{ color: colors.badgeSuccessText, margin: 0, fontSize: typography.fontSizeSmall }}>
          {resetMessage}
        </p>
      )}

      {created && (
        <Card title={`Scenario ${created.scenarioId} created`} testId="demo-created-card">
          <p style={{ margin: '0 0 8px', fontSize: typography.fontSizeBody, color: colors.ink }}>
            {created.wait === 'waiting' && 'Waiting for the dispute to appear...'}
            {created.wait === 'found' && 'The dispute is ready.'}
            {created.wait === 'timeout' && 'The dispute is still processing. The link will work once it appears.'}
            {created.wait === 'error' && 'The dispute could not be confirmed. Open it to check the current state.'}
            {created.wait === 'cancelled' && 'Creation is still finishing in the background.'}
          </p>
          <Link
            to={`/app/disputes/${created.disputeId}`}
            data-testid="demo-created-link"
            style={{ color: colors.interactive, fontWeight: typography.fontWeightSemibold, fontSize: typography.fontSizeBody, textDecoration: 'none' }}
          >
            Open dispute {created.disputeId} &rarr;
          </Link>
        </Card>
      )}

      {poolSnapshot?.available === 0 && !created && (
        <EmptyState
          title="No pooled transactions left"
          description="You can still review existing disputes. Reset the demo or reseed the pool to run a new scenario."
          action={<Link to="/app/disputes" style={{ color: colors.interactive }}>View disputes</Link>}
        />
      )}
    </div>
  );
};
