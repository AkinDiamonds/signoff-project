# Execution log

## Starting state

- Checkout HEAD: `fd9c2b7472612bfe935144b860359a937f07fb37`.
- Existing planning changes preserved: `signoff/plan/STATUS.md` and untracked `build-plan/v3/`.
- Runtime verified: Python 3.12.14, Node 24.19.0; cloud instance running, current variable observations ready, enforced unrestricted HTTP policy.
- Product decisions: [02-owner-decisions.md](02-owner-decisions.md). These supersede original judge-only/session recommendations and password-recovery suggestions.
- At the start of the audit no product code had changed. Subsequent T01 changes are recorded below. No code has been pushed or deployed, cloud configuration published, or hosted payment/dispute/policy mutation performed.

## T00 — IN PROGRESS: audit and baseline

### Completed

- Read repository agent instructions, STATUS, conventions, plan index, and master implementation plan.
- Created isolated local `signoff_v3_baseline` database in existing `signoff-postgres` container. No shared/deployed database was used by baseline commands.
- Existing Alembic upgrade: PASS, exit 0.
- Read-only deployed browser audit: merchant `https://signoff-web.onrender.com` and shop `https://signoff-shop.onrender.com`; 13 routes at 1440, 390 and 320 pixel widths. Non-GET/HEAD/OPTIONS requests were blocked. No mutation controls clicked. Dismissed the theme dialog to inspect underlying pages, preserving the finding that it interrupts first-visit access.
- Raw screenshots/results/logs are in ignored `scratch/v3-audit/`; do not commit/share private traces without reviewing them.
- Both frontend builds: PASS, exit 0, using local API build URL.
- `git diff --check`: PASS.

### Check outcomes (exact commands and logs)

The scratch runner uses per-process test environment overrides and the isolated local DB. This is an investigation, not a passing release baseline. Complete commands and exit codes are recorded in `scratch/v3-audit/baseline-results.json`.

| Check | Result | Evidence / limits |
|---|---|---|
| `.venv/Scripts/python.exe -m alembic upgrade head` | PASS 0 | Local disposable database only. |
| `.venv/Scripts/python.exe -m ruff check signoff/agent signoff/scripts` | FAIL 1 | 14 findings, `ruff.log`. |
| `npx eslint .` | FAIL 1 | Nine product findings plus two in the temporary browser helper; helper globals have since been declared. No product lint rule disabled. `eslint.log`. |
| `.venv/Scripts/python.exe -m pytest -q` (forced stub defaults) | FAIL 1 | 473 passed, nine failed. Stub URL and fake provider affected tests expecting sandbox/default mode; not nine confirmed product bugs. `pytest.log`. |
| Same pytest command (neutralized direct settings aliases) | FAIL 1 | 473 passed, nine failed with different test set. AliasChoices-backed hold setting remains inherited and must be isolated. Ledger replay mismatch persists. `pytest-neutral.log`. No third retry in this session. |
| `MYPYPATH=signoff .venv/Scripts/python.exe -m mypy --strict signoff/agent/app` | FAIL 1 | 44 errors in 20 files, `mypy.log`. |
| `PYTHONPATH=signoff:signoff/agent .venv/Scripts/python.exe .venv/bin/lint-imports` | FAIL 1 | Banner only; cause unresolved, `imports.log`. |
| `npx tsc --noEmit` | FAIL 2 | Buyer portal reason-union mismatch and unused expect-error, `tsc.log`. |
| `npx vitest run --maxWorkers=2 --minWorkers=1` | FAIL 1 | 167 passed, two failed type assertions; 27 files passed/one failed; `vitest.log`. |
| `.venv/Scripts/python.exe signoff/scripts/check_enum_parity.py` | FAIL 1 | Timeline enum differs (`DISPUTE_POOLED`); `enums.log`. |
| `VITE_API_URL=http://localhost:8000 npm run build` | PASS 0 | Merchant and shop build, `build.log`. |

Tests temporarily rewrote the tracked OpenAPI snapshot and subsequently restored identical content on the second run. Final Git status confirms no generated-schema/product source change. Always inspect this after pytest because export tests may write the tracked snapshot.

### Still required before T00 is PASS

- Page/control inventories are saved in `audit/page-inventory.md` and `audit/interaction-inventory.csv`. Product, real order, valid approval and buyer-case states are explicitly NOT OBSERVED; completing them needs scoped rehearsal data.
- Obtain a scrubbed failing LLM action/validation fixture or equivalent secure diagnostic access for the reported deployed incident. The pasted audit message alone does not establish a root cause.
- Inspect actual Render worker/deployed revisions, webhook/provider results and safe settings metadata when authorized access is available; current public page responses do not prove worker health or release SHA. No Render connector is available in the current tool list.
- T01 must introduce robust test environment isolation covering Pydantic AliasChoices and mode-specific defaults. Do not run tests against configured shared URLs to make them pass.

