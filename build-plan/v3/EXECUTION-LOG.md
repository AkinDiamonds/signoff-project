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

This checkpoint is on a feature branch and is not release-ready until the cookie assertion is resolved and Render owner settings/migration are prepared. No main merge or Render deployment was initiated; hosted revisions have not been re-verified. Next product tasks after T02: T03 transaction/order matching, T04 automatic/manual simulated fulfilment, T05 evidence provenance/UI.

### T02 push confirmation

- Commit `20f24fb2e3ecfe93d2e6002710275df9cd3f4e48` (`feat: add protected owner access and observed integration status`) pushed successfully to `origin/codex/signoff-v3`; native `git ls-remote` confirmed that exact SHA.
- GitHub Actions run https://github.com/AkinDiamonds/signoff-project/actions/runs/41211299897 was observed `in_progress` with no conclusion. Do not report remote CI as passed. A following tracking-only commit can trigger a newer run; check the latest branch head/run before reporting status.
- Local checkpoint suite: 500 backend / 178 frontend tests, lint/types/import/parity and both builds PASS. Combined browser cookie attribute assertion remains unresolved, unchanged and not suppressed.
- Readable visual evidence is committed under `build-plan/v3/evidence/t02/`; screenshot is local phone-width Chromium, not Render or a physical Android phone.

## T02 resumed — fresh fixture prepared; browser runtime unavailable (2026-10-31)

- Initial checkout: clean `work` at `fd9c2b7`, only local branch, no `d491e61` object. Ordinary Git fetch failed to connect to the runtime proxy (exit 128); network-enabled fetch succeeded (exit 0). Switched to `codex/signoff-v3` at remote `d491e61`; no resets, force-pushes, worktrees or unfamiliar work overwritten.
- Read required handoff/current T02 plan and inspected `auth.py`, owner tests, session transport and installed Chromium cookie-reporting implementation. Production source requests HttpOnly/Secure/SameSite=None/Partitioned. Installed Playwright 1.64.1 maps CDP partition metadata. Neither source inspection establishes what the prior browser actually stored.
- `uv sync --frozen --extra dev` initially failed (exit 2) because default cache is read-only. With repository-local `UV_CACHE_DIR`, locked sync succeeded (exit 0). No dependency added.
- Verified existing `signoff-postgres`. Fresh disposable `signoff_test_preview` and `signoff_test_v3` created (exit 0). Guarded preview migration succeeded (exit 0), including `d18e6c2a9001`. No inherited DB used. Test-v3 DB remains unmigrated; full checks not run.
- Started fresh-source production-mode API at 8042, Vite at 5176, fictional owner/config only, mocks off. No worker or provider requests. Native HTTP forwarding probe restricts traffic to reserved merchant/API sites and these local ports. Portable sources committed under `evidence/t02/diagnostics/`; working scripts/logs under ignored `work/`.
- **Browser run attempt 1: FAIL exit 1** before navigation: default `chromium_headless_shell-1248` executable missing.
- **Browser run attempt 2: FAIL exit 1** before navigation after selecting full Chromium explicitly: `chromium-1248/chrome-linux64/chrome` missing. Stopped and reported the two failures under `signoff/AGENTS.md`. No filesystem hunt, alternate environment, authentication bypass or cookie-assertion weakening.
- No cookie metadata, new screenshots, retained-session/reload/logout observation or diagnosis-backed product correction. Original failed combined cookie assertion remains UNKNOWN. Full local backend/frontend/lint/type/import/build checks NOT RUN this session; prior local results remain historical.
- GitHub connector observed CI runs `41211299897` (`20f24fb`) and `41211594512` (`d491e61`) both **completed/success**. No Render deployment or main merge.
- Next: install matching Chromium, then resume the stopped probe after this report. Probe now preflights executable availability. Capture safe metadata first, retain all assertions and complete anonymous redirect/login/reload/CSRF/logout/post-logout denial before T02 completion or T03 progression.
- Running previews: exec sessions 98403 (API) and 52666 (Vite). No new secrets provisioned. Handoff/progress/evidence/status and diagnostic fixture sources comprise this checkpoint; no production behavior changed.
- Diagnostic JavaScript ESLint, Node syntax check and `git diff --check`: PASS exit 0. Browser execution remains blocked; these checks do not validate cookie behavior.
- Diagnostic checkpoint `88b2b7cc71034d7377b8073003c5683065eb2966` pushed successfully; native `git ls-remote` confirmed the exact remote SHA. Tracking-only commits may follow.
- Its CI run https://github.com/AkinDiamonds/signoff-project/actions/runs/41213129730 observed `in_progress`, conclusion null; not yet a confirmed pass.

## T02 — PASS locally, real HTTPS cookie diagnosis (owner resumed)

- Owner instructed continuation after the launch-failure report. Default-cache browser installation stalled; terminated that owned installer and installed matching Chromium/FFmpeg/headless shell in writable `work/browsers` (exit 0). No browser/dependency version changed.
- Reproduced the original combined assertion once with safe metadata: HttpOnly=true, Secure=true, SameSite=None, partitionKey=null. Set-Cookie attribute booleans were all correct, including Partitioned/host prefix/no Domain. UI login and retained-session requests had passed before this assertion. Safe failed report committed as `cookie-metadata-route-fulfill.json`.
- Added native local HTTPS fixture, keeping the assertion intact. It uses two separate HTTPS sites on port 8443, native forwarding only to local 5176/8042, a generated local certificate trusted by exact SPKI, and explicit proxy bypass for those two loopback-only reserved names. No privacy flags disabled, session injected, route.fetch cookie jar or production auth change.
- First native transport navigation failed with `ERR_TUNNEL_CONNECTION_FAILED` before login (exit 1); diagnosed inherited proxy handling and added fixture-host-only bypass while preserving the proxy for other names. Second native run **PASS exit 0** on Chromium 156.0.8078.4 / Playwright 1.64.1.
- Playwright reports expected partition key `https://signoff.test`; CDP independently reports that topLevelSite and `hasCrossSiteAncestor=true`. Both report HttpOnly/Secure/SameSite=None. Complete UI flow PASS: anonymous redirect, login, retained session, reload, no-CSRF logout 403, UI logout 204, protected API 401 and login redirect after logout. Persistent safe metadata/screenshot under `evidence/t02/`.
- Diagnosis-backed correction is in the **diagnostic transport**, not application cookie flags. Response fulfillment creates the observed missing-partition result; real HTTPS succeeds with the same cookie implementation. No claim about precise Chromium internal cause. Local test TLS trust is scoped to the fixture key.
- Guarded migration of dedicated `signoff_test_v3`: PASS 0. Owner-auth targeted tests: 11 passed. Full backend `make test-agent`: PASS 0, Ruff clean, strict mypy 98 files clean, import contracts 3 kept/0 broken, 500 tests. One existing Starlette/httpx deprecation warning.
- Initial `make test-web`: FAIL 2 at ESLint because freshly downloaded browser vendor scripts in `work/browsers` were included. Added `work/**` to scratch lint exclusions and `work/` to Git ignores; production lint coverage unchanged. Rerun `make test-web`: PASS 0, 178 tests/30 files, TypeScript clean. `make test-types`: PASS 0, enums/client freshness. Both production builds: PASS 0 with local API URL; existing merchant bundle-size warning remains. Targeted diagnostic ESLint/syntax and final whitespace checks also run.
- No Render merge/deployment, production owner provisioning, physical Android observation, real PayPal/LLM request or hosted purchase journey. T02 now passes locally; those release proofs remain T14–T17 gates. Next task T03 capture/order correlation, beginning with fail-closed validation and parser regression tests.
- Fresh current-source previews remain: API exec 76279/PID 4881 at 8042; Vite exec 74599 at 5176 with API HTTPS URL including 8443. TLS listener is closed after probe. No worker/provider requests.

