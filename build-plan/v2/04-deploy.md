# 04 — Deploy to Render

**Goal:** three public URLs a judge can open on a phone, backed by one Postgres database and a running worker.
**Time:** 5 hours, including the first build.
**Before you start:** Stage 1 committed and pushed. Stage 2 values collected. Render account with the hackathon credit applied.

---

## What gets created

| # | Service | Type | What it serves |
|---|---|---|---|
| 1 | `signoff-db` | Postgres | The database |
| 2 | `signoff-api` | Web service, Docker | FastAPI, webhooks, approvals |
| 3 | `signoff-worker` | Background worker, Docker | The agent loop, sync, execution |
| 4 | `signoff-web` | Static site | Merchant app |
| 5 | `signoff-shop` | Static site | Buyer shop |

Two services use the same image (`signoff/agent/Dockerfile`) with different commands. The Dockerfile deliberately has no `CMD`; each service supplies one.

**Plan choice, decide before you start.** Your own launch plan notes two things that shape this: free instances sleep after inactivity, and free Postgres expires. Confirm both on `https://render.com/pricing` before you choose, because they decide whether a judge arriving in December finds a working link.

The safer choice given judging runs to 15 December: a paid Postgres, and a paid instance for the API and the worker, so nothing sleeps and nothing expires. Static sites are normally free. Check the current prices yourself and compare against your remaining credit — do not rely on a number in this file.

---

## Step 1 — Create the database
**YOU.**

1. Render dashboard → **New** → **Postgres**.
2. Name `signoff-db`. Region: pick the one closest to you; use the same region for every service.
3. Choose the smallest **paid** plan. Note the price.
4. Create, wait for status **Available**.
5. Copy the **Internal Database URL**. It looks like `postgresql://user:pass@host/dbname`.

**Convert it before use.** The app uses the psycopg 3 driver, so the scheme must be `postgresql+psycopg://`. Rewrite it as:

```
postgresql+psycopg://user:pass@host/dbname
```

Save that as `DATABASE_URL`. Using the raw Render URL produces `ModuleNotFoundError: No module named 'psycopg2'` at migration time — that is the symptom, not a missing dependency.

## Step 2 — Create the API service
**YOU.**

1. **New** → **Web Service** → connect the `AkinDiamonds/signoff-project` repo.
2. Name `signoff-api`. Region: same as the database. Branch `main`.
3. Runtime: **Docker**. Dockerfile path: `signoff/agent/Dockerfile`. Docker build context: `.` (the repository root).
4. Instance type: the cheapest paid one.
5. **Health check path:** `/readyz`.
6. **Start command:**
   ```
   python -m uvicorn agent.app.main:app --host 0.0.0.0 --port $PORT
   ```
   The app must bind to Render's `$PORT`. Binding to a fixed `8000` will fail the health check.
7. **Pre-deploy command:**
   ```
   python -m alembic upgrade head
   ```
   If the dashboard does not offer a pre-deploy command on your plan, put the migration in the start command instead:
   ```
   sh -c "python -m alembic upgrade head && python -m uvicorn agent.app.main:app --host 0.0.0.0 --port $PORT"
   ```
   Do not run migrations from both the API and the worker; one of them must own it.
8. **Environment variables** — add every name from `signoff/docs/env-checklist.md`, with these deployment values:

   | Variable | Value |
   |---|---|
   | `APP_ENV` | `prod` |
   | `PAYPAL_ENV` | `sandbox` |
   | `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` |
   | `DATABASE_URL` | the converted internal URL from Step 1 |
   | `PUBLIC_BASE_URL` | the API's public URL — fill after the first deploy |
   | `WEB_BASE_URL` | the merchant site URL — fill after Step 4 |
   | `ALLOWED_ORIGINS` | `<merchant site>,<shop site>` — fill after Steps 4 and 5 |
   | `APPROVAL_TOKEN_SECRET` | from Stage 2 |
   | `STORE_API_KEY` | a long random string (see below) |
   | `DEMO_HOLD_DISPUTES` | `true` for the judge flow, `false` to let the agent run immediately |
   | `DEMO_CLAIM_TOKEN` | a non-empty demo token, for example `demo-token-active` |
   | `DEMO_SHOW_APPROVAL_LINKS` | `true` so a judge can reach the approval card |
   | `LOG_APPROVAL_LINKS` | `false` |
   | `DEMO_FROZEN` | `false` |

   `STORE_API_KEY` must be the **same value on the API and the worker**: the worker calls the API's own
   `/api/store/*` endpoints with it. Generate one with
   `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Production refuses to start without it.

   Leave `PAYPAL_WEBHOOK_ID` empty for now. The app starts without it; webhooks will fail verification until Step 6.

9. Deploy. First build takes several minutes.
10. Copy the service URL, for example `https://signoff-api.onrender.com`.

**Check:**
```bash
curl https://signoff-api.onrender.com/healthz
curl https://signoff-api.onrender.com/readyz
```
Expected: `{"status":"ok",...}` and `{"status":"ready","database":"connected"}`. If `/readyz` returns 503, the database URL is wrong — revisit the `+psycopg` conversion.

## Step 3 — Create the worker
**YOU.**

1. **New** → **Background Worker** → same repo.
2. Name `signoff-worker`. Same region. Runtime **Docker**, same Dockerfile path and build context.
3. **Start command:**
   ```
   python -m agent.app.worker --poll-interval 0.2 --reconcile-interval 5
   ```
