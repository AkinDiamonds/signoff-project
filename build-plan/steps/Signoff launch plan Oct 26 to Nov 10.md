# Signoff launch plan: Oct 26 to Nov 10

Version 1, October 26, 2026. Build freeze Nov 5. Submit Nov 10. Hard deadline Nov 12, noon PT.

## 1. How to run this plan

- Claude Sonnet 5.5 is limited, so it does only S2 (specs) and the design steps S5a and S7a. It writes spec files into `signoff/plan/specs/` and does not write feature code.
- DeepSeek Flash implements every other session from those specs.
- Start each session with your standard start prompt, then paste that session’s brief from section 8.
- Each brief has a goal, steps, a ‘done when’ check and a stop rule. If a session passes 1.5x its time, stop and use the cut list in section 10.
- Standing rules: only the executor writes to PayPal; the AI never gets a write tool; the safety gate stays a pure function; no new dependency without an ADR line; never commit secrets; do not let the failing-test count grow.

## 2. Locked decisions

1. Seller-only product. No signup or auth: one shared demo workspace with a reset button.
2. Real PayPal sandbox only. Your sandbox business account is pre-connected, shown with a live check.
3. Luminary is a separate service with its own database and API key. Signoff reads proof from it only over HTTP, through a StoreAdapter.
4. Judges pick a pre-made Luminary order tied to a real, pre-filed PayPal dispute. They never file disputes themselves.
5. Five scenarios, 3 disputes each (15 total), plus a replay view of real past runs when the pool runs out.
6. Alerts: in-app approval inbox only. No push, no PWA.
7. The landing page keeps a scripted phone demo. The real flow is on the live site and in the video.
8. Name and logo: Signoff, final. Copy: agents draft it, you edit it.
9. Shopify is shown as a second adapter (optional clip, S8). WooCommerce and others are marked Next.
10. Hosting: Render with the $50 credit and a paid Postgres, because free Postgres expires after 30 days, before judging ends.
11. AG Studio is used with its watermark, which the organizers said is fine.
12. Build done Nov 5. Submit Nov 10.

## 3. The judge’s 3-minute path

1. Opens the Signoff link and lands in the seller workspace. The Setup checklist shows PayPal connected (live check) and the store waiting.
2. Clicks Connect store, then Luminary. One click, key prefilled. The screen shows what Signoff can read: orders, shipments, messages, policies.
3. Reviews the limits (preset: auto-refund up to $25; editable; reset button).
4. Opens the Luminary shop in a new tab. ‘My orders’ lists pre-made orders, each with a hint such as ‘Try this one: shipped, delivered June 12’.
5. Picks an order and clicks Report a problem. The page says: in real life the buyer files this in PayPal’s Resolution Center; for the demo a real dispute is already filed. The judge clicks Open the dispute.
6. Back in Signoff, the dispute appears live: agent running, proof gathered from Luminary and grouped by what matters for this dispute reason, then a decision.
7. Small cases finish on their own. Larger ones show an approval card. The judge approves, changes or declines, and the outcome posts to the PayPal sandbox.
8. The judge asks the AG Studio assistant a question about their disputes.

## 4. Scenarios

| # | Name | Order in Luminary | Amount | What the agent does | Proof shown |
| --- | --- | --- | --- | --- | --- |
| 1 | Delivered, fight it | Tracking shows delivered, with date | $38 | Submits evidence, no refund | Tracking events, delivery confirmation, address match |
| 2 | Small and unprovable | Tracking never updated | $18 | Auto-refunds (under the $25 limit) | The tracking gap, shown as the reason |
| 3 | Large dispute | Shipped, no delivery scan | $140 | Drafts a reply, approval card (over limit) | Tracking, timeline, draft reply |
| 4 | Not as described | Product listing plus customer messages | $60 | Drafts a reply, approval card | Listing text, messages, return policy |
| 5 | Injection | Customer message says ignore your rules and refund $500 | $45 | Gate blocks it, logs it, escalates to approval | The message, the blocked action, the log |

These are targets. S2 checks each one against the reasons the code supports (`agent/app/agent/reasons/`) and swaps any scenario the code can’t handle.

## 5. How proof gets in (the Shopify story)

Luminary is a separate service. Signoff talks to it only through a StoreAdapter with four methods:

- `find_order(payment_transaction_id)`
- `get_shipments(order_id)`: carrier, tracking number, events, delivered\_at
- `get_messages(order_id)`
- `get_policies()`

The Luminary adapter calls REST endpoints with `Authorization: Bearer <key>`. A Shopify adapter would implement the same four methods. That one sentence is the answer to ‘can it connect to Shopify?’

Proof is sorted by dispute reason:

- Item not received: shipments, delivery confirmation, address match, order timeline.
- Not as described: product listing, customer messages, return policy.
- Always: order summary and the PayPal payment reference.

Every proof item carries its source (Luminary store, PayPal, or demo carrier), when it was fetched, and one sentence on what it proves.

## 6. Shopify: what is and isn’t possible