## T03 — capture-validation checkpoint (IN PROGRESS)

- Added failure tests first: old implementation produced 29 failures/11 passes (exit 1), including fabricated success without captures, caller-supplied order substitution, failed/pending capture promotion, currency and malformed-money handling.
- New strict checkout payment boundary requires a matching completed PayPal order, exactly one completed capture with a nonempty ID, string decimal amount with at most two decimal places, expected amount and currency. No fabricated capture IDs or fallback amounts. Capture and GET-only reconciliation share the validator. Caller IDs must match the server-recorded link before even the paid-order idempotent return; missing/conflicting links fail closed.
- Existing mock capture/recovery fixtures now explicitly state capture COMPLETED; this is newly required payment proof, not a loosened assertion. PayPal stub already emits that field. No gate/executor semantics, ledger history or external provider mutations changed.
- Targeted green run: 53 passed (exit 0). Full backend make target: PASS 0; 540 tests, Ruff, strict mypy 99 files, three import contracts. One existing Starlette/httpx deprecation warning. First targeted Ruff run found one overlong test line; corrected before passing the full target.
- Read official PayPal Orders OpenAPI from `paypal/paypal-rest-api-specifications/main/openapi/checkout_orders_v2.json` into ignored work storage for the remaining merchant/idempotency work. It defines purchase-unit payee merchant ID, completed capture status, and request idempotency headers. No new dependency.
- T03 remains IN PROGRESS: explicit durable payment identifiers/intents, merchant validation/scoping, stable request IDs/concurrent/restart reconciliation, one unambiguous agent/UI resolver, buyer payment references and deployed sandbox proof remain. Do not call the task complete on the strength of these tests.

## T03 — shared transaction-resolution checkpoint (IN PROGRESS)

- Capture-validation commit `54fbf66463a97fb08373b3a57e9186eca6239d77` pushed and native remote-confirmed. GitHub CI success: run 41214139961. T02 HTTPS proof `077af41` also confirmed CI success, run 41213822073.
- New shared resolver used by merchant list/detail and agent context. It considers all disputed transactions, prefers a known seller reference within each transaction, falls back only to a store-known buyer reference, and rejects different-order matches across transactions. It never matches by email/amount. Raw stored snapshots and typed PayPal transactions follow the same logic.
- Duplicate legacy transaction mappings are detected rather than selecting a first row. Store endpoint returns ORDER_AMBIGUOUS/409; HTTP adapter preserves ambiguity. Agent ambiguity/unavailable outcomes stop before planning/execution and record distinct human-review reasons. Merchant APIs expose found/not_found/ambiguous/unavailable as `order_resolution` with regenerated OpenAPI/client.
- Tests cover buyer/seller mismatch, later transactions, alias deduplication, conflicting orders, duplicate DB mappings, unavailable store, merchant list/detail/local adapter parity and agent fail-closed ambiguity. Initial test-first collection failed on missing new resolver/exception (exit 2). Resolver/adapter/loop focused checks: 34 passed. Expanded resolver integration: 14 passed. A restricted-network run stalled before in-process TestClient calls; terminated that owned test process, reran with network permission and a diagnostic timeout, and it passed in 0.62s without a code workaround.
- Full backend make target PASS 0: 555 tests, Ruff, strict mypy 100 source files, 3 kept/0 broken import contracts. Targeted lint caught import/generic syntax then one newly added long test line; corrected before the full target. No suppression or rule weakening.
- First frontend run: 178 runtime tests passed but Vitest typecheck reported an unhandled typecheck error. Standalone type target revealed missing new required `order_resolution` in five UI fixtures. Updated those fixtures to `found`, preserving existing assertions. Rerun frontend PASS 0: 178 tests, lint/tsc clean. Type target PASS 0: enums/client freshness. Build result follows below.
- T03 still requires durable explicit payment IDs/intents, merchant binding/scoping, stable request idempotency and concurrency/restart proof, buyer payment references, and later real hosted sandbox purchase verification. No T04–T17 work or Render deployment claimed.
- Both production builds PASS exit 0, existing merchant size warning only. `git diff --check` PASS 0. No test/lint/type failure suppressed.

## Owner-confirmed PayPal journey and incremental main release preparation

