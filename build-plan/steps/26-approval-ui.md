# Step 26: Approval page (mobile first)

Phase: P5 Merchant UI · Depends on: 24,19 · Estimate: 3h with an agent · Commit: `feat(web): mobile approval card`
Status: [ ] not started

## Goal
Approve, deny or edit from a phone, safely.

## Do (in order)
1. Build `/approve/:token` showing summary, evidence, proposed action, gate reason and time left.
2. Build the edit form (amount, optional message) with a confirmation step for money-moving actions.
3. Build distinct outcome screens: approved, denied, expired, stale, already resolved, invalid link.
4. Set the no-referrer policy and keep tokens out of logs and analytics.

## Files (touch only these)
`web/src/features/approval/*`, tests.

## Edge cases: behavior
- Network failure during submit: show "outcome unknown", re-fetch state, never assume.
- Double tap and back-button after resolution do not resubmit.
- Amount input: commas, spaces, pasted text, more than two decimals, negative, leading zeros, huge values.
- 320px width, keyboard and screen reader use.

## Edge cases: types
- The resolve request is built only through the amount parser that returns the Money type; a type test shows an edit with no fields cannot be constructed.

## Tests and regression
- Parser table with at least 15 inputs; Playwright (mobile project): approve, deny, edit then approve, expired link, double click.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
