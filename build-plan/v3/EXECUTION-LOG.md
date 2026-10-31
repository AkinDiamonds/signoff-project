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
- At initial T01 validation time there were no commits/pushes. The owner subsequently requested checkpoint pushes; baseline `07f1d7b` is now pushed to `origin/codex/signoff-v3`. Preserve any newer working-tree changes and prefer that branch over the earlier bundle.

## Checkpoint pushes authorized by owner

- Owner explicitly requested visible progress, durable tracking and checkpoint commits/pushes.
- Created `codex/signoff-v3` from the existing checkout; no worktree created and main not modified.
- Baseline `07f1d7b` pushed successfully and native Git verified the upstream. It contains the previous T01 changes and planning/handoff documents.
- CI now also triggers on `codex/**` pushes so checkpoints can be checked remotely. Do not assume a queued/configured workflow passed; report actual status when available.

## T02 — IMPLEMENTED locally; cross-site browser assertion OPEN

### Code and user-visible changes

- Owner login screen and protected merchant routes; Settings sign-out; no signup/email/recovery flow. Theme chooser no longer blocks first visits.
- Server-configured email/scrypt credential, random opaque eight-hour session cookies, hashed session rows and durable failed-attempt limits. Authentication is mandatory in production, including when owner configuration is missing; local/stub defaults preserve existing development workflow unless explicitly enabled.
- Production cookie requests HttpOnly/Secure/SameSite=None/Partitioned, without exposing it to JavaScript. CSRF required for merchant writes; cross-origin requests validated. Response cache controls protect private responses. Changing the password credential/email/approval secret invalidates old sessions; token values are not stored.
- Owner-only readiness endpoints distinguish configuration from successful observation, failed and stale checks; verify PayPal authentication and store policies only on explicit user check. No paid LLM requests. Last verified webhook and persisted worker presence are separate evidence. Changed credentials invalidate old connection observations.
- Replaced hardcoded connected badge, merchant identity, webhook address and false catch-path success in Settings. Policy link preserved; configurable missing-delivery behavior is not implemented yet.
- New additive migration `d18e6c2a9001` adds owner_sessions, login_attempts and integration_observations. No existing order, policy, execution or ledger row is rewritten.
- Removed the legacy production demo-token fallback; isolated tests/mocks use a separate explicit fixture capability and no longer inherit that build-time capability. The demo capability is not owner authentication. A pre-push scan detected a match to an already-committed fixture/default, not a newly injected server secret; changed source no longer carries that fallback.
- OpenAPI/client regenerated; protected-route HTTP status contracts updated. Production mock-fetch build forbidden. Global no-referrer policy protects sensitive links.
- Provision/reset instructions and release gates in OWNER-ACCESS.md; CLI via `make owner-password VENV_PY=.venv/Scripts/python.exe`. No real owner credentials provisioned or committed.

### Verification

| Check | Outcome |
|---|---|
| Guarded migration on dedicated local test DB | PASS; additive upgrade and existing migration round-trip suite executed. |
| Backend make target | PASS: 500 tests, Ruff, strict mypy (98 source files), three import contracts. One existing Starlette/httpx deprecation warning. |
| Frontend lint/tsc/Vitest | PASS: 178 tests across 30 files, no type errors. Includes anonymous redirect, rejected login, session-retention failure, CSRF transport and truthful check failure UI. |
| Enum/client parity | PASS; generated contract matches exported spec. |
| Both production builds | PASS using local API URL; existing large merchant bundle warning remains. |
| Browser | PARTIAL/OPEN: actual local phone-width login screenshot; anonymous redirect and login reached protected Settings. Combined cookie metadata assertion failed twice. Reload/logout steps after assertion NOT RUN. |
| Physical Android / Render deployment | NOT RUN. |

### Exact browser blocker and next action

The script failed at `!owner?.httpOnly || !owner.secure || !owner.partitionKey` after waiting for Settings and its worker section. It did not save the returned cookie metadata. A missing attribute, API reporting limitation, interception artifact or actual rejection has NOT been established as the cause. Do not invent one.

First attempt used route.fetch; second forwarded via native HTTP to avoid the test client's cookie jar and used separate reserved HTTPS sites. Both used local ports 8042/5176 and fictional credentials with a separate local preview DB. No Render requests or financial mutations. Browser retries stopped/reported under AGENTS.md's two-failure instruction. Next diagnosis must collect safe attribute metadata and compare actual browser behavior without printing values or weakening assertions. The screenshot predates the final scrypt work-factor adjustment; it proves interface appearance, not final release authentication.

Persistent screenshot/summary: `evidence/t02/`. Raw ignored files: `scratch/v3-audit/owner-browser.mjs`, `owner-browser.log`, `t02-agent-checkpoint.log`, `t02-web-final.log`, `t02-build.log`. Summaries above stand alone if scratch is absent.

This checkpoint is on a feature branch and is not release-ready until the cookie assertion is resolved and Render owner settings/migration are prepared. Main/Render remain on the old release. Next product tasks after T02: T03 transaction/order matching, T04 automatic/manual simulated fulfilment, T05 evidence provenance/UI.
