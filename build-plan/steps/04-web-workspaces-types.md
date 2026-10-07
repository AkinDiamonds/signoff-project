# Step 04: Web workspaces, generated client, type-test harness

Phase: P0 Foundation · Depends on: 02 · Estimate: 3h with an agent · Commit: `feat(web): workspaces, typed api client, type tests`
Status: [x] done

## Goal
Both frontends and a shared typed client exist, and the type-test harness fails when types get looser.

## Do (in order)
1. Set up npm workspaces for `web`, `shop`, `packages/api-client`, `packages/ui`; minimal Vite React TypeScript apps that call `/api/status`.
2. Add `tsconfig.base.json` with strict, no-unchecked-indexed-access, exact-optional-property-types, no-implicit-override.
3. In `packages/api-client`: generate types from `openapi.json`, a typed fetch wrapper that returns three distinct error kinds (network, API envelope, non-JSON), request timeouts, and zod schemas only for values the spec cannot express (see `types-testing.md`).
4. Configure Vitest with type checking on for `*.test-d.ts` files and write the baseline type tests from the catalog in `types-testing.md`.
5. ESLint: forbid `any`, non-null assertions and `as` casts outside the api-client package.
6. Implement the CI check "generated client is up to date" and the enum parity script (spec vs TypeScript vs Python).
7. Build fails if the API base URL variable is missing; no silent localhost default in production builds.

## Files (touch only these)
`package.json`, `tsconfig.base.json`, `packages/api-client/*`, `packages/ui/*`, `web/*`, `shop/*`, CI.

## Edge cases: behavior
- Missing `openapi.json`: generation fails with a clear message.
- Hand-edited generated file: CI diff fails.
- 204 responses and empty bodies handled; a 502 HTML page from a proxy becomes the non-JSON error kind.

## Edge cases: types
- Loosening a type (any, widened union) must make a type test fail. See baseline catalog.

## Tests and regression
- Baseline type tests with negative cases; wrapper tests with a mock server for all three error kinds; stale-client check fails when the generated file is modified.

## Done when
- `make test-types` and `make test-web` green; CI fails on a stale generated client.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| 2026-10-07 | Step 04 verification: workspaces, strict base tsconfig, openapi typegen, fetch client (3 error kinds, timeouts, 204 & 502 handling), Zod boundary schemas, compile-time baseline type tests (*.test-d.ts), ESLint rules (forbid any, !, as outside api-client), enum parity script, freshness check, production build enforcement. | Implemented and verified with make check passing | feat(web): workspaces, typed api client, type tests | R1 |
