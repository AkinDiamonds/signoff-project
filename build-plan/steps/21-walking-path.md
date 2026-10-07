# Step 21: End-to-end backend path for scenarios A and B, KPIs

Phase: P4 Simulation · Depends on: 14,17,18,19,20 · Estimate: 3h with an agent · Commit: `feat(api): scenarios A B end to end and kpi endpoints`
Status: [ ] not started
Assumes (step 00 table): S8 sandbox resolution. If the answer changed, edit this file first and log it below.

## Goal
The core loop works from webhook to ledger, and the dashboard has data to read.

## Do (in order)
1. Add an integration test and `scripts/run_scenario.py` that run scenario A and B through the stub: webhook, sync, run, gate, execute, confirm, ledger.
2. Add `GET /api/kpis`, `GET /api/disputes` (filters, cursor) and `GET /api/disputes/{id}` using the definitions in `plan/04-frontend-spec.md`.
3. Return the hours-saved assumption value inside the KPI payload.

## Files (touch only these)
`agent/app/api/kpis.py`, `agent/app/api/disputes.py`, `scripts/run_scenario.py`, tests.

## Edge cases: behavior
- No closed disputes: ratios are null, never NaN or a divide error.
- Disputes in other currencies are excluded from sums and counted separately.
- Invalid filters: 422. Page size bounds enforced. Due-date sorting puts nulls last.
- A dispute resolved outside the agent is not counted as auto-resolved.

## Edge cases: types
- KPI fields that can be absent are explicitly nullable in the spec; money fields are strings.

## Tests and regression
- Scenario A and B integration (stub); KPI table; contract test against the OpenAPI snapshot.

## Done when
- Tests green; client regenerated; re-run steps 07 to 19 suites.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