- Owner explicitly reconfirmed: separate shop → PayPal-hosted checkout → buyer separately uses PayPal Resolution Center → verified webhook → seller app. Buyers do not report disputes in Signoff. Updated owner decisions and T16 to make that the required real journey.
- Owner stated existing Render services auto-deploy main and authorized pushing the latest tested compatible source to main. No Render reconfiguration/creation requested. Owner subsequently confirmed generated MERCHANT_EMAIL/MERCHANT_PASSWORD_HASH were installed and the existing service redeployed. Credential generation/verification occurred only in private ignored storage; no password/hash printed, committed or captured in screenshots.
- Durable payment commit `d247d09`: explicit nullable order/capture IDs and capture-attempt timestamp; pre-I/O intent commit; stable operation-specific PayPal request IDs; uncertain capture retries reconcile with GET; matching completed order/capture, exact decimal amount/currency, optional returned payee merchant check; single transactional finalization/tracking winner across concurrent sessions. Tests cover timeout/restart, local commit failure after remote success, concurrent initial capture and concurrent recovery. Order detail exposes payment references behind existing code/email authorization. No speculative legacy backfill/uniqueness constraint.
- Startup/migration commit `3239bb9`: API/worker serialize forward release migration using shared PostgreSQL advisory lock and existing-connection Alembic support. Failed migration prevents process startup. `e42b7d910002` adds nullable checkout fields. `f53c8ea20003` expands the existing ledger event constraint to include already-defined DISPUTE_POOLED; no financial history rewrite/delete and append-only triggers unchanged. Added actual migrated-constraint parity and concurrent release/data-preservation tests.
- Shop old dispute/reply routes now show PayPal Resolution Center guidance. Order tracking no longer calls buyer-dispute APIs or hosts case messages. Legacy buyer API fixtures require test+stub; production/local sandbox requests fail 404 before handler DB access. Development direct-capture/demo shortcuts require explicit VITE_STUB_CHECKOUT and are disabled by production DEV=false. Official PayPal SDK approval is required before ordinary capture. Public sandbox instructions no longer advertise fake buyer credentials or app dispute shortcuts.
- Production sync no longer parks normal merchant disputes awaiting a judge claim, even if a legacy demo-hold variable remains set. Demo hold remains available in non-production fixtures. Regression confirms normal merchant webhook queues one agent run; signing policy/gate/executor limits are unchanged.

### Checks and failures preserved

- Capture-intent test-first run: FAIL 1, 5 failed/40 passed on old source. After implementation, targeted capture/shop 58 passed; additional recovery/creation/merchant tests and migration/boundary tests added subsequently.
- New release/migration/buyer-boundary focused run: PASS 0, 59 tests. Full backend intermediate runs: 563, 571, 575, then 577 tests; final current-source `make test-agent`: **PASS 0, 578 tests**, Ruff, strict mypy, 3 contracts kept/0 broken. Existing Starlette/httpx deprecation remains.
- Initial buyer-flow frontend run: FAIL 2 (177 passed/2 failed), because new legacy-route tests incorrectly disallowed even the global catalog GET. Corrected to forbid dispute requests/writes while allowing ordinary catalog GET; no buyer-write assertion removed. Final `make test-web`: **PASS 0, 179 tests/30 files**, no type errors and ESLint clean. `make test-types`: PASS 0 (tsc, enum/client freshness). Both production builds: PASS 0; existing merchant bundle-size warning remains. Final whitespace check PASS.
- Full local E2E attempt 1: interrupted after failures (exit 130); inherited DEMO_HOLD_DISPUTES/alias configuration parked fixtures and migrated PostgreSQL rejected existing DISPUTE_POOLED event. Cleared all inherited Settings names/aliases before supplying explicit local stub settings; added regression and forward constraint migration. Only dedicated local signoff_e2e was recreated; shared DATABASE_URL not used.
- Full local E2E attempt 2: **FAIL 1, 8 passed/4 failed**. Pipeline executions/injection/repeat-disputer approval/webhook dedup/poller/kill-switch/security and PayPal handoff checks reached valid results, but A/C stopped at missing visible verdict test hook, B expected a hidden compatibility hook to be visible, and LLM-failure fixture requested $64 against current server-priced $24 order (422 correctly rejected).
- Corrected the visible verdict/KPI hooks and derive the failure fixture amount from authorized order data; assertions preserved/strengthened. Full local browser retries stopped/reported under two-failure rule; corrected cases are **NOT claimed locally passed**. Remote main CI/deployed observation must supply their next result. No assertions deleted, auth bypassed, privacy disabled or tests against deployed DB performed.
- Local Docker socket required network-enabled execution; verified managed daemon/local postgres before stack use. Stale initial PID file referenced no live processes and was preserved before starting owned fixture processes. No unrelated process killed.

### Release state and remaining work

- main remote `fd9c2b7` verified ancestor of working release; no force push/reset/worktree required. Complete source release is being committed/pushed to codex/signoff-v3 before the owner's authorized main auto-deploy step. Actual push/CI/live results must be appended after observation.
- Release migration/rollback and compatibility instructions are in RELEASE.md. Current source startup can apply forward migrations under lock with existing Render commands; do not run disposable test helpers against Render or downgrade financial history.
- T03 still needs final legacy merchant scoping/verified aliases and real hosted purchase-to-dispute correlation proof. T04 automatic/manual simulated shipping, T05 evidence policy/provenance, T06–T13 remaining product work, notifications/inbox/Android push, and complete T16/physical-phone proof remain open. This release is incremental, never full-product completion.

### First main rollout and fresh-CI PostgreSQL readiness correction

- Complete compatible release `e2fe052cbe81e49e3982c40efc9142f6948e80c1` pushed and native remote-confirmed on codex/signoff-v3. GitHub CI run 41232606760 **completed/success**, including backend, frontend, types/freshness, OpenAPI, both builds and gitleaks.
- Owner-authorized fast-forward push to main succeeded from fd9c2b7 to e2fe052; native ls-remote confirmed both refs. Existing Render auto-deploy used; no service/cloud configuration recreated.
- Public polling subsequently observed the new API auth/session endpoint with required=true/configured=true and new checkout payment-reference contract. Merchant/shop new bundle markers still pending at that observation; a push is not being described as all services live.
- Automatic main E2E run 41232806731 **failed before browser tests** at Docker psql fixture reset (exit 2), because compose up -d returned before PostgreSQL was ready in a fresh runner. No browser assertions executed. Main default CI run 41232806713 was still running when checked.
- Added Docker Compose --wait/--wait-timeout 60 before any dedicated fixture DB reset. Existing compose healthcheck uses pg_isready; installed Compose advertises both wait flags. This is a separate readiness fix, not another local full-browser retry. Local full-suite retries remain stopped/reported; fresh remote CI must supply the corrected browser result.

### Render behavioral verification and final buyer-offer test alignment

