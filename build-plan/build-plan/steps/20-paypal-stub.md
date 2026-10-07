# Step 20: PayPal stub server for deterministic tests

Phase: P4 Simulation · Depends on: 05,07,13 · Estimate: 3h with an agent · Commit: `feat(stub): fixture-driven PayPal stub with fault injection`
Status: [ ] not started

## Goal
Run the whole system offline and deterministically in CI and Playwright.

## Do (in order)
1. Build a small server replaying recorded fixtures: token, list and get dispute, the mutating dispute calls with the state transitions recorded in the spike, order create and capture, and buyer-side dispute creation.
2. Add a webhook emitter that posts events to the agent with a stub signature accepted only by the stub verifier.
3. Add switches: duplicate delivery, out-of-order delivery, delayed delivery, fail the next N calls, add latency.
4. Add a test-only reset endpoint.
5. Guard: the stub cannot start or be selected when `APP_ENV` is prod.

## Files (touch only these)
`scripts/paypal_stub/*`, tests.

## Edge cases: behavior
- Illegal transitions (evidence after resolution) return the recorded PayPal error shape.
- Deterministic identifiers and timestamps.
- Reset fully restores initial state.

## Edge cases: types
- Every stub response is validated by the same models used for real responses; a drift test compares stub shapes with the recorded fixtures.

## Tests and regression
- Stub self-tests; drift test; fault-injection tests reused by step 34.

## Done when
- Tests green; `make dev` can run the stack against the stub.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
