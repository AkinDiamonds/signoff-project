# Playwright plan

## Layout and projects
Tests live in `e2e/`. Projects: `shop-desktop`, `merchant-desktop`, `merchant-mobile` (phone viewport, touch). Stack for CI: agent, worker, Postgres, PayPal stub, both web apps, fake LLM. Real-sandbox runs use the `@live` tag only.

## Rules
- Prefer role and label selectors; test ids per `contracts.md`.
- No fixed sleeps. Wait for visible state or a specific API response.
- Every test creates its own demo session and cleans up through the session reset.
- Fixed timezone, locale and clock (stub controls time). Traces on failure, one retry in CI only.
- One accessibility check per page type. Screenshots only for the three custom widgets.
- Tags: `@smoke` (under two minutes, runs on every pull request), `@full` (main and nightly), `@live` (manual `make rehearse`).

## Per-step additions (earlier steps add their own specs; step 34 adds the cross-app ones)
Shell (24), disputes (25), approval (26), charter and demo (27), dashboard (28), widgets (29), shop (31), buyer portal (32), site (33).

## Cross-app scenarios (step 34)
| Scenario | Buyer side (shop) | Merchant side (web) | Must observe |
|---|---|---|---|
| A | Demo order, report not received | Detail page | Allow verdict, evidence submitted, resolved state or recorded outcome per S8 |
| B | Small order, report | Dashboard | No human step; auto-handled; KPIs change |
| C | Large order, report | Phone viewport approval page | Needs-approval chip, approve a partial offer, outcome per S9 |
| D | Reply with a hostile message | Detail page | No action taken, injection event with rule id visible |
| E | Third dispute from the same buyer | Approval page | Repeat-disputer approval requirement |
| Resilience | n/a | Detail page | Duplicate webhook yields one run; delayed webhook caught by the poller; LLM failure shows approval fallback; kill switch blocks new scenarios and shows banner |
| Tamper | Edit price in the request | n/a | Server price is used |
| XSS | Markup in message | Detail and approval pages | Rendered as text |

## Flake policy
A flaky test is a bug. Fix the cause or quarantine with a dated review-log entry and a ticket in STATUS; never loop retries to hide it.
