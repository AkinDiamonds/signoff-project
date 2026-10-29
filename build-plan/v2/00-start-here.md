# 00 — Start here

Read this before touching any other file. It is the map.

## The goal

A PayPal AI Hackathon submission that a judge can open, understand in ten seconds, and operate in three minutes, with a working approval flow and a visible audit trail. Judged equally on Technological Implementation, Design, Potential Impact, Innovation, and Presentation.

## What is already built and working

Do not rebuild any of this. It is verified in the repo as of 27 Oct 2026.

| Piece | Where | State |
|---|---|---|
| PayPal read + mutating clients, split behind an executor | `signoff/agent/app/paypal/`, `signoff/agent/app/executor/` | Working |
| Pure policy gate, rules G0-G7, golden replay | `signoff/agent/app/policy/` | Working, 56 tests |
| Agent loop, prompt injection screener | `signoff/agent/app/agent/` | Working |
| Dispute sync, webhooks, job queue, reconciler | `signoff/agent/app/sync/`, `webhooks.py`, `queue/` | Working |
| Append-only decision log | `signoff/agent/app/ledger/` | Working |
| Approvals backend, tokens hashed at rest | `signoff/agent/app/approvals/` | Working, 11 tests |
| Storefront, cart, checkout, buyer portal | `signoff/shop/` | Working |
| Merchant app: disputes, charter, demo panel, approval pages | `signoff/web/` | Working, 159 tests |
| Demo scenario generator (A-E) | `signoff/agent/app/simulator/` | Working, stub only |
| PayPal stub for local testing | `signoff/scripts/paypal_stub/` | Working |
| Docker images for each app | `signoff/agent/Dockerfile`, `signoff/web/Dockerfile`, `signoff/shop/Dockerfile` | Written, never run |

## What is NOT built, and is the actual work

| Missing | Stage |
|---|---|
| Nothing deployed anywhere; `render.yaml` does not exist | 4 |
| Real sandbox path never run end to end | 2, 5 |
| A judge cannot reach a dispute the agent is allowed to work on | 6 |
| A judge cannot reach the approval card (token is only printed to the server log) | 6 |
| Store data is read from an in-process mock, not over HTTP | 6 |
| AG Studio grid renders zero rows | 3 |
| Studio native AI panel not wired | 3 |
| UI never had a design stage | 7-10 |
| No video | 11 |

## The judge's three minutes, as the plan aims to make it

1. Opens a link. Lands on the Signoff seller workspace. Header says "Sandbox demo, fictional data." Setup checklist shows PayPal connected and the store connected, both with live checks.
2. Opens **Demo disputes**. Five disputes are listed, each labelled with what it will show: delivered and fight it, auto-refund under the limit, large dispute needing approval, not-as-described, prompt injection.
3. Clicks one. The timeline fills in live: dispute synced, agent running, evidence gathered from the store, plan proposed, gate decided with a rule id, executed, confirmed.
4. On the large one, clicks **Open approval card**. Approves, changes the amount, or declines. The outcome posts to PayPal and the timeline records it.
5. Opens the injection one. The buyer message is shown, the blocked action is shown, the rule id is shown.
6. Opens the dashboard. Asks one plain-English question in the Studio assistant. Gets an answer drawn from the ledger.
7. Leaves.

Everything in stages 3-10 exists to make that path work on a real URL, without you in the room.

## How to use a stage file

Every stage file has the same shape:

- **Goal** — one sentence.
- **Time** — estimate.
- **Before you start** — what must already be true.
- **Steps** — numbered, each with a command or a click and a check.
- **Done when** — the test that proves the stage finished. Do not skip it.
- **If it goes wrong** — the two or three realistic failure modes.
- **Cut** — what to drop first inside this stage.

When a step says **PROMPT**, paste the block into your AI assistant exactly as written. When it says **YOU**, do it by hand.

## Order

Follow the numbers. The only exception: if Stage 4 (deploy) is blocked waiting on something outside your control, start Stage 7 (UI foundation) in parallel, because it does not touch the backend.
