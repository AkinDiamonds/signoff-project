# Step 29: Custom widgets

Phase: P5 Merchant UI · Depends on: 28 · Estimate: 3h with an agent · Commit: `feat(web): decision timeline, deadline radar, authority meter`
Status: [ ] not started

## Goal
Polished custom widgets. Cut list: keep the timeline and one more; plain components are acceptable if the Studio widget API blocks.

## Do (in order)
1. Build Decision Timeline, Deadline Radar and Authority Meter and register them with Studio, each with a described data shape for the assistant.
2. Implement empty, single-item and many-item states for each.

## Files (touch only these)
`web/src/features/widgets/*`, tests.

## Edge cases: behavior
- No data; one item; 200 items; overlapping deadlines; past-due items.
- Usage above 100% of a limit shown clearly.
- Meaning never conveyed by color alone; keyboard focus and resize work.

## Edge cases: types
- Widget config types derive from api-client types; type tests for each.

## Tests and regression
- Component tests; Playwright screenshot comparison with tolerance; accessibility check.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