- Main/source readiness fix `c395bd62a275a4bb77776ebb46142bc0e1397a95` pushed and native remote-confirmed. Main standard CI run 41233002322 **success**. Main e2fe052 standard CI 41232806713 also **success**.
- API new owner/session and payment-reference schema, merchant login bundle and separate shop PayPal-handoff bundle all observed live on public Render URLs.
- First deployed browser probe failed at anonymous navigation before credentials were entered because the managed proxy certificate was not trusted by Chromium. Anonymous-only network diagnostic identified ERR_CERT_AUTHORITY_INVALID; credentialed CORS already passed. Added trust scoped to the supplied managed proxy CA's SPKI; no global TLS ignore or browser privacy switch.
- Deployed browser verification **PASS exit 0** on desktop Chromium at 390×844 (not physical Android): anonymous redirect; configured/required owner login; retained session; Secure/HttpOnly/SameSite=None cookie with partitionKey=https://signoff-web.onrender.com; authenticated reload; missing-CSRF logout 403; UI logout 204; protected API 401 after logout. Separate deployed shop old buyer-dispute URL shows external PayPal Resolution Center, no form and no demo/direct-capture shortcut. Private credentials never printed; account email masked in Settings screenshot.
- Live readiness returned worker=verified with fresh heartbeat 2026-10-31T19:13:32Z, webhook=verified, PayPal=configured and LLM=configured. These configured provider states do not prove a fresh provider call, valid live plan or new full purchase-to-execution journey.
- New remote E2E run 41233002330 reached browser tests: **11 passed/1 failed**. The sole remaining failure was scenario C's obsolete final Signoff buyer-portal offer-acceptance step. Its edited merchant phone approval, gate/execution ordering, confirmed $20 PayPal-stub offer and single-use-link assertions had passed. Updated only the obsolete buyer step to require the external PayPal handoff and absence of local offer acceptance. No financial assertion removed.
- Deployed shop phone-width screenshot exposed header overflow. Added flex wrapping/gaps to prevent navigation from exceeding the narrow viewport; no product-flow change. Final follow-up CI/rollout observations follow after the next push.

### Complete remote browser pass; obsolete pip-cache cleanup fix

- Offer-handoff test `aac671a` and narrow shop header `fac224f403532c1b18d8c9470ebdc9b97b70f092` pushed to both checkpoint branch and main, native remote-confirmed. Targeted ESLint, TypeScript and whitespace checks PASS.
- Main remote E2E run 41233347487: **all 12 browser tests passed in 16.2s**, including merchant phone-width edited approval, confirmed offer, single-use link, injection/resilience/security and PayPal-only buyer handoff. The workflow was nevertheless marked failure solely in **Post actions/setup-python**: pip cache directory does not exist because dependencies use uv.
- Removed obsolete setup-python cache=pip settings from both E2E jobs; retained locked uv installation and all browser assertions. This workflow-only cleanup fix does not change application behavior. Final workflow status must still be observed after push.
- Deployed shop layout verification PASS: 390px content width equals 390px viewport, external PayPal handoff remains present, no horizontal overflow. Screenshot is desktop Chromium on Render at phone width, not physical Android.

### Final release checkpoint — main and Render verified

- Latest main code/workflow checkpoint **1c772d7acffe69048dcb8c6fa4f6f8c6b783e304** pushed to main and codex/signoff-v3, native remote-confirmed. No force push, reset, worktree or Render/cloud reconfiguration.
- Main standard CI https://github.com/AkinDiamonds/signoff-project/actions/runs/41233591393 **completed/success**.
- Main full E2E https://github.com/AkinDiamonds/signoff-project/actions/runs/41233591407 **completed/success**, with all 12 browser tests passing. The earlier local failure/retry history is preserved; no additional local full-suite retry claimed.
- Safe live evidence saved in `evidence/release-2026-10-31/`: owner/session/cookie/CSRF/logout report, fresh worker observation and phone-width PayPal-handoff screenshot/layout metrics. No passwords, credential hashes, session/CSRF values, authorization headers, raw browser trace or real owner email included.
- Final handoff/evidence-only commit follows on codex/signoff-v3, without another main push/application rebuild. Main's latest application behavior is already observed live. Inspect actual branch log/remote for this tracking commit; it does not supersede main's tested code checkpoint.
- Remaining: actual fresh sandbox purchase and buyer-filed PayPal Resolution Center dispute correlation/provider/gate/execution proof; T03 final legacy merchant scoping/alias checks; T04 automatic/manual simulated fulfilment; T05 evidence policy/provenance; remaining notifications/inbox/Android push/mobile/full-journey tasks through T17. This incremental release is ready for the owner's sandbox purchase test, not whole-product completion.

## T03 merchant/demo scope and canonical capture references

- Fresh continuation began clean at f6e321c on codex/signoff-v3; fetched both remote refs without reset or overwriting work. Existing main release remains 1c772d7.
- Regression first: 2 failures on old source proved cross-merchant/demo matches became ambiguous and explicit canonical capture IDs were ignored. New shared server-owned OrderScope restricts merchant and exact demo identity; production with missing merchant configuration fails closed. Agent and merchant list/detail bind the same scope; store shipment/message reads use it too.
- Canonical paypal_capture_id wins. A conflicting legacy transaction field is no longer treated as a verified alias, and pure order snapshots expose the canonical reference. Legacy records without a canonical capture retain exact-ID lookup only; no guessed backfill or new uniqueness constraint.
- Production checkout ignores caller-supplied demo tags, preserving the normal separately hosted shop/PayPal/webhook journey. Local stub fixture tagging remains available.
- Focused resolver/adapter/agent run: 40 passed. Full backend at first checkpoint: 581 passed. Later expanded scope tests found a response-contract mismatch introduced for missing-message resources; restored the existing empty-list contract while asserting no private foreign-order message is exposed. Focused resolver/store/capture contract run: 74 passed. Type/enum/client checks PASS. A full run before that restoration had 581 passed/1 failed; preserved in work/t03-scoping-checkpoint.log. Current full verification will run again with T04.
- Initial strict mypy rejected a lambda default used to bind the loop scope; replaced with functools.partial, with no suppression. Latest source lint/types pass. T03 real fresh PayPal purchase/dispute proof remains for the deployed journey; implementation now continues to T04.

## T04 persistent simulated fulfilment — 2026-10-31

