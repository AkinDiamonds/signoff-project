# Step 30: Storefront backend: catalog, orders, checkout

Phase: P6 Client-facing · Depends on: 21,23 · Estimate: 3h with an agent · Commit: `feat(shop): catalog, order create and capture`
Status: [ ] not started
Assumes (step 00 table): checkout approach. If the answer changed, edit this file first and log it below.

## Goal
Real sandbox purchases that produce transactions the agent can later be asked to defend.

## Do (in order)
1. Add the catalog (fictional candles, fixed prices in the database).
2. Add an orders client for PayPal order create and capture as its own module importable only from the shop package; extend the import contract so agent and policy packages cannot import it.
3. `POST /api/shop/orders` computes the total on the server; `POST .../capture` records the transaction id and schedules mock tracking according to the scenario rules; `GET` for buyers requires order code and email.
4. Record intent before calling PayPal and reconcile orders found at PayPal but missing locally.

## Files (touch only these)
`agent/app/shop/*`, `agent/app/paypal/orders_client.py`, tests.

## Edge cases: behavior
- Client-sent price is ignored; quantity 1 to 5; unknown product rejected.
- Double capture: idempotent. Capture of an unapproved order: mapped error.
- Captured amount differs from expected: order flagged, nothing shipped.
- Capture succeeded but local write failed: reconcile recovers.
- Pending orders expire; order lookup failures are uniform and rate limited; email case normalized.

## Edge cases: types
- The create-order request type has no price field (type test); quantity bounded in the schema.

## Tests and regression
- Matrix above against the stub; concurrent capture; import contract.

## Done when
- Tests green; one real sandbox purchase completed manually.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
