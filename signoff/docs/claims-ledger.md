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
