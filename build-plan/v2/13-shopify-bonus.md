# 13 — Bonus: a real Shopify store

**Goal:** Signoff reads order and shipment proof from an actual Shopify store through the same `StoreAdapter` interface, proving the adapter is real and not a diagram.
**Time:** 4 hours. **Bonus only.** Do not start until Stages 1-12 are done.
**Before you start:** Stage 6 fused the adapter. The deployment is live and submitted.

---

## Decide before you spend the time

Your earlier plan assumed a Shopify development store cannot take real PayPal payments, so a Shopify order could not carry a sandbox transaction. **Confirm that yourself before building anything.** It changes the size of this stage completely.

**YOU — 20 minutes:**

1. Create the free development store (step 1 below).
2. At checkout, look at the payment options available for a test order.
3. Write the answer in `decision-log.md` under "Shopify dev store payments".

- **If PayPal appears as an option** → you can do the strong version: a Shopify order with a real PayPal sandbox transaction, matched to a real dispute. That is a much better demo. Budget 5 hours.
- **If it does not** → do the read-only version exactly as below, and say so in the video and README. Never claim a Shopify order was matched to a dispute when it was not.

---

## Steps

### 1. Create the store (30 min)
**YOU.**

1. Create a free Shopify Partner account and a development store from the Partner dashboard.
2. In the store admin, enable the **Bogus Gateway** for test payments (Settings → Payments).
3. Place one test order for a product you create with a real-sounding name.
4. Fulfil it with a carrier and a tracking number.

**Check:** the order shows as fulfilled with a tracking number in the admin.

### 2. Create a custom app and get credentials (20 min)
**YOU.** The current Shopify app flow uses a client id and secret, not a static token — the flow has changed more than once, so follow what the dashboard shows rather than a memory of it.

1. In the store admin, create a custom app.
2. Grant read scopes: `read_orders`, and the fulfillment read scope the API asks for.
3. Install it and copy the **client id** and **client secret**.

### 3. Implement the adapter (90 min)

**PROMPT.**

> Add a third implementation to `signoff/agent/app/store/`: `ShopifyAdapter`, implementing the same four-method `StoreAdapter` protocol as `HttpStoreAdapter` and `LocalStoreAdapter`.
>
> - Authenticate against the Shopify Admin **GraphQL** API using the client credentials flow: exchange client id and secret for an access token, cache it in memory until expiry, and refresh once on a 401.
> - `find_order(transaction_id)`: search orders whose transactions contain the PayPal transaction id. Return the same `OrderRecord` shape as the other adapters.
> - `get_shipments(order_code)`: return fulfillments with carrier, tracking number, tracking URL and events, mapped to `ShipmentRecord`.
> - `get_messages(order_code)`: Shopify does not store buyer messages on an order. Return an empty list and document why.
> - `get_policies()`: read the store's shipping and refund policy text; return an empty dict if absent, never invent values.
> - Add `ShopifyAdapter` to `factory.py`, selected by a new setting `STORE_PROVIDER=local|http|shopify`, default `http`.
> - Run the existing contract tests from `test_store_adapter_contract.py` against it with a recorded HTTP fixture. Every adapter must satisfy the same contract.

**Check:** the contract tests pass for all three adapters.

### 4. Show it (45 min)

**PROMPT.**

> Add a **Connect store** screen to the merchant app at `/app/store`. It shows the connected provider, what Signoff can read (orders, shipments, messages, policies), and a live health check that calls each method once and reports pass or fail per source. Providers not implemented appear as "Next" with a one-line note. Add a `data-testid` per source so a test can assert a healthy connection.

**Check:** the screen reports the Shopify sources as connected, using the real store.

### 5. Record and document (60 min)
**YOU.**

1. Record a 20-second clip: the Shopify admin order, then the Signoff evidence card showing the same carrier and tracking number with the source labelled `Shopify`.
2. Add it to the video only if the three-minute budget allows. Otherwise link it in the README.
3. Update the README and the landing page store section: replace "Shopify is the next implementation" with what is now true.
4. Add a claims-ledger row: "Signoff reads order proof from a live Shopify development store through the StoreAdapter", with the recording as proof.

**Phrasing to use, exactly:** "read-only connection to a Shopify development store." Do not say "Shopify integration" if it only reads.

---

## Done when

- [ ] The decision about dev-store payments is recorded
- [ ] `ShopifyAdapter` passes the shared contract tests
- [ ] The Connect store screen reports real health from the real store
- [ ] A recording exists and the claims ledger points at it
- [ ] README and landing page match what was actually built

---

## If it goes wrong

**Auth fails with 401 after the first call.** The token expired and the refresh path is not wired. Cache with an expiry margin and refresh once.

**Order search returns nothing for the transaction id.** The PayPal transaction sits on the order's transactions, not on the order. Query transactions and resolve the order from there.

**You cannot find the tracking number.** Fulfil the order in the admin and add a tracking number; an unfulfilled order has no shipment proof by definition.

---

## Cut

Everything. This stage is optional and nothing else depends on it. If the interface change in Stage 6 Part B is done, the story "Shopify is one adapter away" is already honest and already written down.
