# Resume Signoff without rereading the chat

Read this file first, then `02-owner-decisions.md` and the latest entry in `EXECUTION-LOG.md`. Read repository `AGENTS.md` instructions before editing. Consult only the active T-task in `00-execution-plan.md`, plus its code/tests; do not repeat the whole audit.

## Goal and fixed decisions

Complete the existing product and prove it on Render. Single merchant account; normal product UX; owner email/password login; no signup, recovery or email service. Simulated shipping advances automatically with labeled manual sandbox controls. Missing delivery defaults to human review and is merchant-configurable. Valid actions run autonomously within deterministic signing limits. Include toasts, persistent inbox and opt-in Android Chrome push. Keep PayPal sandbox-only and simulated tracking truthful.

## Current authoritative resume — T02 browser verification passed locally

- Branch `codex/signoff-v3`; T02 local HTTPS proof checkpoint **`077af41` is pushed and remote-confirmed**. T03 capture-validation checkpoint follows; inspect current log/status and remote. No unfamiliar local work existed.
- **T02 cookie diagnosis resolved locally:** route fulfillment reproduced `partitionKey: null` despite all Set-Cookie attributes being present. Real local HTTPS with the same current app source produced the expected partition key in BOTH Playwright and CDP. No production cookie/auth change required. The old fulfillment fixture was the source of the observed failure; do not use it to verify CHIPS.
- Chromium 156.0.8078.4 installed in `work/browsers` using Playwright 1.64.1. Native fixture uses two separate HTTPS sites on port 8443, trusts only its generated local certificate's SPKI, and bypasses the runtime proxy only for those loopback fixture hosts. No browser privacy flag disabled. Safe reports and screenshot are committed under `evidence/t02/`.
- Browser PASS: anonymous redirect; UI login; retained session; HttpOnly/Secure/SameSite=None/Partitioned cookie with correct merchant partition; authenticated reload; no-CSRF logout 403; UI logout 204; protected API 401 and login redirect afterward.
- Current checkout checks: backend 500 tests, Ruff, strict mypy, three import contracts PASS; frontend 178 tests/ESLint/tsc PASS; enum/client freshness and BOTH production builds PASS. Initial web lint caught downloaded browser vendor JS in `work/`; exclude scratch assets, then rerun passed. Existing merchant bundle-size warning and Starlette/httpx deprecation remain.
- Separate disposable local DBs: preview `signoff_test_preview` and tests `signoff_test_v3`, both migrated via guarded helper. Never use inherited DATABASE_URL for test/reset/migration operations.
- Running current-source previews: API port 8042 exec 76279/PID 4881; Vite port 5176 exec 74599, API URL `https://api.signoff-api.test:8443`. Both use fictional fixture configuration; no worker or provider requests. Native TLS 8443 server runs only during probe and is closed afterward.
- Reproduce with `PLAYWRIGHT_BROWSERS_PATH=$PWD/work/browsers node build-plan/v3/evidence/t02/diagnostics/owner-browser.mjs` after certificate/setup commands in evidence README. HTTPS is now default. `SIGNOFF_BROWSER_TRANSPORT=route-fulfill` is only a historical control; do not weaken its assertion or claim it passes.
- **Active implementation: T03** in `00-execution-plan.md`. First capture-validation slice implemented: strict shared capture/reconciliation boundary and server-link checks, no fabricated capture success. Test-first regression 29 failures on old source; green targeted 53 and full backend 540 tests, Ruff, mypy 99 files, three contracts PASS. Next: explicit durable identifiers/intents, merchant binding, stable request IDs and one shared unambiguous agent/UI resolver; see execution log. Preserve deterministic gate/executor/ledger invariants.
- GitHub CI for `20f24fb` and `d491e61` confirmed successful; later checkpoint CI must be observed, never assumed.
- Render rollout, production owner provisioning, physical Android, hosted PayPal/LLM journey and T03–T17 remain unverified/unimplemented. T02 local browser PASS is not deployed proof. No merge, deployment, live credential provisioning or cloud configuration change performed.

## Historical handoff (superseded by the resume above)

### Resume update — 2026-10-31, fresh cloud workspace

