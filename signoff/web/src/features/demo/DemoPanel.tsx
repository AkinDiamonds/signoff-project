import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  colors,
  spacing,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      <header>
        <h1 data-testid="demo-panel-title" style={{ margin: 0 }}>Demo scenarios</h1>
        <p style={{ color: colors.inkMuted, margin: '4px 0 0' }}>
          Create a fictional dispute and follow it through the agent.
        </p>
      </header>

      {frozen && <Banner variant="frozen" testId="demo-frozen-banner" />}
      {cachedReasoning && <Banner variant="cached" testId="demo-cached-reasoning" />}

      <Card title="Pool status" testId="demo-pool-card">
        {poolQuery.isPending && <Skeleton height="40px" />}
        {poolQuery.isError && <p role="alert" data-testid="demo-pool-error">Pool status is unavailable.</p>}
        {poolQuery.data && (
          <div data-testid="demo-pool-status">
            <p style={{ margin: '0 0 8px' }}>
              <strong>{poolQuery.data.available}</strong> of {poolQuery.data.total} pooled transactions available.
              {poolIsEmpty(poolQuery.data) && ' The pool is empty; reset the demo or reseed it.'}
            </p>
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2], listStyle: 'none', margin: 0, padding: 0 }}>
              {SCENARIO_BUTTONS.map((scenario) => {
                const counts = poolQuery.data?.by_scenario?.[scenario.id];
                return (
                  <li key={scenario.id} data-testid={`demo-pool-${scenario.id}`} style={{ fontSize: '13px' }}>
                    Scenario {scenario.id}: {counts?.available ?? 0} available
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p data-testid="demo-quota-note" style={{ margin: '8px 0 0', fontSize: '12px', color: colors.inkMuted }}>
          Quota: enforced per session and IP per day. A quota response shows when it resets.
        </p>
      </Card>

      <Card title="Scenarios" testId="demo-scenario-card">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
          {SCENARIO_BUTTONS.map((scenario) => (
            <li key={scenario.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing[1] }}>
              <Button
                testId={`demo-scenario-${scenario.id}`}
                onClick={() => void runScenario(scenario.id)}
                disabled={busy || frozen}
                aria-busy={pending === scenario.id}
              >
                {pending === scenario.id ? `Running ${scenario.id}...` : `Run scenario ${scenario.id}`}
              </Button>
              <span data-testid={`demo-scenario-${scenario.id}-expected`} style={{ flex: '1 1 240px' }}>
                <strong>{scenario.title}.</strong> {scenario.expected}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: spacing[2] }}>
          <Button variant="secondary" testId="demo-reset-button" onClick={() => void handleReset()} disabled={busy || frozen}>
            {resetting ? 'Resetting...' : 'Reset my session'}
          </Button>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: colors.inkMuted }}>
            Reset hides only your session's disputes. The decision ledger is never deleted.
          </p>
        </div>
      </Card>

      {error && <ErrorState testId="demo-error" message={error} />}

      {resetMessage && (
        <p role="status" data-testid="demo-reset-result" style={{ color: colors.ink }}>
          {resetMessage}
        </p>
      )}

      {created && (
        <Card title={`Scenario ${created.scenarioId} created`} testId="demo-created-card">
          <p style={{ margin: '0 0 8px' }}>
            {created.wait === 'waiting' && 'Waiting for the dispute to appear...'}
            {created.wait === 'found' && 'The dispute is ready.'}
            {created.wait === 'timeout' && 'The dispute is still processing. The link will work once it appears.'}
            {created.wait === 'error' && 'The dispute could not be confirmed. Open it to check the current state.'}
            {created.wait === 'cancelled' && 'Creation is still finishing in the background.'}
          </p>
          <Link
            to={`/app/disputes/${created.disputeId}`}
            data-testid="demo-created-link"
            style={{ color: colors.brandPrimary, fontWeight: 600 }}
          >
            Open dispute {created.disputeId}
          </Link>
        </Card>
      )}

      {poolQuery.data?.available === 0 && !created && (
        <EmptyState
          title="No pooled transactions left"
          description="You can still review existing disputes. Reset the demo or reseed the pool to run a new scenario."
          action={<Link to="/app/disputes" style={{ color: colors.brandPrimary }}>View disputes</Link>}
        />
      )}
    </div>
  );
};
