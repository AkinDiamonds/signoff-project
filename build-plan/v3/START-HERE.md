# Resume Signoff without rereading the chat

Read this file first, then `02-owner-decisions.md` and the latest entry in `EXECUTION-LOG.md`. Read repository `AGENTS.md` instructions before editing. Consult only the active T-task in `00-execution-plan.md`, plus its code/tests; do not repeat the whole audit.

## Goal and fixed decisions

Complete the existing product and prove it on Render. Single merchant account; normal product UX; owner email/password login; no signup, recovery or email service. Simulated shipping advances automatically with labeled manual sandbox controls. Missing delivery defaults to human review and is merchant-configurable. Valid actions run autonomously within deterministic signing limits. Include toasts, persistent inbox and opt-in Android Chrome push. Keep PayPal sandbox-only and simulated tracking truthful.

## Current state

- Original base `fd9c2b7472612bfe935144b860359a937f07fb37`. The owner now authorizes checkpoint commits/pushes. Continue on `codex/signoff-v3`; inspect Git log/status and remote before proceeding. Render deployment is a separate release step.
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

> Continue implementing Signoff from the current working tree. Read build-plan/v3/START-HERE.md, 02-owner-decisions.md and the latest EXECUTION-LOG.md entry, then repository instructions. Resume the active task rather than replanning or repeating the completed audit. Preserve all changes. Verify claims against files and test outputs. Update this handoff before stopping; distinguish local work from actual Render deployment. Do not omit agreed features or invent passing results.
