# 09 — UI: the buyer shop

**Goal:** the shop looks like a real small candle store a buyer would trust, and the buyer's dispute view looks like the other side of the same product.
**Time:** 3 hours.
**Before you start:** Stage 7 done. Stage 8 optional but recommended.

---

## Why the shop matters more than it looks

The shop is the only part of the demo that is *not* a dashboard. It is what proves the story: a buyer buys, a buyer complains, a merchant responds. If the shop looks like a mock, the whole product reads as a mock.

Two audiences see it: the judge clicking through, and the camera in the video.

---

## Step 1 — Pick and lock the catalogue (20 min)
**YOU.** Five products, real-sounding, consistent:

| SKU | Name | Price |
|---|---|---|
| CND-LAV-01 | Lavender candle | USD 21.00 |
| CND-VAN-02 | Vanilla candle | USD 19.00 |
| CND-CED-03 | Cedar candle | USD 24.00 |
| CND-ROSE-04 | Rose candle | USD 22.00 |
| GIFT-SET-01 | Candle gift set | USD 60.00 |

These match the SKUs the seeded scenarios already reference (`signoff/agent/app/store_mock/scenarios.py`), so proof lines up with what the shop shows. Do not invent new SKUs.

**Check:** `GET /api/shop/catalog` returns exactly these five.

## Step 2 — Restyle the catalogue and product pages (60 min)

**PROMPT.**

> Restyle `signoff/shop/src/` to the tokens from `@signoff/ui`, but with a warmer, more retail treatment than the merchant app:
>
> 1. Shop pages use the same Inter and the same 8px radius, but the page background is `#FFFFFF` and cards have no border — separation comes from spacing and a single subtle shadow.
> 2. Product grid: three columns at 1440px, two at 768px, one at 390px. Each card: square image area with a solid warm background and the product initial in a large serif, name at 15px semibold, price at 13px secondary, no "Add to cart" button on the card — the whole card is the link.
> 3. Product page: image left, details right on desktop; stacked on mobile. Add to cart is the only dark button on the page.
> 4. A persistent, quiet sandbox banner at the top: "Demo store. Payments use the PayPal sandbox. No real money moves." 12px, secondary, no dismiss button.
> 5. Remove the cart drawer if it exists; use a page at `/cart` with a single-column summary and one checkout button.
>
> Keep every `data-testid` the shop tests use.

**Check:** `npx vitest run signoff/shop` passes; the shop looks right at 1440px and 390px.

## Step 3 — The checkout moment (45 min)

The PayPal window is the only place the buyer leaves your design. Make the handoff calm.

**PROMPT.**

> On the cart page:
> 1. Above the checkout button, show a one-line summary: "2 items · USD 42.00".
> 2. The button reads **Pay with PayPal** and is the only primary action.
> 3. While the PayPal window is open, show a quiet inline status under the button: "Waiting for PayPal…" with a spinner, and disable the button.
> 4. On success, go to the confirmation page showing the order code in large monospace, the amount, and one next action: **Track this order**.
> 5. On failure or cancel, show one sentence and re-enable the button. Never leave a half-filled state.

**Check:** buy once with the sandbox buyer account and confirm the confirmation page shows the order code.

## Step 4 — Buyer dispute portal (60 min)

**PROMPT.**

> Restyle the buyer dispute view (`signoff/shop/src/portal/`) as the buyer's side of the same product:
>
> 1. Header: "Order SIG-A-1001" with the amount and status.
> 2. A tracking timeline using the same visual language as the merchant timeline, but simplified: dot, line, one line of text per event, dates in 12px secondary.
> 3. When there is a dispute, a card titled "Your case" with the status in a `StatusBadge` and the merchant's latest message.
> 4. **Report a problem**: a single form, three reasons only (item not received, not as described, other), an amount field pre-filled with the order total, a message box, and a submit button. Helper text explains that in the real flow PayPal opens the case. Be explicit and honest about the demo: "In this demo the case is opened for you."
> 5. The "view as merchant" link is a secondary link, not a button, and only appears in the demo.
>
> Never render buyer input as HTML. Keep the existing escaping.

**Check:** report a problem, then open the merchant app and see the dispute appear.

## Step 5 — Mobile pass (20 min)
**YOU.** Load the shop on your phone. Buy something. Confirm:
- The product grid is one column and the tap targets are at least 44px.
- The cart is reachable without horizontal scrolling.
- The PayPal window returns to your tab, not to a blank page.

---

## Done when

- [ ] Catalogue matches the five SKUs the scenarios reference
- [ ] Checkout works end to end with the sandbox buyer
- [ ] The dispute portal renders the buyer's view of a real dispute
- [ ] Mobile pass done
- [ ] Shop tests pass
- [ ] No hard-coded hex outside the tokens

---

## If it goes wrong

**PayPal button never appears.** `VITE_PAYPAL_CLIENT_ID` missing at build time. It is a build-time value; rebuild.

**The confirmation page loses the order.** The capture succeeded but the response was not stored. Check `POST /api/shop/orders/{code}/capture` in the API log.

---

## Cut

In this order: the product page (link straight to cart), the tracking timeline in the portal, the "waiting for PayPal" state.
