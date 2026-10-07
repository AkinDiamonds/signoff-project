# Step 32: Buyer portal: orders, tracking, dispute, messages

Phase: P6 Client-facing · Depends on: 31,23,19 · Estimate: 4h with an agent · Commit: `feat(shop): buyer portal and dispute creation`
Status: [ ] not started
Assumes (step 00 table): S9, S10. If the answer changed, edit this file first and log it below.

## Goal
The buyer side of every scenario can be driven from the browser.

## Do (in order)
1. Order lookup (code and email) and order detail with the mock tracking timeline.
2. "Report a problem" form: supported reasons only, amount up to the order total, message; creates the dispute through the buyer client.
3. Buyer dispute view: status, merchant messages and offers; buyer can reply with a message (scenario D) and respond to an offer if S9 allows.
4. A "view as merchant" link deep-linking to the dispute in the Signoff dashboard.

## Files (touch only these)
`shop/src/portal/*`, `agent/app/shop/disputes.py`, tests.

## Edge cases: behavior
- Order paid with an account other than the linked sandbox buyer: dispute disabled with explanation and the demo-order alternative.
- Duplicate dispute for the same transaction: blocked with a link to the existing one.
- Amount above order total, empty or oversize message; double submit; PayPal failure.
- Markup in messages is escaped on both sides; buyer text is only ever passed on as data.
- Lookup errors are uniform.

## Edge cases: types
- The create-dispute request reason type contains only supported reasons; amount is the Money type (type tests).

## Tests and regression
- Playwright (stub): lookup, report problem, reply with a hostile message, deep link works.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