- T03 618ed19 pushed and remote CI 41235565425 completed/success. Main still 1c772d7 before this release.
- New forward migration a64d9fb30004 creates one shipment identity/version/schedule per new verified paid order; no legacy/financial/tracking/run-history rewrite. Captures atomically record PRE_TRANSIT and schedule progression; worker advances actual-time milestones about once a minute. No catch-up fabricates past timestamps. Existing DISPUTED status is preserved.
- Owner-only, CSRF-protected list/actions and merchant `/app/shipments`: paid/canonical capture required, merchant/exact demo scope, expected version, UUID idempotency, legal transitions and terminal lock. Missing-tracking/exception pause; resume is explicit. Scenario choices lock once a PayPal dispute exists, normal milestones may still advance without submitting/rerunning a dispute. No real carrier requests.
- Shop exposes the same persistent stages/source/schedule with simulation labels. Tracking eligibility excludes early/future records; missing/exception modes require human review. Invalid/missing/naive HTTP occurrence times raise StoreUnavailable rather than substituting now. T05 configurable policy/complete typed provenance snapshot is still pending.
- Test-first missing module failed collection (exit2). Initial core had 9 pass/1 fail because SQLite evaluates naive/aware datetimes in ORM UPDATE synchronization; switched to database RETURNING/fetch synchronization. Subsequent capture/shipping tests 73 pass. Expanded evidence tests initially missed required reason argument (86 pass/2 fail); corrected the test calls. Fulfilment/auth tests 27 pass including two real PostgreSQL sessions racing, wrong scope, stale/duplicate actions, schedule/restart, time guards and owner/CSRF rejection. Initial full check stopped on unused import; removed it. No assertions weakened.
- Final `make test-agent`: PASS, **598 tests**, Ruff, strict mypy (105 files), 3 import contracts/0 broken. `make test-web`: PASS, **185 tests /31 files**, ESLint/types. `make test-types`: PASS (tsc, enum parity, generated client freshness). Both production builds PASS; whitespace PASS. Existing Starlette deprecation and bundle-size warning remain. Safe local logs are ignored in work/t04-*.
- Native local HTTPS browser PASS on current source: owner login, manual milestones through delivered, persisted reload, terminal advancement disabled, missing tracking, resume, exception, 390px no horizontal overflow. Screenshots/report in evidence/t04. Desktop Chromium 156, not physical Android; no provider payment/dispute created. Screenshot pass separately reset scroll to top.
- Preview restart initially found owned prior API on8042; stopped verified owned PID4881 and restarted current source (exec76181), isolated signoff_test_preview. Vite5176 remains owned. Schema migration successfully applied only to dedicated local test/preview databases; inherited DATABASE_URL never used for tests/seed/migration. No Render config changes.
- This checkpoint is prepared for branch push/CI then authorized fast-forward main/Render auto-deploy. Observe actual results before claiming the new release deployed. Next implementation is T05 evidence and merchant policy; real sandbox purchase → separate PayPal Resolution Center dispute → webhook/model/gate/execution and physical Android remain pending.

### Pre-release unsafe-tracking stop

- Review before main promotion found that unusable INR tracking alone did not stop other LLM-proposed actions: INR intentionally permits planning without buildable delivery evidence. Added explicit pre-model human review for tracking_unavailable_reason, covering both supported reasons and preventing any execution job. This preserves the gate and follows the owner's default human-review decision; generic missing-evidence policy is still T05.
- Test-first two failures reached the provider path on old source. Corrected the fail-if-called mock to match generate and the execution job enum; final full backend **600 passed**, Ruff/strict mypy/3 import contracts PASS. Frontend/source schemas unchanged from already-passing 185 tests/types/builds/browser check. Checkpoint 9901b48 is not promoted alone; the correction follows before main.

### T04 push, CI and Render observation

- Shipping checkpoint 9901b48 pushed; its in-progress CI was superseded/cancelled by correction 1930967. Correction branch CI 41236978982 completed/success (all source checks/builds/secret scan). Authorized fast-forward main 1c772d7 → 1930967 succeeded; native ls-remote confirmed both main/codex source refs at 1930967eab74ed0e6b51eb9d0313bcbf94b1cfae. No force/reset/worktree or Render configuration changes.
- Main CI 41237185691 and full E2E 41237185727 both completed/success. Remote log confirms 12 passed (22.6s). No new full local E2E retry; earlier local failure history preserved.
- Existing Render auto-deploy observed new shipping OpenAPI/API, merchant and separate shop bundles. Actual owner browser PASS: anonymous redirect, configured owner, sign-in/session/reload, Secure/HttpOnly/SameSite=None/Partitioned cookie, missing-CSRF logout 403, shipping page/GET 200/count 0/390px no-overflow, logout 204/access 401, separate PayPal-only shop handoff. Fresh worker heartbeat 20:07:45UTC verified; existing verified webhook receipt remains. PayPal/LLM only configured, no fresh transaction/provider execution or physical Android claim.
- First deployed probe reached/screenshot shipping page but timed out attempting a Settings-only logout button after navigating to Shipments; an unhandled pending wait prevented writing the first report. Corrected probe to return to Settings and await click/response together. Second attempt PASS; no application changes/assertion weakening/privacy bypass. Safe final report and screenshot are in evidence/t04.
- Actual deployed shipment list empty: fresh hosted sandbox purchase is needed before claiming deployed milestone progression. Local paid fixtures/core/worker/concurrency/browser evidence supply implementation proof. Existing paid histories intentionally unchanged. Next implementation: T05 saved evidence/provenance plus merchant missing-evidence policy. Fresh PayPal Resolution Center→webhook/model/gate/execution and physical Android/push remain open.
- This final handoff/evidence-only checkpoint follows the tested main application source; it will be pushed to codex/signoff-v3 without another main auto-deploy. Owned preview API 8042 current shipping source (exec76181), Vite5176; ignored private credentials and preview material remain uncommitted.

## Durable approval fix — 2026-11-01

- Live dispute PP-R-MYR-10195637 had a pending PROVIDE_EVIDENCE decision under G5-01, but the UI invented a mock approval link because raw tokens were held in a separate worker process. Read-only inspection confirmed the actual order correlation and no approval URL.
- Source f87e538 adds owner-authenticated durable approval card access by database ID, reusing existing locked resolution, expiry, freshness, and gate checks. The detail page no longer invents mock links or claims active analysis after the gate; timeline displays proposed action types and no longer claims notification delivery.
- Local checks: 605 backend, 186 frontend, types and both builds pass. Branch CI 41349569873 passed; main fast-forwarded to f87e538 and auto-deployed. Render browser verification opened the existing dispute's actual review card, with its pending PROVIDE_EVIDENCE action and G5-01 visible through the API; no approval or PayPal mutation was performed.
- Initial backend run had one test fixture SQLite thread-affinity failure; corrected the fixture for TestClient and focused 39 tests plus full 605 passed. Fresh full PayPal execution, evidence provenance, and physical Android remain pending.

## T05 evidence work started

