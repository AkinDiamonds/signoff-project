# Step 11: Gate part 1: types, aggregation, PayPal and time rules

Phase: P2 Policy · Depends on: 05,10 · Estimate: 3h with an agent · Commit: `feat(gate): decision types and rules G1 G2 G0`
Status: [ ] not started

## Goal
The pure gate skeleton with the first rule families, built test-first.

## Do (in order)
1. Define the action union, gate input, verdict enum, rule registry (id, description) and a frozen decision type that can only be created inside the gate.
2. Implement aggregation exactly as in `plan/03-gate-spec.md` (DENY beats NEEDS_APPROVAL beats ALLOW; all triggered rules listed).
3. Implement G1-01, G1-02, G2-01, G2-02 and the fail-closed fallback G0-00.
4. The gate takes `now` as an argument and performs no I/O.

## Files (touch only these)
`agent/app/policy/gate.py`, `agent/app/policy/rules.py`, `agent/app/domain/actions.py`, tests.

## Edge cases: behavior
- Action missing from allowed options or links: DENY. Missing options entirely: DENY.
- Due time boundary: allowed at or before the due time, denied after (documented in contracts).
- Timezone-naive `now` or due date: rejected.
- Several rules triggered: deterministic order; recorded `rule_id` is the lowest-numbered step.
- Unknown action type reaching the gate: G0-00, never ALLOW.

## Edge cases: types
- Decision cannot be built outside the gate (runtime test); exhaustive handling of the action union; rule ids come from one registry with no duplicates.

## Tests and regression
- Allow, deny and boundary test per rule; determinism (same input 100 times); properties P1, P3, P5 from the spec.

## Done when
- 100% branch coverage on the gate file; tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
