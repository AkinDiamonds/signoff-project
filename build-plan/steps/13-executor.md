# Step 13: Mutating client, executor and architecture guard

Phase: P2 Policy · Depends on: 12 · Estimate: 4h with an agent · Commit: `feat(executor): write-ahead executor and import guard`
Status: [ ] not started

## Goal
The only door to mutating dispute calls, with crash safety.

## Do (in order)
1. Implement the mutating dispute client: provide evidence (multipart), make offer, accept claim, send message, escalate, appeal.
2. Implement the executor per the write-ahead protocol in `plan/05-resilience.md`, accepting only an allowed decision type produced by the gate (or an approved one from `approval.py`).
3. Add the reconciler for executions stuck in intended or sent states: decide by re-fetching the dispute, never by re-sending.
4. Add the import-linter contract: only `app/executor` may import the mutating client; and a registry test that agent tools contain no mutating names.
5. Pre-validate evidence files and message text (size, type, length) before any call.

## Files (touch only these)
`agent/app/paypal/mutating_client.py`, `agent/app/executor/*`, import-linter config, tests.

## Edge cases: behavior
- Fingerprint changed since the decision: abort with the stale outcome.
- Same decision submitted twice: one call only.
- Timeout or 5xx after send: stays sent, resolved by re-fetch, never resent.
- PayPal 4xx: failed with debug id, no retry.
- Crash injected between each protocol step: state is recoverable every time.
- Dispute resolved between gate and execution: abort.
- Offer amount formatting exact to two decimals.

## Edge cases: types
- Executor signature rejects a raw action; a negative typing test (Python type checker plugin or a documented type-check failure case) proves it.

## Tests and regression
- Crash matrix; duplicate submission; import contract fails when a forbidden import is added (verify once by adding and removing one).

## Done when
- Tests green; manual sandbox run: evidence submitted for a spike dispute through the executor.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