- Branch `codex/signoff-v3` checked out at confirmed remote `d491e61`. No unfamiliar local changes existed. Diagnostic-preparation checkpoint **`88b2b7c` is pushed and confirmed by native `git ls-remote`**; tracking-only commits may follow. Latest pushed **product code** remains `20f24fb`. No uncommitted product changes.
- GitHub CI is now observed **success** for both `20f24fb` (run 41211299897) and `d491e61` (run 41211594512). These results do not prove cross-site cookies.
- Locked dependency sync passed with `UV_CACHE_DIR=$PWD/work/uv-cache uv sync --frozen --extra dev`; default cache failed because it is read-only. Network commands need the execution tool's additional network permission; ordinary Git fetch could not reach the proxy, network-enabled fetch succeeded.
- Existing local `signoff-postgres` was verified. Created fresh disposable `signoff_test_preview` and `signoff_test_v3`; only preview was migrated to head with the guarded helper. Inherited DATABASE_URL was never used for test/migration operations.
- Fresh source API preview runs at 8042 in production cookie mode using fictional configuration and the preview DB. Vite serves current source at 5176 with the reserved HTTPS API URL and mocks off. Sessions: backend exec 98403, frontend exec 52666. No worker started, provider checks requested, or Render mutation performed.
- **Browser launches failed twice before a page opened:** default headless-shell executable absent; full Chromium executable also absent. Stopped browser retries under `signoff/AGENTS.md`. There is no new cookie metadata, screenshot, or behavioral result. The old assertion's root cause is still UNKNOWN.
- Portable preview/probe sources now live in `evidence/t02/diagnostics/`; ignored working copies/logs are under `work/`. The probe captures attribute booleans and whitelisted cookie metadata only, retains the full cookie assertion, and includes reload/CSRF/logout checks. It has NOT executed past browser launch.
- **Next concrete step:** install matching Chromium (`npx playwright install chromium`, network-enabled), then resume the stopped probe after the owner has received this report. See evidence README for exact fixture commands. Do not treat missing executables as a cookie diagnosis or advance to T03/deployment yet.
- Local test/lint/type/build suites were not rerun during this blocked diagnostic attempt. No production source change. Before checkpoint commit, only handoff/evidence documents and portable diagnostic sources are changed; use Git status for current uncommitted state.
- Targeted diagnostic JavaScript ESLint, Node syntax check and Git whitespace check passed (exit 0). No browser assertion ran.
- Diagnostic checkpoint CI run 41213129730 observed **in_progress**, conclusion null; do not call it passed. Earlier code/handoff CI successes above remain confirmed.

- Original base `fd9c2b7472612bfe935144b860359a937f07fb37`. The owner now authorizes checkpoint commits/pushes. Continue on `codex/signoff-v3`; inspect Git log/status and remote before proceeding. Render deployment is a separate release step.
- Confirmed pushed code checkpoints: baseline `07f1d7b`; owner access/readiness `20f24fb`. Latest source CI was observed in progress, not passed: https://github.com/AkinDiamonds/signoff-project/actions/runs/41211299897 . Tracking-only commits may follow; inspect actual branch head.
- T00 read-only deployed audit: 39 route/viewport loads, 21 overflow findings. Inventory: `audit/page-inventory.md`, `audit/interaction-inventory.csv`. Other states remain unobserved; do not repeat safe route screenshots unless changed.
- T01 local baseline is COMPLETE: 489 backend tests, 169 frontend tests, lint, strict Python/TS typing, three import contracts, enum parity, generated client freshness and both builds pass. CI is configured but not run on GitHub. Details/results in the latest execution-log entry.
- T02 code is implemented: owner login, durable hashed sessions, server auth/CSRF/rate limits, truthful Settings/readiness, worker presence. See OWNER-ACCESS.md and latest execution-log entry. New API/TS contracts and migration `d18e6c2a9001` are included. No registration, email provider or recovery.
- Active next action: diagnose the browser cookie assertion, not rebuild login. Both browser attempts reached Settings but failed the combined HttpOnly/Secure/partitionKey metadata assertion; metadata wasn't recorded. Do not claim cross-site cookie verification. Reload/logout after that assertion were not run in the browser. Repo two-failure rule was reported and retries stopped; continue diagnosis only after resolving that stop with the owner's next instruction. Inspect safe metadata only, never cookie values; do not drop the assertion or disable privacy. [Evidence and limits](evidence/t02/README.md).
- T03–T17 not implemented: payment correlation fixes, shipping advancement, missing-evidence policy, notifications/push and Render rollout remain TODO. Owner account configuration is not provisioned on Render; production will lock merchant access until MERCHANT_EMAIL/HASH are supplied securely before release.
- Prior public API/landing health does not prove provider calls, worker activity or end-to-end transactions.
- Render service revisions/worker logs and a scrubbed deployed LLM failure fixture remain unavailable. Do independent local work first; ask for precise access only when needed.

