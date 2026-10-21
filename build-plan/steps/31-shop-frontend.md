# Step 31: Storefront frontend

Phase: P6 Client-facing · Depends on: 30,24 · Estimate: 3h with an agent · Commit: `feat(shop): storefront, cart and checkout`
Status: [x] done
Assumes (step 00 table): checkout approach. If the answer changed, edit this file first and log it below.

## Goal
A believable shop where a judge can buy something in sandbox.

## Do (in order)
1. Build home and catalog, product, cart, checkout (using the approach chosen in step 00) and confirmation with order code.
2. Add the persistent "fictional shop, PayPal sandbox" banner, a collapsible "how to pay in sandbox" block with the public test buyer details, and links to the Signoff site and guide.
3. Add the "Use a demo order" shortcut that claims a pooled paid order for the session.
4. Apply a separate warm theme using the shared components.

## Files (touch only these)
`shop/src/*`, tests.

## Edge cases: behavior
- Payment popup blocked or closed; cancel returns to an intact cart.
- Slow capture shows pending with retry and timeout.
- Cart storage failure or stale prices: server price wins and the UI refreshes.
- Empty cart, multiple tabs, back after payment, SDK failed to load.

## Edge cases: types
- Cart item type excludes price; money rendered only through the shared component.

## Tests and regression
- Playwright with the stub: add to cart, pay, confirm; cancel path; a request-tampering test (intercept and change price) proves the server price is used.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| 2026-10-21 | Type test syntax truncated in `cart.test-d.ts` | Completed `CreateOrderPayload` type test | — | R1 |
| 2026-10-21 | `onApprove` stale-closure: `pendingOrderCode` state was `null` on first render; buttons re-mounted mid-flow | Added `pendingOrderCodeRef` ref; `onApprove` reads ref, deps array drops `pendingOrderCode` | — | R1 |
| 2026-10-21 | `handleSandboxFallbackPay` double-set `capturing=true`; duplicate catch | Removed redundant outer `setCapturing(true)`; single error path | — | — |
| 2026-10-21 | `VITE_MOCK_API` undeclared in `vite-env.d.ts` | Added env var declaration | — | — |
| 2026-10-21 | `ShopBanner` port-sniffing fallback brittle in non-local deploys | Removed; rely solely on `PUBLIC_SIGNOFF_URL` env var | — | — |