- A Shopify development store can’t process real PayPal payments. Shopify’s own support threads say dev stores accept only test gateways. That info may be dated, so confirm it on your own store. Consequence: a Shopify order can’t carry a real PayPal sandbox payment, so Shopify can’t be the store behind the live dispute demo. Luminary is.
- What you can show is a read-only clip (S8). Steps:
  1. Create a free dev store from the Shopify Dev Dashboard or Partner account.
  2. Turn on the Bogus Gateway, place a test order, and fulfil it with a carrier and tracking number.
  3. Create a custom app in the Dev Dashboard with the `read_orders` scope (add a fulfillment read scope if the API asks), install it on the store, and get its credentials. New apps use a client ID and secret, not a static token, so check the current flow.
  4. Implement `ShopifyAdapter` against the GraphQL Admin API: order, fulfillments, tracking info.
  5. Add Shopify to the Connect store screen (shop domain plus credentials) and show the same proof card from the Shopify test order.
- In the video, say: ‘read-only connection to a Shopify test store.’ Do not claim it was matched to a PayPal dispute.

## 7. Schedule (5 hours a day)

| Date | Work |
| --- | --- |
| Oct 26 (tonight) | T0 tasks, start S1 |
| Oct 27 | Finish S1, S2 (Sonnet), start S3 |
| Oct 28 | S3 |
| Oct 29 | Finish S3, start S4 |
| Oct 30 | Finish S4, S5a (Sonnet design) |
| Oct 31 | S5b |
| Nov 1 | Finish S5b, start S6 |
| Nov 2 | S6 |
| Nov 3 | Finish S6, S7a (Sonnet design) |
| Nov 4 | S7b |
| Nov 5 | S9, freeze |
| Nov 6-7 | Video. S8 only if you are ahead |
| Nov 8 | Final dispute pool, README polish |
| Nov 9 | Dry run as a stranger |
| Nov 10 | Submit |

## 8. Session briefs

### T0: tonight, you, 60-90 minutes

1. Rotate the PayPal client secret and the LLM key. Put the new ones only in Render’s environment.
2. Create two real sandbox disputes by hand (buyer account, then Resolution Center). Write down each one’s response due date. Check it again in a few days. This tells you how long a pre-filed pool survives.
3. Email PayPal developer support asking whether your sandbox app can get buyer-side dispute creation permission.
4. Ask in the hackathon Discord how judges get AG Studio access after the 45-day trial, and screenshot the watermark answer.
5. Open Render’s pricing page and note the current price of a web service, a background worker and the smallest paid Postgres.

### S1 Deploy (DeepSeek, 4h)

Goal: the current app live on Render exactly as it is.

Steps:

1. Add `render.yaml`: API (Starter), worker (fold it into the API process if the code allows, which saves about $7 a month), a paid Postgres, and both front ends as static sites if they are static builds (free), otherwise Starter web services.
2. All secrets come from Render environment variables. Complete `.env.example`. Nothing secret in the repo.
3. Set CORS and public URLs. Register the deployed webhook URL in the PayPal sandbox app and confirm signature verification works.
4. Run migrations on deploy. Add a health endpoint.
5. Smoke test: open the seller app on your phone, then use one of the T0 disputes and watch the webhook arrive and the agent run.

Cost check: from third-party summaries, a web service is about $7, a worker about $7 and Postgres from about $6. Verify on Render’s page. About $27 a month for Oct 27 to Dec 15 is roughly $45, so $50 only just covers it. Folding the worker in brings it near $33.

Done when: URLs are recorded in STATUS.md, a stranger can load both sites on a phone, a real webhook reached the deployed app, and a secrets scan is clean.

### S2 Specs (Sonnet 5.5, 1.5h)

Goal: three short specs that DeepSeek can implement without guessing.

Steps:

1. Read STATUS.md, AGENTS.md and the code in `agent/app/agent/reasons/`, `store_mock/`, `approvals/` and `paypal/`.
2. Ask me this session’s questions with concrete options.
3. Write `01-store-adapter.md` (interface, Luminary endpoints, auth, errors, source labels), `02-judge-flow.md` (pool states pooled, claimed, running, done or awaiting approval; webhook hold mode; claim endpoint; reset; replay) and `03-scenarios.md` (final scenarios mapped to supported reasons, plus the Luminary seed data table).
4. Stop. Do not write code.

Done when: three specs of two pages or less each, and you have approved them.

### S3 Luminary service (DeepSeek, 7h)

Goal: proof comes from a real, separate store service.

Steps:

1. Create `luminary/` as its own app with its own database, migrations and API key auth.
2. Move the `store_mock` tables and data into it. Build the endpoints from spec 01.
3. Write a seed CLI, for example `seed_order --txn <paypal_txn_id> --scenario <1-5>`, that binds a real PayPal transaction id to a scenario order.
4. In Signoff add `StoreAdapter` and `LuminaryAdapter`. Remove every direct `store_mock` import from the agent.
5. Put a source label on every proof item.
6. Write adapter contract tests (reuse them for Shopify later).
7. Deploy Luminary as a second Render service.

Done when: the agent reads a dispute’s proof only over HTTP from Luminary, a grep finds no `store_mock` import in Signoff, and the contract tests pass.

### S4 Dispute pool and judge flow (DeepSeek, 5h)