## Next implementation work

T02 is next: minimal protected owner access and truthful readiness. Preserve agreed autonomous gate/executor behavior and add configurable missing-delivery policy with tests before changing its semantics.

T02–T17 remain TODO. No task is marked complete merely because planning text or a screenshot exists.

## T01 — PASS (local baseline), CI execution NOT RUN

### Changes

- `signoff/scripts/test_environment.py`, `prepare_test_database.py`, test `conftest.py`: remove inherited settings case-insensitively, including AliasChoices/AliasPath; refuse remote/shared/query-redirected test databases; default to `signoff_test`; disable developer dotenv in pytest before importing app modules. Regression tests cover contamination, aliases and rejected URLs without printing credentials.
- OpenAPI export accepts a supplied output path; export tests write to pytest temporary directories instead of tracked files. Client freshness check compares generated text in memory, without rewriting files or treating an unrelated working-tree diff as stale code.
- Fixed time-sensitive ledger replay fixture by inserting a decision with a historical time before its historical response deadline. Did NOT change the gate's deadline behavior or mutate an existing append-only decision.
- Fixed Ruff/ESLint findings and explicit Python typing across adapters/API/schema boundaries, preserved mock-store model exports, and removed redundant discriminated-union conditions. Monetary and executor authorization rules remain unchanged; existing approval/architecture tests pass.
- Import-linter now uses valid top-level root `agent`. Contracts test direct prohibited imports; authorized indirect service imports are allowed. All existing negative architecture guard tests remain. Original failure was `grimp.exceptions.NotATopLevelModule`.
- Reconciled buyer `OTHER` type assertions with existing backend/frontend support and human-review behavior. Added missing DISPUTE_POOLED TypeScript enum member from Python's authoritative enum.
- Validated persisted theme names instead of asserting arbitrary localStorage text is a valid preset.
- `.nvmrc` pins tested Node 24.19.0. Declared required mypy/import-linter development tools, added `uv.lock`, and verified `uv sync --frozen --extra dev` (uv 0.12.23). uv removes undeclared pip/root wheel; scripts work from source with documented PYTHONPATH.
- Make targets now include strict mypy, import contracts, TypeScript checking and guarded test-DB preparation. CI runs on PRs and main with a disposable PostgreSQL DB, locked dependencies, schema freshness and both builds. E2E workflow installation also uses the lock. GitHub jobs have NOT executed in this session.
- ADR-019 records owner choices; ADR-020 records verification/tooling decisions.

### Final verified results

All commands below ran from repository root. Backend target used explicit SIGNOFF_TEST_DATABASE_URL selecting local `signoff_test_v3`.

| Command | Result / output |
|---|---|
| `uv sync --frozen --extra dev` | PASS 0; locked environment installed. |
| `make prepare-test-db VENV_PY=.venv/Scripts/python.exe` | PASS 0; repeated migration on disposable DB succeeds. |
| `make test-agent VENV_PY=.venv/Scripts/python.exe` | PASS 0; Ruff “All checks passed”; mypy “Success: no issues found in 96 source files”; import contracts 3 kept/0 broken; pytest 489 passed, one Starlette/httpx deprecation warning. |
| `make test-web` | PASS 0; ESLint clean; 28 files, 169 tests passed; no type errors. |
| `make test-types VENV_PY=.venv/Scripts/python.exe` | PASS 0; tsc clean, all domain enums match, client matches OpenAPI. |
| Python OpenAPI export + existing client generator, then Git diff of both generated files | PASS 0; byte-identical to committed versions. |
| `VITE_API_URL=http://localhost:8000 npm run build` | PASS 0; both apps built. Existing large merchant bundle warning remains. |
| `git diff --check` | PASS 0. |

Logs are local ignored files (`make-test-agent.log`, `make-test-web.log`, `build-fixed.log` under scratch/v3-audit). This table is the durable summary; raw logs may not exist in another workspace.

### Not verified / outstanding

- No GitHub CI run, Docker rebuild, browser E2E rerun, Render deployment, physical Android push, real LLM request, PayPal mutation or end-to-end hosted checkout in this T01 checkpoint.
- T00 still has explicitly unobserved protected/product/order/valid-approval states and missing deployed diagnostic/revision evidence; see its inventory. These do not make the old reported LLM defect a proven diagnosis.
- T02 owner authentication and readiness starts next. T03–T17 remain unimplemented. Existing deployed app still runs the old release.
- No commits/pushes made; preserve the working tree. Use START-HERE.md and the portable patch bundle for transfer rather than assuming a new checkout has these changes.
