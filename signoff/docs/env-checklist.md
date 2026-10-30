# Environment Configuration Checklist

This checklist documents the required and optional environment variables across environments (`local`, `test`, `prod`).

## Core Configuration

| Variable | Required In | Description |
|---|---|---|
| `APP_ENV` | All | `local`, `test`, or `prod` (default: `local`). |
| `DATABASE_URL` | All | SQLAlchemy connection string (PostgreSQL or SQLite). |
| `PUBLIC_BASE_URL` | Prod | Publicly accessible agent API URL. |
| `WEB_BASE_URL` | Prod | Public frontend merchant application URL. |
| `ALLOWED_ORIGINS` | Prod | Comma-separated CORS allowed origins. |

## PayPal Configuration

| Variable | Required In | Description |
|---|---|---|
| `PAYPAL_ENV` | All | `sandbox` or `stub` (default: `sandbox`). |
| `PAYPAL_CLIENT_ID` | Prod | PayPal REST API client ID. |
| `PAYPAL_CLIENT_SECRET` | Prod | PayPal REST API secret. |
| `PAYPAL_WEBHOOK_ID` | Prod | Registered webhook ID for signature verification. |
| `PAYPAL_MERCHANT_ID` | Prod | Merchant account payer/account ID. |
| `PAYPAL_BASE_URL` | Optional | Custom PayPal API base URL (default: `api-m.sandbox.paypal.com`). |

## LLM & Store Adapter

| Variable | Required In | Description |
|---|---|---|
| `LLM_PROVIDER` | All | `glimmer` (hosted model) or `openai` (fallback). |
| `LLM_API_KEY` | When provider needs key | API key for the chosen LLM provider. |
| `LLM_API_BASE_URL` | When provider needs URL | Endpoint URL for the LLM provider. |
| `STORE_API_KEY` | Prod | Authentication key for store read API (`X-Store-Key`). It must be identical on the API and the worker, because the worker calls the API's store endpoints. |

## Demo & Judge Flow Settings

| Variable | Required In | Description |
|---|---|---|
| `DEMO_HOLD_DISPUTES` / `DEMO_POOL_HOLD` | Demo | Holds newly arriving disputes in pool until claimed by a judge. |
| `DEMO_CLAIM_TOKEN` | Demo | Secret token required in `X-Demo-Token` header for `/api/demo/claim/{dispute_id}`. |
| `DEMO_SHOW_APPROVAL_LINKS` | Demo | Exposes `approval_url` on `/api/disputes/{id}` for one-tap approval card access in demo. |
| `VITE_DEMO_CLAIM_TOKEN` | Web build | Build-time copy of `DEMO_CLAIM_TOKEN`; the pool page sends it as `X-Demo-Token`. |
| `DEMO_FROZEN` | Optional | Emergency kill switch: returns 503 for scenario generation. |
| `LOG_APPROVAL_LINKS` | Optional | Logs full approval URL to server log on card generation. |

