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
