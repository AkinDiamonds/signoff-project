# Resume Signoff

Read applicable AGENTS instructions, this handoff, `02-owner-decisions.md`, latest `EXECUTION-LOG.md`, `PROGRESS.md`, then only the active task section of `00-execution-plan.md` and its relevant code. Preserve local work; no resets, force-pushes or worktrees.

## Product journey and authorization

The separately deployed shop uses official PayPal-hosted sandbox checkout. Buyers independently report/manage disputes in PayPal Resolution Center. Signoff receives verified webhooks and runs merchant evidence/planning/gate/approval/execution. No public Signoff buyer-dispute form or direct-capture shortcut. See decisions 9–10.

The owner authorizes releasing the tested compatible branch to `main`; existing Render services auto-deploy main. Do not recreate Render/cloud configuration. Owner confirmed MERCHANT_EMAIL/MERCHANT_PASSWORD_HASH were installed and the existing service redeployed. A private generated credential file exists in ignored work storage; never print it, commit it or include it in screenshots/logs.

## Branch and checkpoints

- Working branch `codex/signoff-v3`. Original main/base `fd9c2b7` is a verified ancestor; main can be fast-forwarded without rewriting history.
- Pushed/confirmed: T01 `07f1d7b`, T02 owner code `20f24fb`, native HTTPS proof `077af41`, capture validation `54fbf66`, shared resolver `279ae85`.
- New released commits: `d247d09` durable payment intents/IDs/recovery; `3239bb9` production migration startup; `e2fe052` PayPal-only public buyer journey; `c395bd6` fresh-CI PostgreSQL readiness; `aac671a` final buyer-offer test handoff; `fac224f` narrow header; **`1930967` latest confirmed main source/workflow checkpoint** (T04 shipping plus unsafe-tracking stop; prior release 1c772d7). Both main and codex/signoff-v3 were native remote-confirmed at 1c772d7; later handoff/evidence-only commits may follow on codex/signoff-v3 without changing main application source.
- CI observed success for `20f24fb`, `d491e61`, `a128575`, `077af41`, `54fbf66`. Diagnostic-only `88b2b7c` run cancelled. Later CI is not assumed passed.
- **Final main CI confirmed:** 1930967 standard CI run 41237185691 and full E2E run 41237185727 both completed/success. All 12 remote browser cases pass. Previous 1c772d7 workflows also passed. Source checkout is clean before this final handoff/evidence-only commit; only those intentional document/artifact changes are staged here. No uncommitted product source or secrets.

## Implemented and verified

- T02 local cookie issue resolved: route fulfillment reproduced missing partition key; actual local HTTPS on separate sites reports HttpOnly/Secure/SameSite=None/Partitioned in Playwright and CDP. Login, retained session, reload, CSRF rejection, logout and denied access passed. Evidence under `evidence/t02/`. No cookie assertion removed or privacy flag disabled.
- **T02 also verified on Render:** owner configuration required/present; real UI login, retained session/reload, expected partition under signoff-web.onrender.com, missing-CSRF logout rejected, UI logout and denied access afterward. Fresh worker heartbeat and existing verified webhook receipt observed. Separate deployed shop external PayPal handoff and 390px no-overflow header passed. Safe reports/screenshot under `evidence/release-2026-10-31/`; desktop Chromium, not physical Android.
- T03 local code now has strict completed-capture proof, server-owned links, explicit order/capture columns, durable capture reservation, stable PayPal request IDs, GET-only recovery after uncertainty, merchant payee check when returned, and one transactional payment/tracking winner. Buyer order detail exposes authorized payment references. Legacy IDs are not guessed/backfilled or made unique.
- One shared agent/merchant resolver considers all transactions, prefers seller references, accepts only store-known fallbacks and rejects duplicate/conflicting mappings. Ambiguous/unavailable context stops for human review. T03 legacy scoping/canonical aliases are implemented in 618ed19; real hosted purchase correlation still needs proof.
- Buyer dispute forms/replies removed from public routes; old URLs show an external PayPal handoff. Legacy API fixtures require APP_ENV=test plus PAYPAL_ENV=stub. Demo/direct-capture controls require explicit local DEV stub mode, never production. Production webhook processing does not wait for a judge claim; deterministic signing limits are unchanged.
- Production API lifespan and worker startup serialize forward Alembic upgrades under a PostgreSQL advisory lock. Startup fails closed on migration failure. Revisions: owner tables `d18e6c2a9001`, nullable checkout references/intent `e42b7d910002`, expanded existing ledger kind constraint `f53c8ea20003`. No financial rows rewritten/deleted.
- Latest local checkpoint: **600 backend tests**, Ruff, strict mypy, 3 import contracts PASS; **185 frontend tests**, ESLint/TypeScript PASS; enum/client freshness PASS; both production builds PASS. Existing Starlette/httpx deprecation and merchant bundle-size warnings remain. See log files summarized in EXECUTION-LOG.

## Browser limits and release verification

