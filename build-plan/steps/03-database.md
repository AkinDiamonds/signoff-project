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
| 2026-10-07 | `MoneyNumeric` annotated type declared `float` — defeats float-rejection validators if the annotated type is ever used directly | Changed to `Decimal` in `db/base.py` | pending | R1 |
| 2026-10-07 | Backtick wrapping in `POSTGRES_NAMING_CONVENTION["ck"]` produced garbled constraint names (e.g. `` ck_decisions_`ck_verdict_verdict` ``) in both model metadata and migration SQL | Removed backticks from naming convention in `db/base.py`; updated all constraint names in migration | pending | R1 |
| 2026-10-07 | `validate_amount` called `Decimal(str(None))` on `None` input → cryptic `InvalidOperation`; also non-numeric strings gave opaque traceback | Added explicit `None` guard and `try/except` around `Decimal()` conversion in both `Dispute` and `Order` validators in `db/models.py` | pending | R1 |
| 2026-10-07 | `LedgerEvent.sequence_number` had no lower-bound constraint — zero or negative sequence numbers could silently corrupt audit ordering | Added `CheckConstraint("sequence_number >= 1", ...)` to `LedgerEvent.__table_args__` and migration | pending | R1 |
| 2026-10-07 | Migration `upgrade()` used plain `CREATE TRIGGER` (not idempotent) — re-running on retry would raise "trigger already exists" | Added `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER` in migration upgrade block | pending | R1 |
| 2026-10-07 | `get_engine` `lru_cache` makes engine reconfiguration in tests impossible without an explicit `cache_clear()` — undocumented contract | Added `reset_engine()` utility exposed from `db/__init__.py` | pending | R1 |
| 2026-10-07 | `install_append_only_triggers` silently no-ops for unsupported dialects with no indication | Added `logger.warning(...)` for unknown dialects in `db/triggers.py` | pending | R1 |
| 2026-10-07 | `readyz` returned a `JSONResponse` object from a `dict`-typed route — FastAPI serialised the Response object as JSON instead of returning it, producing wrong HTTP status | Changed to `raise UpstreamUnavailableError(...)` handled by registered exception handler; corrected return type annotation | pending | R1 |
| 2026-10-07 | `validate_paypal_base_url` compared `parsed.netloc` (includes port and userinfo) instead of `parsed.hostname` — host-bypass payloads theoretically possible | Changed to `parsed.hostname` in `settings.py` | pending | R1 |
| 2026-10-07 | Tests for `validate_amount` did not cover `None` or invalid-string inputs | Added `None` and non-numeric string cases to `test_money_fixed_precision_and_decimals_rule` | pending | R1 |
| 2026-10-07 | No test for `sequence_number >= 1` DB constraint | Added `test_ledger_event_sequence_number_positive_constraint` (requires migration at new HEAD) | pending | R1 |
| 2026-10-07 | `validate_amount` exponent check (`d.as_tuple().exponent < -2`) raised type error and runtime `TypeError` on non-finite values (`NaN`, `Infinity` have string exponents) | Added `d.is_finite()` guard and integer type narrowing before exponent check in `Dispute` and `Order` models; added test cases | pending | R1 |