- Removed unsupported high-strength, delivered, carrier and matching-postcode claims from the merchant evidence panel when data is absent. The panel now displays only recorded values or marks them unavailable.
- Frontend suite: 186 passed; TypeScript, enum parity and generated client freshness passed. Durable per-run evidence snapshots, policy configuration and full T05 remain outstanding; this is not deployed yet.

## T05 saved evidence increment — 2026-11-01

- Migration b75e0ac40005 adds one append-only evidence snapshot per new model run. Snapshots contain order/payment references, amount/items, tracking record IDs/source/times, evidence eligibility/notes, score and explanatory components. No historical evidence is backfilled. PostgreSQL rejects UPDATE/DELETE; a dedicated local migrated-PostgreSQL test verifies both.
- Snapshot is created with the run. Retries compare a stable content hash; changed evidence stops for human review instead of rewriting the prior snapshot. Legacy runs without snapshots remain unavailable. Early exits before a model run (such as store outage or unsafe tracking) still surface through the existing audit ledger and do not produce a snapshot.
- Merchant-only dispute evidence endpoint and page show saved runs and distinguish simulated tracking and submission preview from PayPal confirmation. Existing disputes with no snapshot are labeled accordingly. No evidence is submitted by this feature.
- Final local checks: 607 backend tests, Ruff, strict mypy, import contracts; 187 frontend tests, ESLint, type/client/enum freshness; PostgreSQL migration and trigger test; both production builds. A first frontend run failed when a test mock returned an object where the endpoint requires an array; response validation now fails visibly instead of crashing and the rerun passed. New screenshot-specific UI test passed after final wording changes.
- This is the saved-evidence increment, not the complete T05 policy: missing-evidence merchant configuration, snapshots for pre-model exits, explicit refresh/re-evaluation and fresh hosted end-to-end proof remain. Existing provider/gate/executor semantics are unchanged.

### Saved evidence release observation

- Branch CI 41350964699 completed/success. Authorized fast-forward main f87e538 → 712b14f0900642d2f04fe66e116d15ab22a8012e; existing Render auto-deploy used without configuration changes. New OpenAPI endpoint and web bundle observed; authenticated Render GET for PP-R-MYR-10195637 returned 200 and zero snapshots, and browser showed the correct unavailable message. No PayPal mutation, owner approval or invented historical evidence.
- Main E2E 41351211424 completed/success: 12 passed. Main standard CI 41351211495 also completed/success. Fresh model-run snapshots and actual provider submission remain unproven on deployed data. Local 607 backend/187 frontend, dedicated PostgreSQL trigger/migration, types and builds pass; desktop Chromium viewport, no physical Android claim.

## Missing-delivery policy work in progress — stopped on verification rule

- Uncommitted work adds a versioned HUMAN_REVIEW/GATED_SETTLEMENT charter choice, defaults to human review, filters opt-in plans to settlement actions before the unchanged gate, and adds settings UI and a visible review state. Invalid timestamps, exceptions and unknown orders remain human review. Focused policy/agent tests passed: 28 tests, including over-limit settlement requiring approval.
- `make test-web` failed twice: first on a now-corrected lint assertion; second with an unhandled Vitest `Typecheck Error` despite 188 tests passing and no reported TypeScript errors. Per signoff/AGENTS.md's two-failure instruction, stopped without another retry. The current UI edits after that run are unverified.
- Concurrent `make test-agent` completed 611 passed/1 failed: legacy `test_scenario_b_end_to_end_walking_path` still expects automatic execution for in-transit scenario B, conflicting with the newly required default human review. The browser B scenario was updated to expect review but has not been run. Update the legacy walking-path expectation without weakening the safety assertions, then run verification when the stop rule can be resolved. No changes committed or deployed; main remains 712b14f.
- All other plan work, including full UI/copy, notifications, mobile push, provider execution and live/physical device proof, remains open.

## Missing-delivery policy checkpoint — resumed with owner override

- Owner explicitly authorized overriding the two-failure stop rule for this task. Diagnosed Vitest's unhandled typecheck error: three typed fixtures omitted the newly generated policy field; updated them. Legacy scenario B walkthrough now asserts review and no execution for in-transit tracking. Previous failed logs remain in work/missing-policy-*.
- Added versioned charter choice HUMAN_REVIEW (default for old/new configurations) or GATED_SETTLEMENT. Missing proof routes to review by default; opt-in admits only settlement actions to the existing gate. No order, invalid timestamps, unsupported tracking, exceptions or contradictory withheld tracking always require review. Empty/rejected plans without delivery proof return to human review. This does not change gate rules or permit evidence to be invented.
- Signing-limits UI offers the setting and retains it across reload; dispute detail clearly shows review instead of a misleading active-analysis banner. Buyer continues to file only in PayPal Resolution Center.
- Full backend 612 passed before final additional safety tests; final focused policy/loop tests 30 passed. Full frontend 188 passed, types/client/enum freshness and both builds passed; Ruff/mypy pass. Full local cross-app first run 10 passed/2 failed because LLM-failure and security fixtures had in-transit orders; updated them to advance fictional simulated shipment before dispute so their original failure/security assertions still run. Second full local cross-app run 12 passed. In-transit scenario B separately asserts review, no intended/confirmed execution, and the merchant UI state.
- Remaining T07 work includes verifying current policy and PayPal state at execution time and recovery after uncertain provider operations. Do not describe the full plan or physical Android/provider journey as complete.

### Signing-policy freshness guard

- A test-first check exposed that queued decisions could be sent after the merchant changed signing limits. The worker now locks/reads the active charter before invoking the executor and stops with a ledger review event if the charter is missing or its version differs. The lock is held until the executor records its intent; normal PayPal freshness/idempotency checks remain. The dispute UI displays a plain-language review message rather than implying an action was sent.
- Test-first failed because the old handler attempted execution; after implementation the first focused run exposed a test-only `kind`/`event_kind` typo, corrected without changing the assertion. Full backend 616 passed, Ruff/mypy/import contracts; frontend 188 passed, ESLint/types/builds; isolated full cross-app 12/12 passed with the guard. Stale and missing-charter behavior tested with mock PayPal clients. Concurrent PostgreSQL policy-change race and complete re-gating/timeout reconciliation remain T07 work; this is not the entire provider workflow.
- Policy checkpoint 982e08a branch CI 41353750080 passed. The guard is a separate following checkpoint; release both together after its own CI. No financial decision or provider call was performed during these local tests.

### Missing-delivery rollout and model-safety increment

