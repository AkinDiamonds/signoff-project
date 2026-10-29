# 01 — Truth pass and commit captures

**Goal:** the repository's own story is true, and the files the deploy depends on are committed.
**Time:** 1 hour.
**Before you start:** nothing. This is the first stage.

---

## Why this is first

Render builds from git. Six files the deploy depends on are **untracked**, so they do not exist on GitHub and Render cannot see them:

```
signoff/agent/Dockerfile
signoff/web/Dockerfile
signoff/shop/Dockerfile
docker/nginx-spa.conf
compose.real.yaml
signoff/scripts/register_webhook.py
signoff/docs/real-mode.md
.dockerignore
```

If you start Stage 4 without committing these, the first build fails and you lose an hour wondering why.

---

## Steps

### 1. Confirm what is untracked
**YOU.**

```bash
git status --short
```

Expected: the eight files above show as `??`. If any of them is missing from the list because it is also missing from disk, stop and note it at the bottom of this file.

Check the Dockerfile for the shop exists:

```bash
ls signoff/shop/Dockerfile docker/nginx-spa.conf
```

### 2. Confirm no secret is about to be committed
**YOU.**

```bash
git check-ignore -v signoff/.env
```

Expected output mentions `.gitignore`. If instead you get no output, `.env` is not ignored — stop immediately and fix `.gitignore` before continuing.

### 3. Rewrite the repository landing page
**PROMPT.**

> Replace the contents of the repository root `README.md`. It currently starts with `# Build plan`, which tells a judge nothing. Write a new README with these sections, in this order, and nothing else:
>
> 1. `# Signoff` and one sentence: an AI agent that handles PayPal disputes for small online merchants inside limits the merchant sets.
> 2. A four-line block naming the three apps and their folders: merchant web (`signoff/web`), buyer shop (`signoff/shop`), API and worker (`signoff/agent`).
> 3. `## Try it` with two options: the hosted demo URL as `HOSTED_URL_PLACEHOLDER` (Stage 4 replaces it), and one command to run the stub demo locally: `docker compose up --build -d` then open `http://localhost:5173/app/demo`.
> 4. `## What is real` — a short table: disputes, evidence and offers are real PayPal sandbox; the candle shop orders and tracking are simulated; the agent reasoning is a real LLM behind a server proxy.
> 5. `## Built with` — FastAPI, PostgreSQL, React, AG Studio, PayPal REST APIs, an OpenAI-compatible LLM provider.
> 6. `## License` — MIT, link to `LICENSE`.
>
> Do not add badges, screenshots, or claims that are not already true in the repo. Keep it under 60 lines.

**Check:** `head -1 README.md` prints `# Signoff`.

### 4. Fix the stale claims ledger rows
**PROMPT.**

> Open `signoff/docs/claims-ledger.md`. For every row whose Status is `Planned` or `Partial`, either link the test or step that proves the claim (so it becomes `Verified`), or change the claim's wording to something the repo actually proves. Do not delete rows. Add a row `CLAIM-NO-MUTATING-TOOL` if it is missing: "The LLM is never given a write tool; its output is a schema-validated plan only", proven by `agent/tests/test_architecture_guard.py` and `agent/tests/test_llm_proxy.py`.
>
> Then print the final table with only the ID and Status columns.

**Check:** every row reads `Verified`. If any row cannot be verified today, its claim must be softened until it can.

### 5. Verify the real-mode doc against the code
**YOU.** Read `signoff/docs/real-mode.md`. It was written before the webhook registration script existed. Confirm these three statements against the repo and correct the file where they are wrong:

1. It says to run `python -m scripts.register_webhook` from `signoff/`. Confirm the script exists and that command matches its module path.
2. It says the shop's "report a problem" button returns a clear message because `DISPUTE_CREATE` is not provisioned. Confirm `signoff/agent/app/shop/disputes.py` and the shop UI still behave that way. note from human after observation: this behaves like the dispute creation in report a problem worked in the ui, but I cant find create dispute in the dispute.py.
3. It lists the environment variables needed. Compare against `signoff/agent/app/settings.py` (`validation_alias` names) and add anything missing.

**Check:** `grep -c "PAYPAL_\|LLM_\|APPROVAL_" signoff/docs/real-mode.md` is greater than 10 and the three corrections are made or explicitly marked "confirmed".

### 6. Run the checks
**YOU.**

```bash
cd signoff && npx vitest run --reporter=dot
./.venv/Scripts/python.exe -m pytest signoff/agent/tests -q \
  --ignore=signoff/agent/tests/test_database.py \
  --ignore=signoff/agent/tests/test_charter.py \
  --ignore=signoff/agent/tests/test_job_queue.py \
  --ignore=signoff/agent/tests/test_webhooks.py
```

Expected: web **159 passed**. Agent **373 passed**.

If the agent count is lower than 373, something regressed. Stop and find it before committing.

### 7. Commit
**YOU.**

```bash
git add README.md .dockerignore compose.real.yaml docker/ \
        signoff/agent/Dockerfile signoff/web/Dockerfile signoff/shop/Dockerfile \
        signoff/scripts/register_webhook.py signoff/docs/real-mode.md \
        signoff/README.md signoff/fixtures/ui/index.ts \
        signoff/web/src/features/dashboard/StudioCanvas.tsx \
        signoff/docs/claims-ledger.md
git status --short
```

Review the staged list before committing. It must not contain `signoff/.env` or any file with a key in it. Then:

```bash
git commit -m "docs: truth pass on README, claims ledger and deploy captures"
```

Note: the working tree also has changes to `Makefile`, `compose.yaml`, `signoff/agent/app/*` and the two `vite.config.ts` files that pre-date this plan. If those are yours and complete, commit them separately as `chore: real-mode wiring`. If you are unsure they are finished, leave them unstaged — but Stage 4 will need them, so resolve this before Stage 4.

### 8. Push
**YOU.**

```bash
git push
```

**Check:** open `https://github.com/AkinDiamonds/signoff-project` and confirm the eight files are visible and `README.md` starts with `# Signoff`.

---

## Done when

- [ ] All eight previously-untracked files are on GitHub
- [ ] Root `README.md` starts with `# Signoff`
- [ ] Every claims-ledger row is `Verified`
- [ ] Web 159 pass, agent 373 pass
- [ ] `signoff/.env` is not tracked

---

## If it goes wrong

**The agent test count is different from 373.** Run `git stash` and re-run. If the count changes, the working-tree changes broke something; find which file before continuing.

**`git check-ignore` returns nothing.** Add `.env` and `signoff/.env` to `.gitignore`, then `git rm --cached signoff/.env` if it was ever added.

---

## Cut

Nothing. This stage is 1 hour and everything downstream depends on it.
