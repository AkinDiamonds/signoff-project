# Step 14: Decision ledger and timeline API

Phase: P2 Policy · Depends on: 13 · Estimate: 2h with an agent · Commit: `feat(ledger): ledger service, timeline api and replay`
Status: [ ] not started

## Goal
Everything that happens to a dispute is recorded once, in order, and replayable.

## Do (in order)
1. Implement the ledger service that writes decisions and ledger events with a per-dispute sequence number.
2. Add `GET /api/disputes/{id}/decisions` and `GET /api/disputes/{id}/timeline` using the event kinds in `contracts.md`, with cursor pagination.
3. Add a replay script that re-runs the gate on stored inputs and reports differences from stored verdicts.

## Files (touch only these)
`agent/app/ledger/*`, `agent/app/api/timeline.py`, `scripts/replay_decisions.py`, tests.

## Edge cases: behavior
- Order is by sequence number, never by timestamp.
- Dispute with no events: empty list; unknown dispute: 404.
- Untrusted text is truncated and flagged in API output; the UI still escapes it.
- Replay with a missing charter version reports an error row, not a crash.
- Unknown event kinds are returned as-is with their kind.

## Edge cases: types
- Timeline events are a union keyed by kind with documented fields; the frontend will use an exhaustive switch (type test lands in step 25).

## Tests and regression
- Ordering; pagination; replay against golden decisions; database triggers still block edits.

## Done when
- Tests green; OpenAPI updated and client regenerated.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