- Main 748cff2798ca19d9fc4c3d0977a40e1449128a6d deployed via existing Render auto-deploy. Authenticated desktop Chromium at 390px observed the Signing limits selector with HUMAN_REVIEW; no policy change was made. Main E2E 41354507950 completed/success; main CI 41354508063 was running at observation. Physical Android and actual new settlement/provider action remain untested.
- Model-safety changes after this release: PROVIDE_EVIDENCE proposals now use only deterministic saved-order evidence fields, never model-invented notes/tracking/documents. Model money requires a positive decimal string with at most two places and uppercase currency without coercion. Truncated model responses enter bounded repair, even if the partial text parses as JSON. Provider and repair prompts include the exact generated validation schema; prompt version changed to avoid old cache reuse. Validation diagnostics redact unknown field names.
- Test-first model evidence/money run demonstrated six failures on old behavior; truncation test demonstrated an incorrect one-attempt acceptance. The first schema-prompt test had a missing test import, corrected; redaction test demonstrated unsafe field-name echo. Final focused model/agent tests 61 passed, strict mypy and Ruff passed; full backend 625 passed (prior to the final diagnostic-only redaction test), frontend 188 and builds passed. Final sequential full cross-app run 12/12 passed with current model-safety changes.
- An earlier cross-app run concurrently with full backend tests had 11 passed/1 failed because both suites manipulated the same test-only approval outbox. Read-only local DB inspection confirmed the approval row was created; sequential rerun passed without removing any assertion. All test databases were explicit disposable local targets.
- Remaining T06 includes real hosted provider proof, failure-task UX, and broader model-output truthfulness. T07 still needs comprehensive provider-side re-gating and uncertain-write recovery proof; UI/copy, notifications, Android push and physical-device validation remain open.

### Model-safety release and provider check

- Branch CI 41354708059 succeeded; authorized fast-forward main 748cff2 → ddab49219323108bcf4b6adb6d263ff63eaae06b. Main CI 41354968018 and E2E 41354967949 both completed/success; local final 625 backend, 188 frontend, strict mypy/Ruff/types/builds and sequential 12/12 cross-app passed. Existing Render owner auth, worker heartbeat and PayPal-only handoff passed after the push, but this backend-only release has no exposed build identifier, so its exact Render serving revision is not independently proven.
- Configured real OpenAI-compatible provider in this workspace returned schema-valid uncached plans for two fictional delivered/in-transit cases, one attempt each; this was not a Render worker or PayPal execution test. No private dispute content was sent. Provider/PayPal workflow, messages truthfulness and failure-task UX remain T06–T07 work.
- The earlier PP-R-MYR-10195637 approval predates the evidence-grounding fix and has no saved evidence snapshot. Do not imply that its proposed evidence was retroactively replaced or verified; a fresh evaluation path remains outstanding.

## In-app notification inbox — 2026-11-02

- Migration c86f1bd50006 adds notifications and a transactional outbox. Source events write generic messages for new disputes, required review/approval, action updates and failures in the same transaction; stable semantic deduplication prevents repeated new-dispute or repeated approval-for-one-decision notices. No raw buyer text is used. PostgreSQL and SQLite use atomic conflict handling.
- Owner-authenticated `/api/notifications` supports bounded pagination, unread count, and CSRF-protected idempotent read/unread. Demo-session items are deliberately excluded from the normal merchant inbox rather than exposing cross-session data. Merchant `/app/notifications` provides list, unread badge, links, pagination, loading/error/retry and read/unread states. Old events are not retroactively backfilled.
- Local verification: 630 backend tests in final full run, plus final five focused notification tests including dedicated PostgreSQL dedupe/outbox rollback; 190 frontend tests plus focused reload/read/unread/error tests; strict mypy/Ruff/types/client freshness/builds pass. Full local cross-app suite 13/13 passed; separate focused browser test followed the correct dispute link and preserved read status after reload. Local Chromium 390px screenshot shows no horizontal overflow, not physical Android.
- Deliberate scope: this checkpoint delivers persistent in-app notifications only. Outbox rows are retained but no push-delivery worker is claimed. Toast integration, deadline reminders, demo-session inbox capability and opt-in Android/web push remain. No financial action or real PayPal mutation was performed during tests.

### In-app inbox release — 2026-11-02

- Owner requested testing and pushing the in-app notification feature. Branch checkpoint 2497e607e10c6745a6636aa0f14f88e59dc1a5a6 passed branch CI 41391504075. Authorized fast-forward main ddab492 → 2497e60 succeeded; existing Render auto-deploy was used with no config changes.
- Main CI 41391733584 succeeded (631 backend tests), and full E2E 41391733588 succeeded (13 browser cases). Local full backend 630 plus subsequent dedicated PostgreSQL atomic rollback/dedup tests, frontend 190, types/builds and full cross-app 13/13 passed. A focused browser repeat verified link navigation and read status across reload.
- Deployed API schema and merchant bundle were observed. Authenticated browser verified inbox GET 200, zero items/unread, and 390px no-overflow. No live notifications were marked read and no real dispute/payment was changed. Old events were not backfilled; new qualifying events create inbox items. Browser evidence is desktop Chromium, not a physical Android test. The worker's exact new source revision was not independently verified.
- This release is in-app inbox only. Delivery outbox entries are retained but push delivery, deadline reminders, demo-session inbox capability and shared toasts are not implemented. Opt-in phone push and physical-device verification remain T10.

### Progress inventory refresh — 2026-11-02

- Fetched the remote checkpoint and fast-forwarded the clean local checkout from ddab492 to 02f6c49. GitHub reported main at 2497e60 and the checkpoint branch at 02f6c49. No product changes or provider mutations were made.
- Reconciled PROGRESS.md with this log: the missing-delivery policy and inbox are implemented, while their outstanding evidence, delivery and hosted acceptance criteria remain open. Listed the remaining v3 tasks in plan order. This is a documentation checkpoint, not a declaration that those tasks are complete.

### Evidence narrative provenance — 2026-11-02

- A test-first regression showed that submission notes described a simulated delivery without identifying the simulation. Notes generated for valid shipment records now say when simulated records are included and are not carrier-confirmed; records without a verified simulation source are separately described as unverified. Mixed sources retain both disclosures. Existing snapshots and previously created decisions are not rewritten.
- Focused evidence/agent tests: 63 passed. Full `make test-agent VENV_PY=.venv/Scripts/python.exe` with explicit disposable local `SIGNOFF_TEST_DATABASE_URL`: Ruff, strict mypy (110 files), all 3 import contracts and 632 tests passed. The initial full run was interrupted (exit 130) after database errors because the named disposable database did not exist; created it locally, applied migrations through c86f1bd50006, then reran successfully. No shared database was used. One existing Starlette deprecation warning remains.
- This is an incremental T05 fix, not completion of early-exit snapshots or refresh history. Existing queued or approved actions retain their originally recorded evidence; this change does not retroactively validate them. Hosted submission and the treatment of simulated tracking in structured provider fields remain to be verified before claiming the deployed workflow is truthful.

