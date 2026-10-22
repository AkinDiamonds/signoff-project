/**
 * Typed public claims registry.
 * Maps every public claim directly to a ledger row in `docs/claims-ledger.md`.
 * Strict typing prevents unverified claims or claims without a ledger ID.
 */

export type ClaimId =
  | 'CLAIM-AI-NO-MUTATING'
  | 'CLAIM-GATE-FAIL-CLOSED'
  | 'CLAIM-GATE-DETERMINISTIC'
  | 'CLAIM-INJECTION-BLOCKED'
  | 'CLAIM-DECISIONS-REPLAYABLE'
  | 'CLAIM-APPROVAL-LIMITS-ONLY'
  | 'CLAIM-EVIDENCE-HEURISTIC'
  | 'CLAIM-HOURS-SAVED-ASSUMPTION'
  | 'CLAIM-STATISTICS-PRIMARY-SRC'
  | 'CLAIM-STUB-OFFLINE'
  | 'CLAIM-SUPPORTED-REASONS'
  | 'CLAIM-REPEAT-DISPUTERS'
  | 'CLAIM-DEMO-SCENARIOS'
  | 'CLAIM-SESSION-ISOLATION'
  | 'CLAIM-CHARTER-VERSIONING'
  | 'CLAIM-JUDGE-DEMO-PANEL'
  | 'CLAIM-READONLY-ASSISTANT'
  | 'CLAIM-ACCESSIBLE-WIDGETS';

export type ClaimStatus = 'Verified' | 'Planned';

export interface PublicClaim {
  readonly id: ClaimId;
  readonly statement: string;
  readonly where: string;
  readonly proof: string;
  readonly status: ClaimStatus;
}

export const PUBLIC_CLAIMS = [
  {
    id: 'CLAIM-AI-NO-MUTATING',
    statement: 'The AI cannot call mutating PayPal endpoints directly',
    where: 'README, landing, video',
    proof: 'import-linter contract + registry test (agent/tests/test_architecture_guard.py)',
    status: 'Verified',
  },
  {
    id: 'CLAIM-GATE-FAIL-CLOSED',
    statement: 'Unknown or unexpected input to the gate fails closed (never ALLOW)',
    where: 'README, landing, video',
    proof: 'agent/tests/test_gate.py::test_rule_g0_00_unknown_action, ::test_gate_aggregation_only_needs_approval',
    status: 'Verified',
  },
  {
    id: 'CLAIM-GATE-DETERMINISTIC',
    statement: 'The gate is a pure function: same input gives the same verdict',
    where: 'README, landing',
    proof: 'agent/tests/test_gate.py::test_property_p5_100x_determinism',
    status: 'Verified',
  },
  {
    id: 'CLAIM-INJECTION-BLOCKED',
    statement: 'Prompt injection attempts are screened, blocked and logged with rule id G5-02',
    where: 'landing, video',
    proof: 'agent/tests/injection/ + demo scenario D',
    status: 'Verified',
  },
  {
    id: 'CLAIM-DECISIONS-REPLAYABLE',
    statement: 'Every decision is deterministic and replayable against the audit ledger',
    where: 'README, landing',
    proof: 'agent/tests/golden_decision_test.py::test_golden_decisions_replay_exactly',
    status: 'Verified',
  },
  {
    id: 'CLAIM-APPROVAL-LIMITS-ONLY',
    statement: 'Human approval can waive merchant charter limits, never hard PayPal or idempotency denials',
    where: 'README, landing, video',
    proof: 'agent/tests/test_gate_rules.py::test_approval_never_waives_paypal_or_state_denials',
    status: 'Verified',
  },
  {
    id: 'CLAIM-EVIDENCE-HEURISTIC',
    statement: 'Evidence strength is an algorithmic heuristic, not an ungrounded model prediction',
    where: 'README, landing',
    proof: 'agent/app/agent/evidence.py, docs/architecture.md, UI label',
    status: 'Verified',
  },
  {
    id: 'CLAIM-HOURS-SAVED-ASSUMPTION',
    statement: 'Estimated hours saved metric explicitly states the 20-minute per dispute assumption',
    where: 'dashboard, landing',
    proof: 'KPI footnote in web/src/features/dashboard/',
    status: 'Verified',
  },
  {
    id: 'CLAIM-STATISTICS-PRIMARY-SRC',
    statement: 'Chargeback industry statistics cite verified primary sources',
    where: 'video, Devpost',
    proof: 'primary source URL per number; card vs PayPal wording',
    status: 'Planned',
  },
  {
    id: 'CLAIM-STUB-OFFLINE',
    statement: 'The PayPal stub runs offline with deterministic IDs, timestamps and fault injection',
    where: 'README status table, guide, demo rehearsal',
    proof: 'agent/tests/test_paypal_stub.py',
    status: 'Verified',
  },
  {
    id: 'CLAIM-SUPPORTED-REASONS',
    statement: 'Supported dispute flows are Item Not Received and Significantly Not As Described; others halt for human review',
    where: 'README status table, landing, guide',
    proof: 'agent/tests/test_second_reason.py',
    status: 'Verified',
  },
  {
    id: 'CLAIM-REPEAT-DISPUTERS',
    statement: 'Repeat disputers inside a 180-day window require human approval at charter threshold',
    where: 'README, landing, demo scenario E',
    proof: 'agent/tests/test_second_reason.py::test_second_reason_repeat_disputer_needs_approval',
    status: 'Verified',
  },
  {
    id: 'CLAIM-DEMO-SCENARIOS',
    statement: 'Anyone can generate scenarios A through E safely, reproducibly, and idempotently',
    where: 'README, guide, video',
    proof: 'agent/tests/test_demo_generator.py',
    status: 'Verified',
  },
  {
    id: 'CLAIM-SESSION-ISOLATION',
    statement: 'Judge demo sessions are cookie-isolated and reset never deletes the immutable ledger',
    where: 'README, guide, video',
    proof: 'agent/tests/test_demo_generator.py::test_reset_hides_disputes_without_deleting_ledger',
    status: 'Verified',
  },
  {
    id: 'CLAIM-CHARTER-VERSIONING',
    statement: 'Authority charter changes are version-audited; stale edits never overwrite newer versions',
    where: 'README, landing, video',
    proof: 'web/test/charter.test.tsx, e2e/specs/charter-demo.spec.ts',
    status: 'Verified',
  },
  {
    id: 'CLAIM-JUDGE-DEMO-PANEL',
    statement: 'Judges can trigger scenarios A-E from the demo panel and reset their own session',
    where: 'README, guide, video',
    proof: 'web/test/demo.test.tsx, e2e/specs/charter-demo.spec.ts',
    status: 'Verified',
  },
  {
    id: 'CLAIM-READONLY-ASSISTANT',
    statement: 'The dashboard assistant cannot take mutating actions and LLM keys never reach the browser',
    where: 'README, landing, video',
    proof: 'agent/tests/test_llm_proxy.py, production build scan',
    status: 'Verified',
  },
  {
    id: 'CLAIM-ACCESSIBLE-WIDGETS',
    statement: 'Dashboard widgets convey urgency and authority status without relying on color alone',
    where: 'README, landing, video',
    proof: 'web/test/widgets.test.tsx, e2e/specs/widgets.spec.ts',
    status: 'Verified',
  },
] as const satisfies readonly PublicClaim[];

export function getClaim(id: ClaimId): PublicClaim {
  const claim = PUBLIC_CLAIMS.find((c) => c.id === id);
  if (!claim) {
    throw new Error(`Unknown claim id: ${id}`);
  }
  return claim;
}
