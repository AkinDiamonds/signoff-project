# Step 12: Gate part 2: amount, reason, history, idempotency, approval

Phase: P2 Policy · Depends on: 11 · Estimate: 3h with an agent · Commit: `feat(gate): rules G3-G7 and approval waiver`
Status: [ ] not started

## Goal
Complete the gate and prove its properties.

## Do (in order)
1. Implement G3-01 to G3-04, G4-01, G4-02, G5-01, G5-02, G6-01 and G7-01 per the spec and ADR-007.
2. Implement the approval waiver as a separate function that can waive only the charter steps (3 to 5), never steps 1, 2 or 6.
3. Add the golden decisions file (inputs and expected verdict and rule id) used for replay later.

## Files (touch only these)
`agent/app/policy/gate.py`, `agent/app/policy/approval.py`, `agent/tests/golden/*`, tests.

## Edge cases: behavior
- Offer exactly at the limit allowed; one cent above needs approval; accept above zero needs approval.
- Currency mismatch, negative, zero offer, offer above disputed amount: DENY.
- Amounts with more than two decimals: rejected before comparison.
- Repeat-disputer threshold boundary: below allowed, at threshold flagged.
- Injection flag plus other triggers: DENY wins.
- Identical action on the same fingerprint twice: second is G6-01; same action on a new fingerprint is evaluated fresh.
- An approval that tries to override a PayPal-state or idempotency denial is ignored.
- An edited offer is re-gated and an edit above the disputed amount is DENY.

## Edge cases: types
- Money handled only through Decimal helpers; a test scans the gate package for float use.

## Tests and regression
- Full matrix; properties P1 to P5; golden replay; CI enforces 100% branch coverage on the gate package.

## Done when
- Tests green; re-run all step 11 tests.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