### Pre-model review evidence — 2026-11-02

- Added separate append-only review evidence records for unsupported reasons, ambiguous or unavailable stores, unsafe/missing delivery evidence and required evidence that cannot be prepared. These records are committed with the review event, contain only available order facts, and do not manufacture an AgentRun or a submission. Unsupported reasons explicitly say the order was not gathered; ambiguity and store outage have distinct explanations. Each evaluation records its own observed history; no old data is backfilled.
- The existing authenticated evidence endpoint combines model snapshots and review records, marking their kind and sorting by capture time. The dispute view labels pre-model reviews and uses “Unavailable” for an unknown order rather than claiming it was not found. Additive migration d97a2ce60007 creates a separate table and PostgreSQL append-only trigger; old model snapshots remain unchanged. The schema and generated client were updated.
- Test-first regression failed because the new record did not exist. Focused agent/reason tests passed 42. Dedicated local test DB migrated to d97a2ce60007; full backend passed 634 tests, Ruff, strict mypy and 3 import contracts; PostgreSQL trigger rejects update/delete. Full frontend passed 191 tests, ESLint and Vitest typecheck. `make test-types` passed TypeScript, enum parity and generated client freshness; both production builds passed. First backend check stopped at two lint findings, which were fixed; the second passed. Existing Starlette deprecation and frontend bundle-size warnings remain.
- This is a partial T05 checkpoint: explicit evidence refresh/re-evaluation, deployed proof and structured PayPal tracking provenance remain open. No hosted mutation or deployment was performed. Migration is additive; rollback requires a compatible application version and retaining the table/history, not dropping the table on a live rollback.

### Evidence refresh and simulated tracking — 2026-11-02

- Added authenticated, CSRF-protected evidence refresh using the last synced dispute and current scoped store records. Each refresh appends a separate snapshot; it does not call the model or PayPal, enqueue an action, or alter older history. Missing/unsafe not-received evidence remains review-only. The page explains these limits and distinguishes a refresh from model and pre-model review records.
- Test-first demonstrated simulated tracking was included in structured PayPal carrier fields. Newly built evidence excludes simulated records from those fields, while preserving labeled notes. New snapshots disclose when no carrier tracking is included. Previously saved decisions are not rewritten; their structured payloads require separate review. Source-unknown tracking remains a provenance limitation and must not be represented as carrier-confirmed.
- Focused tests passed 65 backend and 12 dispute UI tests. Full local backend: 636 passed, Ruff, strict mypy and 3 import contracts. Full frontend: 192 passed with ESLint and type checks; TypeScript, enum parity and generated-client freshness passed. The first frontend suite failed because the new test's history GET mock did not return an array; fixed the mock, focused and full reruns passed. First code lint found an import order error, corrected before the passing full backend run. No assertions were removed. No hosted purchase, provider mutation or deployment was performed.
- T05 hosted evidence, review of earlier queued decisions, and provider-side handling of notes-only submissions remain unproven; evidence-only refresh does not claim to re-evaluate or execute an action.

### Provider failure review — 2026-11-02

- OpenAI-compatible refusal fields now produce a typed refusal without storing or displaying the provider's raw refusal text. Failed model runs record safe failure kind, bounded attempt count, schema/prompt version, run ID and a validated model label alongside the existing sanitized error. The dispute view highlights that the latest analysis needs review and that this run proposed no action.
- Test-first checks reproduced refusal misclassification, missing diagnostics and missing review banner. Backend full run: 638 passed, Ruff, strict mypy and 3 import contracts. Frontend full run: 193 passed, ESLint and type checks. First backend run had 3 failures because mocked services returned a mock model label; non-string labels now fall back to unavailable and the focused adversarial tests and full rerun passed. A restricted-network focused run was interrupted while waiting on local DB access; the full suite used the explicit disposable DB with local network access. Existing Starlette warning remains.
- T06 is not complete: hosted provider proof for multiple states, full cached/live presentation, captured scrubbed validation diagnostics and broader model-message truthfulness remain. No hosted provider call or PayPal mutation was made in this checkpoint.

### Reasoning source in audit history — 2026-11-02

- New proposed-plan events record cached, configured-provider or unknown source, and the timeline labels them accordingly. Fake/unrecognized providers and older events remain unknown rather than being called live. Existing events are not rewritten. API schema and generated client were updated.
- Test-first cache/history regression failed on missing source. Full backend passed 639 tests, Ruff, strict mypy and 3 import contracts. Full frontend passed 193 tests and ESLint/type checks before the additional focused timeline test was added; the focused dispute suite then passed 14 tests. TypeScript, enum parity and client freshness passed. One restricted-network focused run was interrupted because local DB sockets were unavailable; full backend ran against the explicit disposable local DB with socket access. No hosted provider or PayPal call was made.
- T06 remains open for hosted multiple-state provider proof, scrubbed failure fixture/diagnostics and truthful model-generated messages. A configured-provider label identifies the response path, not proof that a hosted run occurred.

### Evidence and provider checkpoint deployed — 2026-11-02

- At the owner's request, fast-forwarded main 2497e60 → ebbd92de01d47fdb7574e100404dbe261c12d39c. GitHub main CI 41399306582 and E2E 41399306867 completed successfully. Render reported the exact commit live for shop (dep-dbk2nd2vcj2c73fim7t0), merchant site (dep-dbk2nd2vcj2c73fim7q0), worker (dep-dbk2nd2vcj2c73fim8fg) and API (dep-dbk2nd2vcj2c73fim80g).
- Read-only checks: API /readyz returned ready/database connected; deployed OpenAPI includes evidence refresh; public merchant bundle includes refresh, failure review and cached reasoning labels. No owner session, PayPal transaction or approval was used in this check.
- Worker logs showed repeated job failures at 06:21:46 and 06:23:05 UTC due to the `uq_jobs_pending_dispute_kind` uniqueness constraint. Recovery and impact are not established; the full background dispute flow is not verified. Do not claim deployed end-to-end success. Earlier queued decisions predate provenance changes and are not retroactively rewritten.
