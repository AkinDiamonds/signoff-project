# Step 15: Mock store, evidence builder, evidence strength

Phase: P3 Agent · Depends on: 14 · Estimate: 2h with an agent · Commit: `feat(evidence): mock store, builder and strength score`
Status: [ ] not started

## Goal
Realistic order and tracking data and an honest evidence score.

## Do (in order)
1. Create mock order and tracking tables seeded from scenario definitions A to E (fictional data only).
2. Implement lookup by PayPal transaction id.
3. Implement the evidence builder for not-received disputes (carrier and tracking number, or notes).
4. Implement evidence strength: components delivered, tracking present, buyer history, completeness; returns an integer 0 to 100, a label and the component list.

## Files (touch only these)
`agent/app/store_mock/*`, `agent/app/agent/evidence.py`, tests.

## Edge cases: behavior
- No order found for the transaction: low strength, builder returns nothing to submit, reason stated.
- Tracking present but not delivered; delivery dated before the order; several shipments.
- Unsupported or unknown carrier value: use a value confirmed by the schema or fixture, otherwise do not submit.
- Tracking numbers with odd characters or excessive length.
- Output text never contains the words probability or win.

## Edge cases: types
- Strength is a typed object with integer bounds checked at runtime; label thresholds tested at each boundary.

## Tests and regression
- Scenario table A to E with expected ranges; wording scan; determinism.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
