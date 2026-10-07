# Step 25: Dispute list, detail and Decision Timeline

Phase: P5 Merchant UI · Depends on: 24,14,21 · Estimate: 3h with an agent · Commit: `feat(web): dispute list, detail and timeline`
Status: [ ] not started

## Goal
See what the agent did and why, for any dispute.

## Do (in order)
1. Build the list page with filters (status, reason, mine or all sessions) kept in the URL.
2. Build the detail page: summary, evidence panel with evidence strength, buyer message labeled as untrusted text, timeline, verdict chips with rule id and reason.
3. Poll for updates with a "stale" indicator and ignore responses older than the one shown.

## Files (touch only these)
`web/src/features/disputes/*`, tests.

## Edge cases: behavior
- Empty list links to the demo page; unknown dispute shows not-found.
- Script or markup in messages displays as plain text.
- Long messages collapse; unknown timeline event kind renders generically.
- Agent still running: show in-progress state.
- Invalid URL filter values fall back to defaults.
- Pagination preserved on back navigation.

## Edge cases: types
- Timeline rendering uses an exhaustive switch with a never check (type test); filter parameters parsed by a schema with a defaults table.

## Tests and regression
- Component tests with the mock server; Playwright: open detail from list, timeline order, injected markup stays text; mobile viewport.

## Done when
- Tests green; regression: step 24 tests.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
