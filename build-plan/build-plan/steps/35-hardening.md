# Step 35: Hardening and security

Phase: P7 Integration · Depends on: 34 · Estimate: 3h with an agent · Commit: `fix(security): limits, cors, headers, fuzz`
Status: [ ] not started

## Goal
Safe for the public internet before deployment.

## Do (in order)
1. Rate limits on every public endpoint (per IP and per session) with the standard envelope and Retry-After.
2. CORS allowlist of exactly the three origins; cookie policy for the demo session (same registrable domain across subdomains; secure, not readable by scripts).
3. Security headers and a content policy that allows AG Studio and the PayPal checkout origins (VERIFY the exact origins).
4. Run API fuzzing from the OpenAPI spec (needs an ADR line); dependency audits for both ecosystems; log redaction and personal-data scans.

## Files (touch only these)
`agent/app/middleware/*`, header config for both web apps, tests.

## Edge cases: behavior
- Preflight requests, spoofed origins, oversized headers and bodies, unicode everywhere.
- Kill switch while jobs are in flight: jobs finish, no new scenarios start.
- No 5xx under fuzzing.

## Edge cases: types
- Origin configuration parsed into a typed list; invalid entries fail startup.

## Tests and regression
- Header assertions; rate limit boundaries; fuzz run clean; full e2e re-run.

## Done when
- All green; audit report saved in `docs/`.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
