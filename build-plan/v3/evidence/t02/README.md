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
