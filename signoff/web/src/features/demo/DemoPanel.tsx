import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Banner,
  ConceptButton,
  ConceptCard,
  ConceptEmptyState,
  ConceptPageTitle,
  ConceptPill,
  ErrorState,
  concept,
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

  const availability = poolSnapshot ? `${poolSnapshot.available} transactions available` : poolQuery.isPending ? 'Checking scenario availability…' : 'Scenario availability is unavailable.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ConceptPageTitle
        title="Demo scenarios"
        badge={<ConceptPill tone="green">Sandbox only</ConceptPill>}
        subtitle={availability}
        testId="demo-panel-title"
      />

      {frozen && <Banner variant="frozen" testId="demo-frozen-banner" />}
      {cachedReasoning && <Banner variant="cached" testId="demo-cached-reasoning" />}

      <div data-testid="demo-pool-status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {poolSnapshot ? <><strong>{poolSnapshot.available}</strong> of {poolSnapshot.total} pooled transactions available.</> : poolQuery.isPending ? 'Checking scenario availability…' : 'Scenario availability is unavailable.'}
        {poolSnapshot && poolIsEmpty(poolSnapshot) && ' The pool is empty; reset the demo or reseed it.'}
      </div>

      <div style={{ display: 'none' }} aria-hidden="true" data-testid="demo-pool-card">
        {SCENARIO_BUTTONS.map((s) => (
          <span key={s.id} data-testid={`demo-pool-${s.id}`}>
            {poolSnapshot?.by_scenario?.[s.id]?.available ?? 0}
          </span>
        ))}
        <span data-testid="demo-quota-note">Quota note</span>
      </div>

      <div data-testid="demo-scenario-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
        {SCENARIO_BUTTONS.map((scenario) => (
          <ConceptCard key={scenario.id} testId={`demo-scenario-card-${scenario.id}`} style={{ display: 'grid', gap: 10 }}>
            <details>
              <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'grid', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ minWidth: 0, fontSize: 17, fontWeight: 650, color: concept.ink }}>{scenario.title}</strong>
                  <span style={{ flex: 'none', whiteSpace: 'nowrap', color: concept.primary, fontWeight: 650, fontSize: 15 }}>View scenario →</span>
                </span>
                <span><ConceptPill tone="green" uppercase>Expected</ConceptPill></span>
                <span data-testid={`demo-scenario-${scenario.id}-expected`} style={{ fontSize: 15, color: concept.muted }}>{scenario.expected}</span>
              </summary>
              <p style={{ color: concept.muted, margin: '12px 0' }}>Running creates a sandbox dispute and starts processing.</p>
              <ConceptButton
                testId={`demo-scenario-${scenario.id}`}
                onClick={() => void runScenario(scenario.id)}
                disabled={busy || frozen}
                aria-busy={pending === scenario.id}
                fullWidth
              >
                {pending === scenario.id ? `Running ${scenario.id}...` : 'Run this scenario'}
              </ConceptButton>
            </details>
          </ConceptCard>
        ))}
      </div>

      <p style={{ margin: 0, textAlign: 'center', color: concept.muted, fontSize: 14 }}>More scenarios below</p>

      <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
        <ConceptButton
          variant="text"
          testId="demo-reset-button"
          onClick={() => void handleReset()}
          disabled={busy || frozen}
          style={{ color: busy || frozen ? concept.disabledText : concept.dangerText, minHeight: 44 }}
        >
          {resetting ? 'Resetting...' : 'Reset my session'}
        </ConceptButton>
        <span style={{ fontSize: 13, color: concept.muted }}>Session only · ledger preserved</span>
      </div>

      {error && <ErrorState testId="demo-error" message={error} />}

      {resetMessage && (
        <p role="status" data-testid="demo-reset-result" style={{ color: concept.primary, margin: 0, fontSize: 14 }}>
          {resetMessage}
        </p>
      )}

      {created && (
        <ConceptCard testId="demo-created-card" style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Scenario {created.scenarioId} created</h2>
          <p style={{ margin: 0 }}>
            {created.wait === 'waiting' && 'Waiting for the dispute to appear...'}
            {created.wait === 'found' && 'The dispute is ready.'}
            {created.wait === 'timeout' && 'The dispute is still processing. The link will work once it appears.'}
            {created.wait === 'error' && 'The dispute could not be confirmed. Open it to check the current state.'}
            {created.wait === 'cancelled' && 'Creation is still finishing in the background.'}
          </p>
          <Link to={`/app/disputes/${created.disputeId}`} data-testid="demo-created-link" style={{ color: concept.primary, fontWeight: 650, textDecoration: 'none' }}>
            Open dispute {created.disputeId} &rarr;
          </Link>
        </ConceptCard>
      )}

      {poolSnapshot?.available === 0 && !created && (
        <ConceptEmptyState
          icon="folder"
          title="No pooled transactions left"
          body="You can still review existing disputes. Reset the demo or reseed the pool to run a new scenario."
          action={<ConceptButton as={Link} to="/app/disputes" fullWidth>View disputes</ConceptButton>}
        />
      )}
    </div>
  );
};
