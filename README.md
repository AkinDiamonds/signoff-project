# Signoff

An AI agent that handles PayPal disputes for small online merchants inside limits the merchant sets.

```
signoff/web     merchant web    dashboard, dispute detail, approvals, AG Studio
signoff/shop    buyer shop      candle storefront, PayPal checkout, orders, simulated tracking
signoff/agent   API and worker  FastAPI service, worker, PayPal clients, ledger
```

## Try it

- Merchant dashboard: https://signoff-web.onrender.com
- Buyer shop: https://signoff-shop.onrender.com
- API: https://signoff-api.onrender.com
- Local stub demo: run `docker compose up --build -d`, then open `http://localhost:5173/app/demo`.

## What is real

Buyers approve their payment on PayPal-hosted checkout. If a problem arises, they separately open a dispute in PayPal's Resolution Center. Signoff receives verified PayPal webhooks and presents the merchant's evidence, policy decision and any required approval. The deployed shop does not host buyer dispute creation or replies.

| Part | Status |
|---|---|
| Disputes, evidence and offers | Real PayPal sandbox APIs |
| Shop payment | PayPal sandbox with hosted buyer approval |
| Shipping | Explicitly simulated |
| Agent reasoning | OpenAI-compatible provider behind a server proxy; deployed journey verification tracked below |

Current implementation and observed verification: [progress](build-plan/v3/PROGRESS.md), [release notes](build-plan/v3/RELEASE.md). This is an incremental release; pending fulfilment, notifications/push and full hosted journey work are not claimed complete.

## Built with

FastAPI, PostgreSQL, React, AG Studio, PayPal REST APIs, and an OpenAI-compatible LLM provider.

## License

MIT. See [LICENSE](LICENSE).