## Working rules

- Existing checkout `/workspace/signoff-project`; Python `.venv/Scripts/python.exe` (Linux symlink), Node 24.19.0. No other project's venv.
- Inherited `DATABASE_URL` and settings may target shared/deployed data. Never use them for tests/migration resets. Use the documented isolated test URL, never print credentials or dump env.
- Do not reset/discard changes or overwrite history. Earlier docs are untracked but intentional. Tests historically rewrote tracked OpenAPI; verify Git status after checks.
- If a command fails twice, stop retrying and report under repository instructions. Do not suppress failures or call unrun checks passing.
- No cloud configuration publication or deployment merely to continue. Prepare reviewable code/release and obtain deployment authorization when needed. Never fabricate hosted proof.
- Durable handoff: this directory's repository documents, currently uncommitted and included in the transfer bundle. Raw screenshots/logs under ignored `scratch/v3-audit/` may disappear in another workspace; summaries stand alone. Never commit private browser traces or secrets.

## Verified local commands

```bash
uv sync --frozen --extra dev
# .venv/Scripts/python.exe is the existing Linux compatibility symlink.
# Fresh Linux environments: mkdir -p .venv/Scripts and link ../bin/python if absent.
export SIGNOFF_TEST_DATABASE_URL=postgresql+psycopg://signoff:signoff@localhost:5432/signoff_test_v3
make prepare-test-db VENV_PY=.venv/Scripts/python.exe
make test-agent VENV_PY=.venv/Scripts/python.exe
make test-web
make test-types VENV_PY=.venv/Scripts/python.exe
VITE_API_URL=http://localhost:8000 npm run build
```

The dedicated DB exists in this workspace's `signoff-postgres` container. On a fresh machine, start the repository's local PostgreSQL and create `signoff_test_v3` as its `signoff` user before migration. Never reuse inherited DATABASE_URL. Pytest now ignores it, clears all Settings aliases (including DEMO_POOL_HOLD), and disables developer dotenv loading. The migration helper has the same guard. The root Make targets now run the required typing/import checks.

Latest T02 validation: 500 backend tests and 178 frontend tests pass; lint/types/import contracts/parity/builds pass. Browser cookie check is separately unresolved. Screenshot is desktop Chromium at a phone viewport, not physical Android. Raw preview scripts/logs are ignored scratch files and may not transfer; persistent evidence summary documents the fixture. Local preview services on 8042/5176 may be older loaded code: restart only those owned processes before new probes; never use inherited deployed credentials for preview.

## Moving to a different workspace

First fetch/check out the latest pushed `codex/signoff-v3` checkpoint; see the execution log and actual remote for push results. Uncommitted work after that checkpoint still requires transfer. The earlier portable bundle is `/workspace/signoff-handoff/signoff-resume.zip` (original base SHA, patch, handoff); it predates later checkpoints. Never apply it over an existing checkpoint without checking. No secrets, dotenv files, browser screenshots or raw logs are included. Bundle availability must be checked before claiming it exists.

## Copy into a new session

> Continue AkinDiamonds/signoff-project on branch codex/signoff-v3 (code checkpoint 20f24fb or newer). Preserve local changes; if this is a fresh checkout, fetch/check out that branch before looking for the handoff. Read build-plan/v3/START-HERE.md, 02-owner-decisions.md and the latest EXECUTION-LOG.md entry plus repository instructions. Resume T02 cookie diagnosis, not the completed baseline/audit. Verify facts against files and outputs. Keep the progress board/handoff updated, show screenshots, and push commits at checkpoints as authorized. Never claim Render deployment or browser verification that hasn't happened.
