# Step 10: Authority Charter model, versions and API

Phase: P2 Policy · Depends on: 03 · Estimate: 2h with an agent · Commit: `feat(policy): versioned charter and api`
Status: [ ] not started

## Goal
The merchant's limits as validated, versioned data.

## Do (in order)
1. Implement the charter model per `plan/03-gate-spec.md` and the semantics chosen in ADR-007.
2. Store every change as a new version; never update in place.
3. Add `GET /api/charter` and `PUT /api/charter` (requires the version it is based on); seed a default charter.
4. Write a ledger event for every change.

## Files (touch only these)
`agent/app/policy/charter.py`, `agent/app/api/charter.py`, tests.

## Edge cases: behavior
- Negative limits, more than two decimals, currency different from the merchant's: 422 with field paths.
- Unknown reason or action names: 422. Duplicates are normalized.
- Two clients saving at once: second gets a conflict.
- Frozen demo mode: PUT returns the frozen error.
- Existing decisions keep the charter version they used.

## Edge cases: types
- Model forbids extra fields; reasons list is a list of the dispute reason enum, never plain strings.

## Tests and regression
- Validation matrix; version history; conflict; contract test against the OpenAPI snapshot.

## Done when
- Tests green; type tests for the charter response and request added to the catalog.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
