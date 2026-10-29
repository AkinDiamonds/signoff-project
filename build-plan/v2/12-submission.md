# 12 — Submission

**Goal:** a complete, rule-compliant Devpost entry, and a repository that still passes a judge's check on 15 December.
**Time:** 2 hours on 10 Nov, plus a 20-minute check on 12 Nov.
**Before you start:** Stage 11 published. Everything else frozen.

---

## Step 1 — Repository final check (30 min)
**YOU.**

1. `https://github.com/AkinDiamonds/signoff-project` is **public**. Confirmed already; re-confirm after any visibility change.
2. The **About** panel shows an MIT licence. Confirmed already; if it ever disappears it is because `LICENSE` moved or was renamed.
3. `README.md` starts with `# Signoff`, states what it is in one sentence, carries the three live URLs, the video link, and the one Docker command.
4. Search the repo for secrets one last time:

```bash
cd signoff
git grep -nIE "(sk-[A-Za-z0-9]{16,}|client_secret\s*=\s*['\"][^'\"]{8,}|BEGIN [A-Z ]*PRIVATE KEY)" -- . ':!*.lock' ':!package-lock.json'
```

Expected: no output. If it prints anything, stop and rotate that credential before submitting.

5. Confirm `.env` is untracked: `git ls-files | grep -c "\.env$"` returns `0`.

## Step 2 — Judge-access check (20 min)
**YOU.** This is the single most common way a good project loses.

Open a private browser window, and on **mobile data**:

1. The merchant URL loads.
2. `/app/pool` shows at least five pooled disputes.
3. Click one. The timeline fills within ~30 seconds.
4. The approval card opens and can be signed.
5. The injection dispute shows the block.
6. The dashboard answers a question.
7. The shop loads and the PayPal button appears.

If any step fails, fix it before submitting. A judge who hits a broken step does not try twice.

## Step 3 — Keep it alive until judging ends (obligation, read carefully)

The rules require the project to be available free of charge and without restriction for judging until the judging period ends. Judging runs from 1 December to 15 December 2026. That means:

- The Render services must stay up until at least **15 December**. Budget for it; the hackathon credit may not cover the whole period.
- The dispute pool must still contain usable disputes in December. Set a calendar reminder for **1 December** to refresh the pool using Stage 6 Part H.
- The LLM budget must not run out. `LLM_DAILY_BUDGET_USD` caps daily spend; a judge asking four questions costs cents.

Put these two reminders in your calendar now, before you submit: **1 December** (refresh pool, check services) and **8 December** (final health check).

## Step 4 — Write the Devpost text (45 min)

Fill the form in this order. Keep every answer concrete and specific.

**Project name:** Signoff

**Tagline** (one line): Disputes handled by an agent, but only as far as you allow.

**What it does** (3-4 paragraphs). Use this shape:

1. The problem, with one sourced number, and who it hurts.
2. What Signoff does, in the merchant's words.
3. The signing limit — the idea. What an approval can and cannot override.
4. What is real: real PayPal sandbox disputes, real webhooks, a deterministic rule set, an append-only log. What is simulated: the candle shop.

**How we built it.** Name the PayPal APIs you actually call: Disputes v1 (fetch, provide evidence, offer, accept, message, escalate, appeal), webhooks with signature verification, Orders v2 for the shop. Name the AI: the model proposes a plan, a schema-validated plan only, and a fixed rule set decides. Name the rest: FastAPI, PostgreSQL, React, AG Studio.

**Challenges.** Pick two real ones. Good candidates: keeping the model out of the write path, and making a deterministic gate that can be replayed.

**Accomplishments.** The approval boundary; the injection block; the golden-decision replay test.

**What we learned.** One or two sentences. Be specific, not humble-bragging.

**What's next.** Shopify adapter (say whether it is built — Stage 13 decides), email approvals, a real carrier integration.

**Built with.** Comma-separated: fastapi, postgresql, react, typescript, ag-studio, paypal-rest-api, openai-compatible-llm, render, docker.

**Try it out / testing instructions.** The three URLs, the five steps from `/guide`, and a note that no login is needed and no real money moves.

**Video link.** From Stage 11.

**Repo link.** The GitHub URL.

## Step 5 — Choose the prizes you are eligible for
**YOU.** Read the rules table. A project can win **one** Grand Prize or **one** Honourable Mention, **plus one** Sponsor Prize.

Select these:

| Prize track | Why you qualify | What to make sure is visible |
|---|---|---|
| Grand Prize (all) | — | Everything above |
| Most Impactful | A specific real audience, a specific cost | The sourced number and the merchant story |
| Best Use of PayPal + AI | The integration is deep, not decorative | The API list in "How we built it" |
| Best Use of Agentic Commerce | The agent acts, with authority limits | The signing limit as the headline idea |
| Best Use of AG Grid | AG Studio is embedded with live data | Only if Stage 3 landed; state exactly what Studio does |

Do not claim a sponsor track you did not use. Judges check.

## Step 6 — Submit and verify (15 min)
**YOU.**

1. Submit before **12 November, 12:00 PT**. Do it on 10 November.
2. Screenshot the confirmation page and save it.
3. Re-open your submission in a logged-out browser and confirm the video plays, the repo link resolves, and the URLs work.
4. The submission cannot be edited after the period ends. Any late fix is gone.

## Step 7 — The 12 November sweep (20 min)
**YOU.** Last useful action before the deadline:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<api>/healthz
curl -s -o /dev/null -w "%{http_code}\n" https://<merchant>/app/pool
curl -s -o /dev/null -w "%{http_code}\n" https://<shop>/ 
```

All three return 200. Then open the video link logged out once more.

---

## Done when

- [ ] Repo public, MIT visible, secrets scan clean
- [ ] All seven judge-path steps pass in a private window on mobile data
- [ ] Two calendar reminders set (1 Dec, 8 Dec)
- [ ] Submission text drafted and proofread aloud once
- [ ] Prizes selected and justified
- [ ] Submitted on 10 Nov, confirmation screenshotted
- [ ] 12 Nov sweep passed

---

## If it goes wrong

**The pool is empty on the day.** Judges can still see finished runs and the guide explains the real flow. Do not panic-edit the app. Instead file two disputes from the shop and pool them.

**A URL is down.** Render service paused for non-payment or crashed. Restart it and add a health check reminder weekly until 15 Dec.

---

## Cut

Nothing in this stage. A perfect project with an incomplete submission scores zero.
