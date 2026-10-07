# Step 22: Second dispute reason and repeat-disputer flag

Phase: P4 Simulation · Depends on: 21 · Estimate: 2h with an agent · Commit: `feat(agent): second reason and repeat disputer`
Status: [ ] not started
Assumes (step 00 table): S13 second reason. If the answer changed, edit this file first and log it below.

## Goal
Support the reason chosen in the spike and flag repeat disputers. Cut-list candidate: if cut, mark N/A and keep numbering.

## Do (in order)
1. Add a reason registry mapping each supported reason to its evidence builder; anything else maps to an explicit unsupported value.
2. Implement the second reason's builder from the spike answer for S13.
3. Implement the buyer history counter and wire G5-01.
4. Define scenario E in the fixtures.

## Files (touch only these)
`agent/app/agent/reasons/*`, tests.

## Edge cases: behavior
- Unsupported reason: no plan, dashboard shows "human needed", the agent never guesses.
- Reason changes mid-dispute: fingerprint changes and the case is re-planned.
- Buyer identity missing: history unknown, not flagged, logged.
- Threshold boundary and history time window.
- Required evidence for the second reason missing: no submission; route to approval.

## Edge cases: types
- The registry is exhaustive over supported reasons; unsupported is a distinct type.

## Tests and regression
- One scenario per reason; unsupported case; threshold boundaries.

## Done when
- Tests green; re-run gate and agent suites.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
