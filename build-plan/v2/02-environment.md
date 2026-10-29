# 02 — Environment and secrets

**Goal:** every value the deployed app needs is known, correct, and stored in exactly two places: your local `signoff/.env` and Render's environment settings.
**Time:** 1 hour.
**Before you start:** Stage 1 committed.

---

## The rule

`signoff/.env` is gitignored. It is for local runs only. Render never reads it. Every value below must be entered **again** in Render's dashboard at Stage 4. Keep a single private note of which values exist (names only) so you do not forget one.

---

## Steps

### 1. Generate the approval token secret
**YOU.** This is what signs approval links. Production refuses to start if it is shorter than 32 characters.

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Save the output as `APPROVAL_TOKEN_SECRET`. Do not reuse an older value. If it changes after you have already printed an approval link, that link stops working — which is correct behaviour, but note it before the video.

### 2. Collect the PayPal sandbox values
**YOU.** Open `https://developer.paypal.com/dashboard/applications/sandbox`.

From the app you want to use:

| Variable | Where |
|---|---|
| `PAYPAL_CLIENT_ID` | App page, under "Client ID" |
| `PAYPAL_CLIENT_SECRET` | App page, "Secret", click "Show" |
| `PAYPAL_MERCHANT_ID` | The sandbox **business** account's merchant id (`developer.paypal.com/dashboard/accounts`) |
| `PAYPAL_BUYER_PAYER_ID` | The sandbox **personal** account's payer id |
| `PAYPAL_BUYER_EMAIL` | The sandbox personal account's email |

`PAYPAL_BASE_URL` is always `https://api-m.sandbox.paypal.com`. The app refuses any other host, and refuses plain HTTP except to a local stub.

`PAYPAL_WEBHOOK_ID` is not known yet. Stage 4 fills it in once the deploy has a public URL.

### 3. Collect the LLM values
**YOU.** You need an OpenAI-compatible endpoint. The app reads:

```
LLM_PROVIDER=<provider name>
LLM_MODEL=<model id>
LLM_API_KEY=<key>
LLM_API_BASE_URL=<base url>
LLM_DAILY_BUDGET_USD=3
USE_SCENARIO_CACHE=true
```

Confirm it works before you go further, because a dead LLM makes every dispute fall back to cached reasoning and the demo looks thin.

```bash
cd signoff
./.venv/Scripts/python.exe -c "
from agent.app.settings import Settings
s = Settings()
print('model:', s.llm_model)
print('base set:', bool(s.llm_api_base_url))
print('key set:', bool(s.llm_api_key))
print('budget:', s.llm_daily_budget_usd)
"
```

Expected: model printed, both `set:` lines `True`.

### 4. Write the local env file
**YOU.** Open `signoff/.env` and make it match the table below. Names only — fill the values yourself, never paste them into a chat, a commit, or this file.

```
APP_ENV=prod
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MERCHANT_ID=
PAYPAL_BUYER_PAYER_ID=
PAYPAL_BUYER_EMAIL=
LLM_PROVIDER=
LLM_MODEL=
LLM_API_KEY=
LLM_API_BASE_URL=
LLM_DAILY_BUDGET_USD=3
USE_SCENARIO_CACHE=true
DATABASE_URL=postgresql+psycopg://signoff:signoff@localhost:5432/signoff
PUBLIC_BASE_URL=http://localhost:8000
WEB_BASE_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
APPROVAL_TOKEN_SECRET=
DEMO_FROZEN=false
LOG_APPROVAL_LINKS=true
STORE_API_KEY=
```

Two new names appear here that the app does not read yet: `STORE_API_KEY` is added in Stage 6. Add it now so the file is stable.

`APP_ENV=prod` locally is deliberate: it forces the same startup validation the deployed app will use. If the app starts locally with these values, it will start on Render.

### 5. Prove the settings validate
**YOU.**

```bash
cd signoff
./.venv/Scripts/python.exe -c "
from agent.app.settings import Settings
s = Settings()
print('app_env:', s.app_env)
print('paypal_env:', s.paypal_env)
print('token len ok:', len(s.approval_token_secret) >= 32)
"
```

Expected: `prod`, `sandbox`, `token len ok: True`.

If it raises `Production startup failed. Missing required environment variables`, the listed names are empty in `.env`.

### 6. Rotate anything you have ever pasted anywhere
**YOU.** If any of these values has ever appeared in a chat, a screenshot, a commit, or a public file, generate a new one now:

- `PAYPAL_CLIENT_SECRET` → regenerate in the PayPal app page
- `LLM_API_KEY` → regenerate at your provider
- `APPROVAL_TOKEN_SECRET` → step 1 again

Nothing else in the plan is blocked by doing this now, and it removes a class of problem you cannot fix after the judges look.

### 7. Record names, not values
**YOU.** Create `signoff/docs/env-checklist.md` (committed) containing only the **names** above with a checkbox each. This is what you will tick while filling Render at Stage 4.

---

## Done when

- [ ] `Settings()` loads locally with `APP_ENV=prod` and `PAYPAL_ENV=sandbox`
- [ ] `approval_token_secret` is at least 32 characters
- [ ] The LLM probe in step 3 shows a model and both `set: True`
- [ ] `signoff/docs/env-checklist.md` exists and lists every name
- [ ] No secret value appears in any file that git tracks

---

## If it goes wrong

**`ValueError: Live PayPal endpoints are strictly prohibited`** — your `PAYPAL_BASE_URL` is not the sandbox host. It must be exactly `https://api-m.sandbox.paypal.com`.

**`LLM_PROVIDER=fake is strictly forbidden when APP_ENV=prod`** — set a real provider. The fake provider is for tests only.

**Settings load but the app reports `llm_mode: UNAVAILABLE`** — the provider rejected the key. Test the key directly against `LLM_API_BASE_URL` with a one-line request before continuing.

---

## Cut

Nothing. A wrong secret at Stage 4 costs far more than an hour here.
