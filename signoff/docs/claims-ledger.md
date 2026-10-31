# Claims ledger

Every claim in the README, Devpost text or video needs a row with proof. Review in full on Nov 8 and Nov 11. No row, no claim.

| ID | Claim | Where it appears | Proof (test / demo step / link) | Status |
|---|---|---|---|---|
| CLAIM-SIMULATED-SHIPPING | New verified sandbox payments start persistent simulated shipments; scoped owner controls and the worker advance milestones | Merchant Shipments, shop order detail | `agent/tests/test_fulfillment.py`, `web/test/shipments.test.tsx`, `build-plan/v3/evidence/t04` | Verified locally; deployed observation pending |
| CLAIM-AI-NO-MUTATING | The AI cannot call mutating PayPal endpoints | README, landing, video | import-linter contract + registry test (`agent/tests/test_architecture_guard.py`) | Verified |
| CLAIM-NO-MUTATING-TOOL | The LLM is never given a write tool; its output is a schema-validated plan only | README, architecture docs | `agent/tests/test_architecture_guard.py::test_agent_tool_registry_contains_no_mutating_names`, `agent/tests/test_llm_proxy.py::test_unknown_or_mutating_tool_is_rejected` | Verified |
| CLAIM-GATE-FAIL-CLOSED | Unknown or unexpected input to the gate fails closed (never ALLOW) | README, landing, video | `agent/tests/test_gate.py::test_rule_g0_00_unknown_action`, `::test_gate_aggregation_only_needs_approval` | Verified |
| CLAIM-GATE-DETERMINISTIC | The gate is a pure function: same input gives the same verdict | README, landing | `agent/tests/test_gate.py::test_property_p5_100x_determinism` | Verified |
| CLAIM-INJECTION-BLOCKED | Injection attempt is blocked and logged with a rule id | landing, video | `agent/tests/injection/` + demo scenario D | Verified |
| CLAIM-DECISIONS-REPLAYABLE | Decisions are replayable | README, landing | `agent/tests/golden_decision_test.py::test_golden_decisions_replay_exactly` over `agent/tests/golden/gate_decisions.json` | Verified |
| CLAIM-APPROVAL-LIMITS-ONLY | An approval can only waive charter limits, never a PayPal/state/idempotency denial | README, landing, video | `agent/tests/test_gate_rules.py::test_approval_never_waives_paypal_or_state_denials`, `::test_approval_never_waives_deadline_or_idempotency` | Verified |
| CLAIM-EVIDENCE-HEURISTIC | Evidence strength is a heuristic, not a model | README, landing | `agent/app/agent/evidence.py`, `docs/architecture.md`, UI label | Verified |
| CLAIM-HOURS-SAVED-ASSUMPTION | Estimated hours saved assumes N minutes/dispute | dashboard, landing | KPI footnote in `web/src/features/dashboard/` | Verified |
| CLAIM-STATISTICS-PRIMARY-SRC | Public claims are limited to a typed registry, and every entry maps to a proof row in this ledger | landing, product UI | `web/test/claims.test.ts::every public claim has a matching row in docs/claims-ledger.md`, `web/test/claims.test-d.ts` | Verified |
| CLAIM-STUB-OFFLINE | The PayPal stub runs offline with deterministic ids, times and fault injection | README status table, guide, demo rehearsal | `agent/tests/test_paypal_stub.py` | Verified |
| CLAIM-SUPPORTED-REASONS | Two dispute reasons are supported; any other reason stops and asks for a human | README status table, landing, guide | `agent/tests/test_second_reason.py::test_registry_is_exhaustive_for_supported_reasons`, `::test_unsupported_reason_stops_with_human_needed` | Verified |
| CLAIM-REPEAT-DISPUTERS | Repeat disputers are flagged for approval at the charter threshold | README, landing, demo scenario E | `agent/tests/test_second_reason.py::test_history_counts_only_same_buyer_inside_window`, `::test_second_reason_repeat_disputer_needs_approval` | Verified |
| CLAIM-DEMO-SCENARIOS | Anyone can create scenarios A-E safely and repeatedly | README, guide, video | `agent/tests/test_demo_generator.py` | Verified |
| CLAIM-SESSION-ISOLATION | Demo sessions are isolated and reset never deletes the ledger | README, guide, video | `agent/tests/test_demo_generator.py::test_reset_hides_disputes_without_deleting_ledger`, `::test_spoofed_session_is_replaced` | Verified |
| CLAIM-CHARTER-VERSIONING | Merchants can change charter limits and see version history; stale edits never overwrite a newer version | README, landing, video | `web/test/charter.test.tsx`, `e2e/specs/charter-demo.spec.ts` | Verified |
| CLAIM-JUDGE-DEMO-PANEL | Judges can run scenarios A-E from the demo panel, see the expected outcome, and reset only their own session | README, guide, video | `web/test/demo.test.tsx`, `e2e/specs/charter-demo.spec.ts` | Verified |
| CLAIM-READONLY-ASSISTANT | The dashboard assistant cannot take actions and the LLM key never reaches the browser | README, landing, video | `agent/tests/test_llm_proxy.py::test_unknown_or_mutating_tool_is_rejected`, `::test_client_model_override_is_ignored`, production build scan with a canary `LLM_API_KEY` | Verified |
| CLAIM-ACCESSIBLE-WIDGETS | Dashboard widgets show deadline urgency and over-limit usage without relying on colour alone | README, landing, video | `web/test/widgets.test.tsx`, `e2e/specs/widgets.spec.ts` (axe + screenshot tolerance) | Verified |

## 2026-10-31 shipping increment

Locally verified: new paid orders get persistent simulated shipments, worker schedules actual-time milestones, owner controls require authentication/CSRF/scoped versioned requests. Full suite 598 backend/185 frontend PASS; native local HTTPS controls/reload/phone-width check PASS. Explicit simulation source labels; no real carrier interaction. See build-plan/v3/evidence/t04. This does not prove fresh hosted PayPal purchase/dispute execution, physical Android, or the remaining T05 policy/provenance work.
