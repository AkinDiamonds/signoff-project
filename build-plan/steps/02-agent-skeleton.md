# Step 02: Agent service skeleton

Phase: P0 Foundation · Depends on: 01 · Estimate: 2h with an agent · Commit: `feat(agent): app factory, settings, health and error envelope`
Status: [x] done

## Goal
A running FastAPI service with validated settings, structured logs and one error format.

## Do (in order)
1. Create the app factory in `agent/app/main.py` and a settings module reading the variable names in `.env.example`.
2. Startup validation: `APP_ENV` is local, test or prod; `PAYPAL_ENV` is sandbox or stub; stub is refused when `APP_ENV` is prod; any PayPal base URL that is not the sandbox host is refused.
3. Add request-id middleware and JSON logging that carries the request id.
4. Add the error envelope from `build-plan/contracts.md` and register handlers for validation errors, HTTP errors and unhandled exceptions.
5. Add `/healthz` (no database), `/readyz` (database check stubbed until step 03) and `/api/status`.
6. Add `scripts/export_openapi.py` writing `packages/api-client/openapi.json` deterministically.

## Files (touch only these)
`agent/app/main.py`, `agent/app/settings.py`, `agent/app/errors.py`, `agent/app/logging.py`, `scripts/export_openapi.py`, tests.

## Edge cases: behavior
- Missing required variables: fail at startup listing names only, never values.
- Empty CORS allowlist: deny all cross-origin requests.
- Client-supplied request id too long or with odd characters: replace with a fresh one.
- Unhandled exception: envelope with correlation id, no stack trace in the body.
- Unknown extra environment variables are ignored.

## Edge cases: types
- Settings object is frozen; environment names are enums; the OpenAPI document includes the error envelope for every 4xx and 5xx.

## Tests and regression
- Settings matrix (valid and invalid, including prod with stub and a live base URL).
- Envelope shape for 404, 422 and 500.
- Request id propagation into logs.
- OpenAPI export run twice yields identical bytes.

## Done when
- `make test-agent` green; service starts locally; health endpoints respond.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
