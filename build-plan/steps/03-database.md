# Step 03: Database schema and migrations

Phase: P0 Foundation · Depends on: 02 · Estimate: 2h with an agent · Commit: `feat(db): schema, constraints and append-only triggers`
Status: [x] done

## Goal
The full schema from `docs/architecture.md` with constraints that make the safety rules true at the database level.

## Do (in order)
1. Add a compose service for Postgres for dev and CI; wire `/readyz` to a real check.
2. Create typed SQLAlchemy models and the first Alembic revision for every table in the architecture doc, plus `ledger_events` (append-only record of every state transition) and `demo_sessions`.
3. Constraints: webhook event id primary key and unique transmission id; `executions.decision_id` unique; one pending job per dispute and kind; money as fixed-precision numeric; all timestamps timezone-aware.
4. Triggers rejecting UPDATE and DELETE on `decisions` and `ledger_events`.
5. Put all enums in one module (`agent/app/domain/enums.py`) and generate database CHECK constraints from it.
6. Update the table list in `docs/architecture.md` with `ledger_events` and `demo_sessions`.

## Files (touch only these)
`agent/app/db/*`, `agent/app/domain/enums.py`, migrations, `docs/architecture.md`, tests.

## Edge cases: behavior
- Migration up, down, up again works.
- Two sessions inserting the same event id at once: exactly one succeeds.
- Raw SQL update or delete on `decisions` is rejected, not only ORM calls.
- Values with more than two decimals are rejected or rounded by an explicit rule, never silently floated.
- Note in the file that a database owner could drop the trigger; this is accepted for a demo.

## Edge cases: types
- Models use typed mapped columns and pass strict type checking; enum parity test between Python enums and CHECK constraints.

## Tests and regression
- Migration round trip; trigger tests; race test; enum parity.

## Done when
- `make test-agent` green against real Postgres in CI.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