4. Environment variables: copy every one from the API service **except** `PORT`. Background workers do not serve HTTP, so no health check is needed.
5. Deploy.

**Check:** the worker log prints a start line and, within about 10 seconds, reconcile cycles. No restart loop.

If it restarts immediately, the usual cause is a missing environment variable. The log names it.

## Step 4 — Merchant site as a static site
**YOU.**

1. **New** → **Static Site** → same repo.
2. Name `signoff-web`.
3. **Build command:**
   ```
   npm ci --no-audit --no-fund && npm run -w @signoff/web build
   ```
4. **Publish directory:** `signoff/web/dist`
5. **Environment variables** (used at build time, so they must be set before the first build):
   - `VITE_API_URL` = the API URL from Step 2
   - `VITE_DEMO_CLAIM_TOKEN` = the same value as the API's `DEMO_CLAIM_TOKEN`
   - `PUBLIC_SHOP_URL` = the shop URL (fill after Step 5; rebuilding later is cheap)
6. **Rewrite rule** so client-side routes work: source `/*`, destination `/index.html`, action **Rewrite**. Without this, `/app/disputes` returns 404 on refresh.
7. Deploy, then copy the URL.

**Check:** open the URL. The landing page loads. Open `/app/disputes`. It loads and shows the dispute list, or an honest empty state. Open `/guide` and confirm the sandbox credentials card renders.

## Step 5 — Shop as a static site
**YOU.**

1. **New** → **Static Site** → same repo.
2. Name `signoff-shop`.
3. **Build command:**
   ```
   npm ci --no-audit --no-fund && npm run -w @signoff/shop build
   ```
4. **Publish directory:** `signoff/shop/dist`
5. Environment variables:
   - `VITE_API_URL` = the API URL
   - `PUBLIC_SIGNOFF_URL` = the merchant site URL
   - `VITE_PAYPAL_CLIENT_ID` = the sandbox client id (this is public by design; the secret never ships)
6. Same rewrite rule to `/index.html`.
7. Deploy, copy the URL.

## Step 6 — Close the loop: CORS and the webhook
**YOU.**

1. Back in `signoff-api` → Environment, set:
   - `PUBLIC_BASE_URL` = `https://signoff-api.onrender.com`
   - `WEB_BASE_URL` = the merchant site URL
   - `ALLOWED_ORIGINS` = `<merchant site>,<shop site>` (comma-separated, no trailing slash)
2. Redeploy the API.
3. Register the webhook. Run this **locally**, with your local `signoff/.env` pointing `PUBLIC_BASE_URL` at the deployed API:
   ```
   cd signoff
   ./.venv/Scripts/python.exe -m scripts.register_webhook
   ```
   It prints `PAYPAL_WEBHOOK_ID=...`.
4. Put that value into the Render API service's `PAYPAL_WEBHOOK_ID` and redeploy.
5. Also put it into your local `.env` so local and deployed agree.

**Check:** in the PayPal developer dashboard, the webhook shows as **active** with the URL `https://signoff-api.onrender.com/webhooks/paypal`. Then trigger a real event at Stage 5 and watch it arrive.

## Step 7 — Prove it from a phone
**YOU.**

1. Open the merchant site on your phone, on mobile data, not your home wifi.
2. Open the shop on the same phone.
3. Tap through a product and reach the PayPal button. Do not pay yet.
4. Confirm no CORS error appears in the browser console on either site.

A CORS error here means `ALLOWED_ORIGINS` has a trailing slash, a missing scheme, or is missing one of the two origins.

## Step 8 — Record the URLs
**YOU.** Add to the root `README.md`, replacing `HOSTED_URL_PLACEHOLDER`:

```
Merchant: <url>
Shop:     <url>
API:      <url>
```

Commit and push.

---

## Optional: codify it as `render.yaml`

Only after the dashboard deploy works. A Blueprint file makes rebuilds repeatable, but the field names must be checked against `https://render.com/docs/blueprint-spec` because they change. Do not hand-write it from memory, and do not let it block the deploy. If you write one, apply it to a **new** set of services first, confirm they come up, then delete the old ones.

---

## Done when

- [ ] `https://<api>/healthz` returns ok
- [ ] `https://<api>/readyz` returns ready with the database connected
- [ ] The worker is running without a restart loop
- [ ] The merchant site and shop both load over HTTPS on a phone
- [ ] `/app/disputes` survives a page refresh (rewrite rule working)
- [ ] The PayPal webhook is active and points at the deployed API
- [ ] `README.md` carries the three URLs

---

## If it goes wrong

**Build fails with `npm ci` and a missing workspace.** The web build needs every workspace manifest. Confirm `signoff/web/package.json`, `signoff/shop/package.json`, `signoff/packages/ui/package.json` and `signoff/packages/api-client/package.json` are all committed.

**`ModuleNotFoundError: No module named 'psycopg2'`** — `DATABASE_URL` still starts with `postgresql://`. It must be `postgresql+psycopg://`.

**`Production startup failed. Missing required environment variables`** — the log lists the names. Add them to the API service and redeploy.

**Port scan / health check fails.** The start command binds to `8000` instead of `$PORT`.

**Worker exits with code 1 immediately.** Copy the API's environment variables across; one is missing.

**Everything 404s except the landing page.** The static site rewrite rule is absent.

---

## Cut

In this order: run the worker on the same instance as the API (fold it in, saves a service, loses the clean separation — document it), drop the shop to a Docker web service instead of a static site, postpone the phone test.
