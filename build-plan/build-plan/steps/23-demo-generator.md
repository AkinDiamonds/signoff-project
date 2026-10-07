# Step 23: Test-dispute generator, pool and quotas

Phase: P4 Simulation · Depends on: 20,21 · Estimate: 3h with an agent · Commit: `feat(demo): scenario generator, session scoping, quotas`
Status: [ ] not started
Assumes (step 00 table): S10 transaction reuse and pool size. If the answer changed, edit this file first and log it below.

## Goal
Anyone can create scenarios A to E safely and repeatedly.

## Do (in order)
1. Add the buyer-side dispute client (sandbox create-dispute with the buyer assertion) as its own module importable only by the simulator and shop packages; extend the import-linter contract.
2. Add `POST /api/demo/scenarios/{id}` claiming a pooled paid transaction, creating the dispute and tagging it with the demo session (per ADR-014); `GET /api/demo/pool`; `POST /api/demo/reset` (own session only).
3. Add `scripts/seed_sandbox.py` (idempotent) that fills the pool according to S10.
4. Quotas per session, per IP and per day; the global kill switch from settings.

## Files (touch only these)
`agent/app/paypal/buyer_client.py`, `agent/app/simulator/*`, `scripts/seed_sandbox.py`, tests.

## Edge cases: behavior
- Pool empty: clear conflict message.
- Two requests claim the same transaction: one wins (row lock).
- PayPal create fails: claim released, error returned with correlation id.
- Quota exceeded: 429 with reset time. Frozen: 503 message.
- Spoofed or unknown session id: ignored and a new one issued.
- Double click: idempotency key prevents duplicates.
- Reset hides the session's disputes; it never deletes ledger rows.

## Edge cases: types
- Scenario id is a union A to E; request bodies validated; quota response typed.

## Tests and regression
- Concurrent claim test; quota boundaries; kill switch; reset keeps append-only guarantees; import contract.

## Done when
- Tests green; one live sandbox run of scenario A created from the endpoint.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
