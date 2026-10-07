# Step 27: Charter page and demo panel

Phase: P5 Merchant UI · Depends on: 24,10,23 · Estimate: 2h with an agent · Commit: `feat(web): charter editor and demo panel`
Status: [ ] not started

## Goal
Change limits and generate scenarios from the UI.

## Do (in order)
1. Build the charter page with version history and a conflict screen showing the newer version.
2. Build the demo panel: buttons A to E with the expected outcome stated, quota and pool status, reset for own session, frozen banner, cached-reasoning label.
3. After creating a scenario, poll until the dispute appears and link to it.

## Files (touch only these)
`web/src/features/charter/*`, `web/src/features/demo/*`, tests.

## Edge cases: behavior
- Field-level validation errors; conflict on save; rapid clicking disabled while pending.
- Quota exhausted, pool empty, frozen: each has its own message.
- Leaving the page mid-creation does not duplicate the scenario.

## Edge cases: types
- Scenario buttons are driven by the scenario id union; passing anything else fails the type test.

## Tests and regression
- Component tests; Playwright: lower a limit, run scenario C, see the approval requirement; 429 handling.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
