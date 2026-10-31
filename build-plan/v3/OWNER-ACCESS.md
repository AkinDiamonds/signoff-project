# Owner access: configuration and release gate

Single configured merchant; no registration, email service, or password-recovery flow.

## Before deploying this checkpoint

This is feature-branch work, not a deployed release. The cross-site browser cookie assertion is now resolved on real local HTTPS (see evidence/t02). Before rollout, the owner settings below must be supplied securely in Render and the complete compatible release/migration/rollback prepared.

1. Generate a password credential locally using the new source:

   ```bash
   make owner-password VENV_PY=.venv/Scripts/python.exe
   ```

   The terminal prompts twice without echo. It prints an scrypt credential, not the password. Treat the output as secret configuration: do not put it in Git, chat, screenshots, logs or public testing instructions.
2. Configure `MERCHANT_EMAIL` and `MERCHANT_PASSWORD_HASH` securely on the API service. Keep the existing `APPROVAL_TOKEN_SECRET` stable and at least 32 characters; session/CSRF/credential tags derive purpose-specific HMACs from it. No SMTP service is needed. Passwords must have 12–1024 characters.
3. `APP_ENV=prod` always protects merchant APIs even if `MERCHANT_AUTH_ENABLED=false`. Missing owner configuration leaves access locked; sign-in returns a safe unavailable state. Non-production local/stub workflows retain their current behavior unless `MERCHANT_AUTH_ENABLED=true` is set.
4. Apply additive Alembic revision `d18e6c2a9001` once against the intended Render DB as part of the approved release. It adds owner sessions, failed sign-in attempts and readiness observations; it does not rewrite orders, policies or financial history. Do not run the disposable-test-DB helper against Render.
   This release also includes `e42b7d910002` (nullable checkout IDs/capture intent) and `f53c8ea20003` (permit the already-defined DISPUTE_POOLED ledger event). Production API lifespan and worker startup apply forward migrations under one PostgreSQL advisory lock before serving/processing. A failed migration stops the new process; no destructive helper or downgrade runs. Existing Render start commands remain usable.
5. Deploy compatible API/worker/frontend versions. Check exact `ALLOWED_ORIGINS`, `VITE_API_URL`, `PUBLIC_BASE_URL`, and HTTPS. The merchant fetch wrapper includes credentials and CSRF headers; the API uses HttpOnly Secure SameSite=None Partitioned cookies in production for separate Render sites. Chromium cookie attributes and full session/logout behavior passed on separate real local HTTPS sites; deployed Android/Render verification is still required.
6. Verify login, reload, CSRF-protected action, logout, expiry and browser cookie behavior on Android Chrome before calling owner access deployed-ready. The existing PayPal signing gate remains independent of session authentication.

## Administrative reset

Generate and install a new `MERCHANT_PASSWORD_HASH`, then restart/redeploy the API with the new configuration. Existing sessions cease to validate because their credential tag is bound to the previous hash. Changing `MERCHANT_EMAIL` or rotating `APPROVAL_TOKEN_SECRET` also invalidates old sessions. Do not add a public password-reset endpoint as a workaround.

## What Settings now means

- **Not checked:** server configuration exists; no successful observation is claimed.
- **Verified PayPal access:** a read-only OAuth check succeeded with the current credentials; this does not prove all dispute permissions.
- **Verified store evidence:** the store policies read endpoint responded using current configuration.
- **Webhooks:** an actually verified webhook row and its receipt time; no hardcoded listener-active badge.
- **Worker:** timestamp from the background worker's persisted heartbeat; missing and stale are explicit.
- **AI provider:** configuration only; this screen does not make paid model calls or claim a valid live plan.
- Changed credentials invalidate previous connection observations. Checks older than 15 minutes become stale.
- Check failure remains failure; a completed check request is never labeled successful synchronization.

The logout control is in Settings. Appearance is opt-in rather than blocking the first visit. Signing preferences link to the existing Policy page; configurable missing-delivery behavior is still a later task.
