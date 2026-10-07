# Step 08: Job queue and worker

Phase: P1 Ingestion · Depends on: 07 · Estimate: 2h with an agent · Commit: `feat(worker): leased job queue with retries and dead letters`
Status: [ ] not started

## Goal
Reliable background execution with crash recovery.

## Do (in order)
1. Claim jobs with row locking that skips locked rows, a lease with expiry and heartbeat.
2. Retries with exponential backoff and jitter; after the maximum attempts, move to dead-letter with the last error.
3. Worker entrypoint with graceful shutdown; handler registry keyed by job kind (kinds in `contracts.md`); unknown kind goes to dead-letter.
4. Surface queue depth and dead-letter count in `/api/status`.

## Files (touch only these)
`agent/app/queue/*`, `agent/app/worker.py`, tests.

## Edge cases: behavior
- Two workers never run the same job concurrently.
- Worker killed mid-job: lease expires and another worker finishes it.
- A poison job does not block others.
- Use database time, not worker time, for leases.
- Shutdown during a job: finish or release the lease cleanly.
- Payload invalid for its kind: dead-letter immediately.

## Edge cases: types
- Payloads form a union keyed by kind; the handler registry is checked for exhaustiveness at type-check time.

## Tests and regression
- Concurrency test with several workers; kill-mid-job simulation; backoff table; dead-letter path.

## Done when
- Tests green; worker runs locally and processes a webhook-created job to a no-op handler.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
