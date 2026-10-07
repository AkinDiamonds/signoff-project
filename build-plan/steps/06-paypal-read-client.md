# Step 06: PayPal read client and token cache

Phase: P1 Ingestion · Depends on: 05 · Estimate: 2h with an agent · Commit: `feat(paypal): read-only client with token cache and retries`
Status: [ ] not started
Assumes (step 00 table): S12 toolkit auth. If the answer changed, edit this file first and log it below.

## Goal
A GET-only client that is safe to hand to the agent.

## Do (in order)
1. Implement token fetching with caching, an expiry margin and a single in-flight refresh.
2. Implement list disputes (paginated) and get dispute, with connect and read timeouts, bounded retries with jitter on 5xx, 429 and network errors, honoring Retry-After up to a cap.
3. Log the PayPal debug id on every response; never log tokens.
4. Define the read tool allowlist as a frozen set of names.
5. If ADR-009 says to use the Agent Toolkit for reads, wrap its list and get tools behind the same interface; otherwise skip.

## Files (touch only these)
`agent/app/paypal/read_client.py`, `agent/app/paypal/auth.py`, `agent/app/agent/tools.py`, tests.

## Edge cases: behavior
- Token expires mid-request: one refresh and one retry, then fail.
- Many concurrent calls during refresh: one token request.
- 404 on a dispute is a typed not-found, not retried.
- Pagination that repeats the same next link: stop after a page cap.
- Redirect to a different host is not followed.
- Response is not JSON: typed upstream error.

## Edge cases: types
- Methods return parsed models or a typed error union, never raw dictionaries; a test asserts the class exposes no method that sends non-GET requests.

## Tests and regression
- Mocked-HTTP scenarios for each case above; log capture proves no token leakage; fake clock for backoff.

## Done when
- Tests green; client usable against the sandbox in a manual smoke script.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
