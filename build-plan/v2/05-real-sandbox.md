# 05 — Real PayPal sandbox, end to end

**Goal:** a real sandbox payment produces a real dispute, the deployed webhook receives it, and the agent acts on it — with nothing running on your laptop.
**Time:** 4 hours, most of it waiting for PayPal.
**Before you start:** Stage 4 done. Deployed API healthy, webhook active.

---

## What this stage proves, and what it does not

This stage proves the **PayPal half**: payment, dispute, webhook, sync, gate, execution, ledger.

It does **not** prove the store half. The agent looks up order proof by PayPal transaction id, and the only ids it currently knows are the five stub ids (`TX-SCENARIO-A` … `TX-SCENARIO-E`). A real sandbox payment has a real transaction id, so the agent will run with no store proof until Stage 6 seeds an order against that id. That is expected. Do not chase it here.

---

## Step 1 — Buy something in the shop
**YOU.**

1. Open the deployed shop.
2. Add any candle. Go through checkout.
3. In the PayPal window, log in with the sandbox **personal** (buyer) account whose email is in `PAYPAL_BUYER_EMAIL`.
4. Approve the payment.

**Check:** the shop shows an order code and the API log shows a capture. Then confirm the transaction id was stored:

```bash
curl https://<api>/api/shop/orders/<ORDER_CODE>
```

The response includes the capture transaction id. Copy it, for example `1AB23456CD789012E`.

If the PayPal window fails to open, `VITE_PAYPAL_CLIENT_ID` is missing from the shop's build environment and the static site was built before you added it. Rebuild.

## Step 2 — File the dispute as the buyer
**YOU.** Your `docs/real-mode.md` says the shop's own "Report a problem" button needs a `DISPUTE_CREATE` permission the app does not have by default. Try the button first. If it returns a permission message, file the dispute directly in PayPal as below and note the confirmation in `decision-log.md` (D14 area). Do not assume — the result decides what the guide page tells judges.

1. Open `https://www.sandbox.paypal.com/resolutioncenter` and log in as the **personal** account.
2. Find the payment. Click **Report a Problem**.
3. Choose **I haven't received the item or service**, complete the item type and category, accept the terms, submit.

**Write down the date it says you must respond by.** That number decides how often the judge pool must be refreshed in Stage 6.

## Step 3 — Watch the webhook arrive
**YOU.** Open the API logs in Render, filtered to the last five minutes.

Within about 10 seconds you should see a webhook received line, then a sync job enqueued. If nothing arrives within 60 seconds, the reconciler picks it up — it polls every 5 seconds — and you will see `Reconciler enqueued SYNC_DISPUTE`.

**Check:** `https://<merchant site>/app/disputes` lists the new dispute.

If the webhook never arrives but the dispute does appear, the reconciler saved you: record it, then fix the webhook anyway, because the video should not depend on a poller.

## Step 4 — Confirm signature verification is real
**YOU.** A webhook that is merely *received* proves nothing. Prove it was *verified*.

```bash
curl -X POST https://<api>/webhooks/paypal \
  -H "Content-Type: application/json" \
  -H "PAYPAL-TRANSMISSION-ID: 00000000-0000-0000-0000-000000000000" \
  -H "PAYPAL-TRANSMISSION-TIME: 2026-10-27T10:00:00Z" \
  -H "PAYPAL-CERT-URL: https://api.sandbox.paypal.com/v1/notifications/certs/NOPE" \
  -H "PAYPAL-AUTH-ALGO: SHA256withRSA" \
  -H "PAYPAL-TRANSMISSION-SIG: bogus" \
  -d '{"id":"fake","event_type":"CUSTOMER.DISPUTE.CREATED"}'
```

Expected: a 4xx and **no** new dispute row. If this returns 200, signature verification is disabled and you have a security claim in the README that is false. Stop and fix it before recording anything.

## Step 5 — Watch the agent decide
**YOU.** Open the dispute in the merchant app.

Expected timeline entries, in order: dispute synced, agent run started, plan proposed, gate decided with a rule id, execution intended, execution confirmed. The verdict chip shows Allowed, Needs Approval, or Denied with its rule id.

**With no store order bound to this transaction**, expect the agent to stop for human review or to proceed without evidence. Both are correct behaviour; note which happened.

## Step 6 — Reach an approval card
**YOU.** If the decision needs approval, the link is only printed to the server log today (`LOG_APPROVAL_LINKS=true`). For this stage, that is enough:

1. Set `LOG_APPROVAL_LINKS=true` on the API service, redeploy.
2. Trigger a decision that needs approval — a dispute above the charter limit. The default charter allows auto-offers up to $25 and auto-acts up to $100 (`signoff/agent/app/policy/charter.py`), so a $180 dispute qualifies.
3. Copy the `APPROVAL_LINK` line from the log and open it.
4. Approve it on your phone.

**Check:** the approval page renders, approving succeeds, and the timeline records the outcome.

This is the manual flow. Stage 6 replaces it with a link a judge can click without your server log.

## Step 7 — Measure how long the pool lasts
**YOU.** From Step 2 you have a due date. Record it. General guide from the sandbox: response windows are typically measured in days, not hours, but treat your own number as the truth.

Write in the pool table at the bottom of this file:

| Dispute | Amount | Created | Buyer due date | Days of usable life |
|---|---|---|---|---|
|  |  |  |  |  |

Rule: any dispute older than two thirds of its window must be replaced before you record the video.

## Step 8 — Check the cost of one full run
**YOU.** In the API status endpoint:

```bash
curl https://<api>/api/status
```

Note `queue_depth`, `dead_letter_count` and `llm_mode`. `llm_mode` must be `LIVE`; if it reads `CACHED`, the LLM key is wrong or the provider is failing, and every dispute will look identical in the video.

---

## Done when

- [ ] A real sandbox payment produced a real dispute
- [ ] The deployed app received it (webhook, or reconciler as a recorded fallback)
- [ ] A forged webhook was rejected
- [ ] The agent produced a decision with a rule id on the deployed instance
- [ ] An approval was resolved from a link on a phone
- [ ] `llm_mode` is `LIVE`
- [ ] The due-date table is filled in

---

## If it goes wrong

**Webhook returns 400/401.** `PAYPAL_WEBHOOK_ID` does not match the subscription. Re-run `scripts/register_webhook.py` and copy the new id into Render.

**Dispute appears but no timeline.** The worker is down or its environment is missing a variable. Check the worker log.

**`llm_mode: UNAVAILABLE`.** The provider rejected the key or the model id. Test the key directly against the base URL.

**Approval link 404s.** `APPROVAL_TOKEN_SECRET` differs between the instance that created the link and the one serving it — you probably regenerated it. Links issued before the rotation are dead by design.

---

## Cut

Nothing. This stage is the difference between "an app that integrates PayPal" and "an app with fixtures".
