# Signoff

An AI agent that handles PayPal disputes for small online merchants inside limits the merchant sets.

```
signoff/web     merchant web    dashboard, dispute detail, approvals, AG Studio
signoff/shop    buyer shop      candle storefront, orders, tracking, buyer replies
signoff/agent   API and worker  FastAPI service, worker, PayPal clients, ledger
```

## Try it

- Hosted demo: `HOSTED_URL_PLACEHOLDER`
- Local stub demo: run `docker compose up --build -d`, then open `http://localhost:5173/app/demo`.

## What is real

| Part | Status |
|---|---|
| Disputes, evidence and offers | Real PayPal sandbox APIs |
| Candle shop orders and tracking | Simulated |
| Agent reasoning | A real LLM behind a server proxy |

## Built with

FastAPI, PostgreSQL, React, AG Studio, PayPal REST APIs, and an OpenAI-compatible LLM provider.

## License

MIT. See [LICENSE](LICENSE).
