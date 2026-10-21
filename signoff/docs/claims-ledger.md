# Claims ledger

Every claim in the README, Devpost text or video needs a row with proof. Review in full on Nov 8 and Nov 11. No row, no claim.

| Claim | Where it appears | Proof (test / demo step / link) | Status |
|---|---|---|---|
| The AI cannot call mutating PayPal endpoints | README, video | import-linter contract + registry test | Planned |
| Unknown or unexpected input to the gate fails closed (never ALLOW) | README, video | `agent/tests/test_gate.py::test_rule_g0_00_unknown_action`, `::test_gate_aggregation_only_needs_approval` | Verified |
| The gate is a pure function: same input gives the same verdict | README | `agent/tests/test_gate.py::test_property_p5_100x_determinism` | Verified |
| Injection attempt is blocked and logged with a rule id | video | `agent/tests/injection/` + demo scenario D | Planned |
| Decisions are replayable | README | `agent/tests/golden_decision_test.py::test_golden_decisions_replay_exactly` over `agent/tests/golden/gate_decisions.json` | Verified |
| An approval can only waive charter limits, never a PayPal/state/idempotency denial | README, video | `agent/tests/test_gate_rules.py::test_approval_never_waives_paypal_or_state_denials`, `::test_approval_never_waives_deadline_or_idempotency` | Verified |
| Evidence strength is a heuristic, not a model | README | `docs/architecture.md`, UI label | Planned |
| Estimated hours saved assumes N minutes/dispute | dashboard | KPI footnote | Planned |
| Statistics (chargebacks, friendly fraud) | video, Devpost | primary source URL per number; card vs PayPal wording | Planned |
| The PayPal stub runs offline with deterministic ids, times and fault injection | README status table, demo rehearsal | `agent/tests/test_paypal_stub.py` | Verified |
| Two dispute reasons are supported; any other reason stops and asks for a human | README status table | `agent/tests/test_second_reason.py::test_registry_is_exhaustive_for_supported_reasons`, `::test_unsupported_reason_stops_with_human_needed` | Verified |
| Repeat disputers are flagged for approval at the charter threshold | README, demo scenario E | `agent/tests/test_second_reason.py::test_history_counts_only_same_buyer_inside_window`, `::test_second_reason_repeat_disputer_needs_approval` | Verified |
| Anyone can create scenarios A-E safely and repeatedly | README, video | `agent/tests/test_demo_generator.py` | Verified |
| Demo sessions are isolated and reset never deletes the ledger | README, video | `agent/tests/test_demo_generator.py::test_reset_hides_disputes_without_deleting_ledger`, `::test_spoofed_session_is_replaced` | Verified |
| Merchants can change charter limits and see version history; stale edits never overwrite a newer version | README, video | `web/test/charter.test.tsx`, `e2e/specs/charter-demo.spec.ts` | Verified |
| Judges can run scenarios A-E from the demo panel, see the expected outcome, and reset only their own session | README, video | `web/test/demo.test.tsx`, `e2e/specs/charter-demo.spec.ts` | Verified |
| The dashboard assistant cannot take actions and the LLM key never reaches the browser | README, video | `agent/tests/test_llm_proxy.py::test_unknown_or_mutating_tool_is_rejected`, `::test_client_model_override_is_ignored`, production build scan with a canary `LLM_API_KEY` | Verified |
| Dashboard widgets show deadline urgency and over-limit usage without relying on colour alone | README, video | `web/test/widgets.test.tsx`, `e2e/specs/widgets.spec.ts` (axe + screenshot tolerance) | Verified |
