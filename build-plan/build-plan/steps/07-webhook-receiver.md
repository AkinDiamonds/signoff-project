# Step 07: Webhook receiver

Phase: P1 Ingestion · Depends on: 03,05,06 · Estimate: 3h with an agent · Commit: `feat(webhook): verified, deduplicated receiver`
Status: [ ] not started

## Goal
Accept PayPal events safely and enqueue work without losing or duplicating any.

## Do (in order)
1. Add `POST /webhooks/paypal` reading the raw body before parsing.
2. Verify the signature using the method confirmed in the spike (verification API or offline); a stub verifier is selectable only when `PAYPAL_ENV` is stub.
3. In one transaction: insert the event (primary key = event id) and enqueue a sync job for the dispute.
4. Record and ignore event types we do not handle; respond 200 quickly.
5. Cap body size.

## Files (touch only these)
`agent/app/webhooks.py`, `agent/app/paypal/webhook_verify.py`, tests.

## Edge cases: behavior
- Duplicate delivery: 200, no second job.
- Twenty identical concurrent posts: one row, one job.
- Missing signature headers: 400. Invalid signature: reject and log, no processing.
- Verification service unavailable: respond 503 so PayPal retries; do not drop.
- Webhook id mismatch: reject. Unknown event type: 200 and ignored. Oversize body: 413.
- Event for a dispute outside our merchant: stored, no job.

## Edge cases: types
- A `VerifiedWebhook` type can only be produced by the verifier; the event envelope is a union keyed by event type.

## Tests and regression
- The full matrix above against real Postgres; recorded CREATED fixture verifies end to end in the stub.

## Done when
- Tests green; manual test with a sandbox webhook through your tunnel.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
