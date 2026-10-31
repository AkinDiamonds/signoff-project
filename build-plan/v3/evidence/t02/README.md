# T02 visual checkpoint — local only

![Owner sign-in at a 390-pixel mobile viewport](login-mobile.png)

This screenshot shows the actual local React sign-in screen in desktop Chromium at a 390×844 viewport. It is not a physical Android screenshot and is not the deployed Render release. It contains no entered credentials. The theme picker no longer blocks first visits.

## Verified

- Anonymous navigation to the protected Settings route reaches sign-in.
- Browser sign-in proceeds to the actual authenticated Settings page and its background-worker section using fictional credentials and a separate disposable local DB.
- Unit/integration tests cover authentication, CSRF, session expiry/revocation/restart, rate limits, unavailable provisioning, observed/stale readiness, and failed connection checks. See the execution log for counts.

## Unresolved browser assertion

The browser script failed twice at the assertion checking `httpOnly`, `secure`, and `partitionKey` from `context.cookies(...)`. It reached Settings before this assertion. Cookie metadata was not saved, so no specific missing flag or root cause has been established. Do not claim the cookie is unsafe or claim cross-site verification passed based on this output alone.

The first attempt used Playwright route.fetch forwarding. The second used native HTTP forwarding, so Chromium alone handled cookies, and used separate reserved sites (`merchant.signoff.test` and `api.signoff-api.test`). Both forward exclusively to the local preview on ports 5176 and 8042. Neither contacted or mutated Render. Reload/logout steps after the assertion were NOT RUN in the browser; backend tests for those behaviors passed.

Under AGENTS.md's two-failure rule, further browser retries were stopped and reported. Next diagnosis should inspect only safe cookie metadata and Set-Cookie attribute presence (never print values), check what the installed Playwright API actually reports, and distinguish a test-tool metadata limitation from an actual browser rejection. Do not remove the assertion or disable browser privacy to get a pass.

Raw local diagnostic script/logs are in ignored `scratch/v3-audit/owner-browser.mjs` and `owner-browser.log`; those may not survive transfer. Recreate the isolated fixture from OWNER-ACCESS.md and this description if needed. All preview credentials are fictional and must not become deployment defaults.

## Fresh-workspace diagnostic preparation — 2026-10-31

Current branch was fetched and checked out at `d491e61`. Source inspection confirms production cookie flags and Playwright 1.64.1's Chromium adapter maps CDP `partitionKey.topLevelSite` to the public `partitionKey` field. This confirms API support, not the attributes of the unobserved cookie.

The isolated PostgreSQL preview was recreated and migrated, and fresh current-source API/Vite processes started. Both launch attempts failed before opening a page: first the default headless shell was absent, then full Chromium was absent. Browser retries stopped and reported under the repository's two-failure rule. No new safe metadata or screenshot exists, and no original assertion was evaluated. Do not confuse this environment blocker with the original cookie failure.

Portable sources are retained in `diagnostics/owner_preview.py` and `diagnostics/owner-browser.mjs`. These are diagnostic fixtures, not a verified E2E result. They permit only the two reserved sites and native HTTP forwarding to 8042/5176; no session injection, route.fetch cookie jar, or privacy-disabling flags. Cookie values stay in memory; persisted metadata whitelists name/domain/path/flags/partition key. Set-Cookie logging records only attribute booleans.

After the stopped-attempt report, prepare and run from repository root:

```bash
mkdir -p work
UV_CACHE_DIR="$PWD/work/uv-cache" uv sync --frozen --extra dev
npx playwright install chromium
# Verify the existing local PostgreSQL first. Create the disposable preview DB
# only if absent; never run against inherited DATABASE_URL.
SIGNOFF_TEST_DATABASE_URL=postgresql+psycopg://signoff:signoff@localhost:5432/signoff_test_preview make prepare-test-db VENV_PY=.venv/Scripts/python.exe
# Separate terminals; skip starts if these exact owned previews still run.
PYTHONPATH=signoff:signoff/agent .venv/Scripts/python.exe build-plan/v3/evidence/t02/diagnostics/owner_preview.py
VITE_API_URL=https://api.signoff-api.test VITE_MOCK_API=false npm exec --workspace=@signoff/web vite -- --host 127.0.0.1 --port 5176 --strictPort
node build-plan/v3/evidence/t02/diagnostics/owner-browser.mjs
```

Use network-enabled execution where needed; do not remove the session-cookie assertion. The script writes only safe metadata to `work/cookie-metadata.json` and local screenshots to `work/`. Browser assertions and exact partition-key expectation remain unverified. Stop on the retry limit and preserve failures.
