# Real sandbox mode (no stub)

Everything here uses the real PayPal sandbox API, the real LLM and the real database.
The PayPal stub is never started. Use this for judges and for the deployment rehearsal.

## What is real

| Piece | Real or simulated |
|---|---|
| Orders, approval, capture | Real PayPal Orders v2 (sandbox buyer logs in and pays) |
| Disputes, evidence, offers, messages | Real PayPal Disputes v1 |
| Webhooks | Real, signature-verified; poller catches anything missed |
| Agent reasoning | Real LLM through the configured OpenAI-compatible endpoint |
| Carriers and tracking | Simulated (fictional tracking numbers) |

The demo scenario buttons (A-E) are **disabled** in real mode: they need a pooled set of fake
transactions. Real disputes arrive from real orders, through the shop and PayPal.

## 1. Prerequisites

- Docker Desktop running, ports 8000, 5173, 5174 and 5432 free.
- ngrok (install: `winget install Ngrok.Ngrok`, then `ngrok config add-authtoken <token>`).
- `signoff/.env` filled in: PayPal client id/secret, merchant id, buyer payer id and email,
  LLM key/model/base URL, `APPROVAL_TOKEN_SECRET` (32+ chars).

## 2. Start the tunnel and register the webhook

1. Run `ngrok http 8000` and copy the `https://….ngrok-free.app` URL.
2. In `signoff/.env` set:
   - `PUBLIC_BASE_URL=<ngrok url>`
   - `WEB_BASE_URL=http://localhost:5173` (the merchant app; public URL after hosting)
   - `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174` plus any hosted origins
   - `LOG_APPROVAL_LINKS=true` so approval links appear in the agent log for the phone demo
3. From `signoff/`: `python -m scripts.register_webhook`
   It prints `PAYPAL_WEBHOOK_ID=…`; put that value in `signoff/.env`.
   Re-run it whenever the ngrok URL changes.

## 3. Start the real stack

From the repo root:

```
docker compose --env-file signoff/.env -f compose.yaml -f compose.real.yaml \
  up -d --build postgres migrate agent worker web shop
```

This starts only the real services (no stub, no fake LLM, no demo seeding). Check
`http://localhost:8000/readyz` returns `ready`, then open `http://localhost:5173` and
`http://localhost:5174`.

## 4. Buyer path (this is what judges do)

1. Open the shop at `http://localhost:5174`, add a candle and check out.
2. In the PayPal popup, log in with the sandbox **personal** account and approve. The shop
   captures the payment and stores the real capture transaction id.
3. Open the PayPal Resolution Center as the buyer:
   `https://www.sandbox.paypal.com/resolutioncenter`.
4. Choose the payment, click **Report a Problem**, pick **I haven't received the item or
   service**, choose the item type and category, accept the terms and submit.
5. Within a few seconds (webhook) or up to 30 seconds (poller) the dispute appears in the
   merchant app at `http://localhost:5173/app/disputes`.

The shop's "report a problem" button uses PayPal's buyer-assertion API. That API needs the
`DISPUTE_CREATE` permission provisioned on the app by PayPal, which a standard sandbox app
does not have, so the button returns a clear message and the resolver uses the Resolution
Center instead. Everything after the dispute exists is fully automatic.

## 5. What the agent does

The worker reconciles every 5 seconds and reacts to webhooks. On a dispute that needs a
seller response it builds evidence, asks the LLM for a plan, applies the charter gate and
executes only what the gate allows. Watch `http://localhost:5173/app/disputes`.

When a decision needs approval, the agent log shows:

```
APPROVAL_LINK dispute=… url=http://localhost:5173/approve/<token>
```

Open that link (or scan it on a phone on the same network) to approve, deny or edit the
amount. The token is single use.

## 6. Known limits

- Buyer-assertion dispute creation: needs `DISPUTE_CREATE` from PayPal; use the Resolution Center.
- Demo scenarios A-E: stub only, intentionally disabled here.
- Carrier tracking: simulated.
- AG Studio watermark: expected without a licence (ADR-015).
- `make rehearse` currently matches no `@live` specs; the buyer path above is the rehearsal.

## 7. Restart / clean run

`docker compose --env-file signoff/.env -f compose.yaml -f compose.real.yaml down`
keeps the Postgres volume. Add `-v` to reset disputes and ledger rows as well.