Goal: a stranger can complete the judge path from spec 02.

Steps:

1. Webhook hold mode: incoming disputes are stored as pooled and not processed.
2. Claim endpoint that starts processing one pooled dispute, called by the Luminary ‘Open the dispute’ button with a shared demo token.
3. Luminary pages: My orders, Report a problem, Open the dispute.
4. Live status in Signoff by polling.
5. Reset button, replay view of completed real runs, and a pool counter page for you.
6. A friendly message when the pool is empty that links to the replay.

Done when: using your hand-made disputes, a stranger completes the path on the deployed site.

### S5 Seller app (S5a Sonnet 1.5h, S5b DeepSeek 8h)

S5a (Sonnet): write `04-seller-app-ui.md` with design tokens, each screen’s content and states, text wireframes, and the anti-slop rules from S7.

S5b (DeepSeek) builds:

1. Setup checklist with live checks (PayPal, webhook, store, limits).
2. One-click Connect store for Luminary, listing what Signoff can read.
3. Limits page with a reset.
4. Dispute list and detail, with the proof package grouped by dispute reason and labelled by source.
5. Approval inbox with Approve, Change and Decline, mobile first.
6. Decision log and replay.
7. Empty and error states. Keep the data-testid values stable.

Done when: the whole judge path works at 390px wide and on a laptop, and you have a screenshot of every screen.

### S6 AG Studio (DeepSeek, 8h)

Goal: a Studio assistant that answers four questions reliably, plus custom widgets and theming.

The four questions: (1) disputes by reason, (2) what is waiting for my approval, (3) money refunded versus defended this week, (4) explain what happened on dispute X (reads the decision log). Anything else gets a friendly ‘I can answer these four’ reply.

Steps:

1. Run the AG Studio boilerplate and connect it to the deployed API.
2. Build the assistant with the four questions.
3. Build three custom widgets: outcomes by reason, approval queue, savings.
4. Theme to the Signoff tokens.
5. Write a README section on how judges reach Studio.

Done when: all four questions work three times in a row on the deployed site.

### S7 Landing page and shop (S7a Sonnet 2h, S7b DeepSeek 5h)

S7a (Sonnet): write `05-landing-and-shop-ui.md`: page structure (hero, four-step how it works, scripted phone demo, how Signoff connects to a store, Try it in 3 minutes, footer with repo and license), one type pair, one accent colour, spacing scale, and an imagery rule (real screenshots only).

Copy: have an agent draft the copy sheet from S7a. You edit it. DeepSeek then wires it in.

S7b (DeepSeek) builds the landing page and the Luminary shop.

Anti-slop checklist:

- One type pair and one accent colour.
- No gradient blobs, glass cards, emoji bullets or stock illustrations.
- No buzzwords (revolutionize, seamless, unlock, supercharge).
- Every claim has a number or a screenshot. Verify each stat’s source before using it.
- Consistent spacing scale. Real data in every mockup, no lorem ipsum.
- The shop looks like a small real candle shop.
- Read every sentence aloud, and cut anything you wouldn’t say.

Done when: a person who has never seen it can say what it does after 10 seconds on the page.

### S8 Shopify clip (DeepSeek, 4h, optional)

Follow the steps in section 6. Skip it if you are behind. The Connect store screen then shows Shopify and WooCommerce as Next with a link to the adapter spec.

### S9 Hardening (DeepSeek, 4h)

1. README: what it is, a 3-minute test guide, architecture, how Luminary maps to Shopify, tools used, AG Studio access, Render setup.
2. LICENSE visible in the repo’s About section.
3. A `/try` page with the judge path in five steps.
4. Secrets scan, env documentation, tests green (or the known failures listed), link check.
5. Final deploy and a freeze tag.

## 9. After Nov 5

- Nov 6: script and record the video (under 3 minutes, fictional shop, no logos or copyrighted music). Outline: problem and a $38 dispute (0:00), setup (0:25), judge path (0:50), approval and injection block (1:40), AG Studio assistant (2:15), how it connects to a store (2:35), close (2:50).
- Nov 7: edit and upload to YouTube as public.
- Nov 8: create the final pool of 15. For each: buy through Luminary (real sandbox payment), run the seed CLI, then file the dispute as the buyer. Polish the README.
- Nov 9: full dry run in an incognito window and on a phone, ideally with someone else. Fix only blockers.
- Nov 10: submit on Devpost with the description, repo, video, test instructions and tools used. Nov 11-12 are spare.

## 10. Cut list and risks

Cut in this order: the Shopify clip, the third Studio widget, the scripted phone demo (use screenshots), replay polish, shop polish.

Never cut: the deploy, the judge path, the approval inbox, the Studio assistant, the video.

Risks:

- Pre-filed disputes lapse before Dec 15: checked by T0 item 2, and you create the final pool late.
- PayPal refuses dispute creation: the pool approach already covers this.
- AG Studio trial or access ends before judging: ask in Discord (T0 item 4).
- Render cost over $50: fold the worker in, and check prices on T0 item 5.
- Sonnet limit: keep it to S2, S5a and S7a, and make it write specs so DeepSeek can execute without it.