- Full local browser attempt 1 interrupted after discovering inherited demo-hold configuration and missing migrated DISPUTE_POOLED value; corrected isolation and forward migration with regression tests.
- Attempt 2 completed **8 passed / 4 failed**. Remaining failures were stale missing/hidden UI test hooks and a $64 test fixture against a $24 server-priced order. Corrected visible hooks and derive the fixture's amount from the authorized order response, preserving assertions.
- Full local suite retries stopped/reported under the repository's two-failure rule. Corrected browser cases are NOT claimed locally passed. Remote CI subsequently supplied the result: fac224f **12/12 browser tests passed**, with a job cleanup failure on obsolete pip caching; removed that setting in 1c772d7. **Both final 1c772d7 workflows now pass**, including all 12 browser tests. Earlier failure history stays in the execution log.
- Current increment: T03 final merchant/demo scoping and canonical aliases implemented (618ed19; CI success). T04 persistent automatic/manual simulated fulfilment implemented and locally verified; release state is recorded in the latest log entry. Next implementation is T05 inspectable evidence and merchant missing-evidence policy, alongside fresh real PayPal order/dispute correlation. The owner can now test a real sandbox purchase followed by opening the dispute separately in PayPal Resolution Center. Do not ask for buyer passwords in chat or fake hosted approval. Full provider/model/gate execution needs new dated evidence. See RELEASE.md for migration/rollback.
- Do not claim the full product complete: deployed shipping observation, evidence policy/provenance, notifications/inbox/Android push, physical-phone approval and complete PayPal Resolution Center → webhook → live LLM/gate/execution proof remain T04–T17.

## Environment and safe commands

- Repo `/workspace/signoff-project`; Python `.venv/Scripts/python.exe` (Linux symlink), locked `uv sync --frozen --extra dev`. Writable cache: `UV_CACHE_DIR=$PWD/work/uv-cache`.
- Never use inherited DATABASE_URL for tests, migration round trips, reset or seed. Tests: `SIGNOFF_TEST_DATABASE_URL=postgresql+psycopg://signoff:signoff@localhost:5432/signoff_test_v3`. Preview: separate `signoff_test_preview`. Both local in verified signoff-postgres container.
- E2E uses only local `signoff_e2e`; stack_env now clears inherited Settings names/aliases/credentials before supplying stub values. No shared/deployed data used. It may recreate only that dedicated fixture DB.
- Network-enabled execution is required for local sockets, Docker, browsers and Git; ordinary restricted calls can fail/hang. Preserve the runtime proxy for external destinations.
- Chromium 156 / Playwright 1.64.1 installed under `work/browsers`; set PLAYWRIGHT_BROWSERS_PATH accordingly.
- Local old previews: API 8042 exec 76279/PID 4881 and Vite 5176 exec 74599. Their backend source predates later release changes; restart only these owned processes before using them for new evidence. E2E stub/API/frozen API/worker processes are tracked in `.e2e-stack/pids.json` after the latest local attempt; inspect before stopping/reusing them. Prior stale PID file was preserved in ignored work storage; no unrelated processes killed.
- Ignored `work/` contains logs, generated local TLS fixture material and private owner credentials. Never publish raw credentials/browser traces. Safe cookie reports and fictional local screenshots are committed separately.

## Current T04 checkpoint (2026-10-31)

- Forward migration a64d9fb30004 adds shipment identity/version/schedule. New verified payments start PRE_TRANSIT; worker advances at one-minute intervals using actual timestamps. Owner `/app/shipments` controls progression and pauses; CSRF/scope/version/idempotency guards apply. Existing tracking/financial/run history is preserved. DISPUTED is never downgraded.
- Full local validation: **600 backend**, Ruff/strict mypy/3 import contracts; **185 frontend**, ESLint/types; enum/client freshness; both builds; whitespace PASS. New PostgreSQL two-session concurrency and owner/CSRF checks included.
- Native local HTTPS browser PASS: owner login, manual milestones to delivered, reload persistence, terminal lock, missing tracking, resume, exception, no 390px overflow. Evidence in evidence/t04. Desktop Chromium at phone viewport, not physical Android. No actual provider payment was created.
- Paused/invalid/future tracking stops usable delivery evidence and requests human review. Configurable policy/provenance presentation stays T05. Existing legacy paid orders are intentionally not backfilled/scheduled.
- Preview API was restarted from current source on 8042 (exec76181); Vite5176 remains owned. Browser fixture uses only signoff_test_preview and no external provider calls. Source push/main/deployment status must be read from the latest EXECUTION-LOG entry.

### T04 release observed

- Source main and codex/signoff-v3 remote-confirmed at 1930967eab74ed0e6b51eb9d0313bcbf94b1cfae before this handoff-only commit. Authorized fast-forward, no Render config changes. Branch CI 41236978982, main CI 41237185691 and main full E2E 41237185727 all completed/success (12/12 browser cases).
- New API OpenAPI/shipping read, merchant and shop shipping bundles observed on Render. Actual owner login/reload/cookie/CSRF/logout checks and shipping page/API/no-overflow PASS; report/screenshot in evidence/t04. Fresh worker heartbeat verified. No new paid shipments exist yet (authenticated list200/count 0); auto/manual milestone proof remains local until a fresh hosted sandbox purchase. PayPal/LLM only configured, no fresh full provider journey claimed.
- Next: T05 inspectable saved evidence/provenance and merchant missing-evidence policy. Keep buyer dispute creation exclusively in PayPal Resolution Center. Physical Android/push remains pending.
