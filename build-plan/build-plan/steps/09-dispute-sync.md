# Step 09: Dispute sync and reconciliation poller

Phase: P1 Ingestion · Depends on: 06,08 · Estimate: 2h with an agent · Commit: `feat(sync): dispute sync, fingerprinting and reconcile`
Status: [ ] not started

## Goal
Local dispute state always converges to PayPal's, even when webhooks are lost or reordered.

## Do (in order)
1. Implement the sync handler: fetch, parse, store snapshot, compute fingerprint, write a ledger event on change.
2. If the fingerprint changed and the status requires a seller response, enqueue one agent run keyed by dispute and fingerprint; resolved disputes cancel pending runs.
3. Implement the reconcile job on a timer: list open disputes, compare fingerprints, enqueue syncs.
4. Map PayPal statuses to our `DisputeState` enum with an explicit unknown value that never triggers an agent run.

## Files (touch only these)
`agent/app/sync/*`, tests.

## Edge cases: behavior
- UPDATED arrives before CREATED: same end state.
- Unchanged fingerprint: no agent run.
- Webhook and reconcile hit the same dispute together: jobs coalesce.
- Dispute disappears (404) after being known: mark unavailable, keep history.
- Huge open list: cap per cycle and continue next cycle.

## Edge cases: types
- `DisputeState` mapping is exhaustive over the enum; unknown PayPal statuses map to the unknown value, not an error.

## Tests and regression
- Event sequence tables; a dropped webhook is caught by the poller; concurrency produces one agent run.

## Done when
- Tests green; sandbox dispute from the spike syncs into the database.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
