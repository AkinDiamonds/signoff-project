# Frontend spec

The plan has two UI surfaces with very different risk: the **AG Studio dashboard** (new API, licence, agent adapter) and **plain React pages** (approval, detail, demo control). Keep them decoupled so a Studio problem never blocks the approval flow or the video.

## Two AI agents, kept apart (ADR-006)
| | Dispute agent | Studio assistant |
|---|---|---|
| Runs | Python backend | Browser, via AG Studio's agent framework |
| Job | Read a dispute, propose a plan | Build widgets / answer dashboard questions in natural language |
| Tools | Read-only PayPal tools + mock store | Read-only data queries over `/api/*` only |
| Can mutate PayPal? | No (plan only; gate + executor act) | No, and has no path to it |
| LLM calls | Server-side | Through `POST /api/llm` proxy so the key never ships to the browser (VERIFY adapter shape; see register V-07) |

## Surfaces and routes
| Route | Surface | Built with | Purpose |
|---|---|---|---|
| `/` | Dashboard | **AG Studio** | KPIs, dispute grid, widgets, chat panel |
| `/disputes/:id` | Dispute detail | React | Evidence found, evidence strength, **Decision Timeline**, gate verdicts with rule IDs |
| `/approve/:token` | Approval card | React, mobile-first | Summary, evidence, proposed action, gate reason, Approve / Deny / Edit |
| `/charter` | Authority Charter | React | View and edit limits; shows version history |
| `/demo` | Scenario control | React | Buttons for scenarios A-E, reset, quota remaining, "cached reasoning" label |
| (banner on all) | Sandbox notice | React | "Sandbox demo, fictional data" + link to README |

## States (every view)
loading (skeleton) · empty (explains what creates data, with a button to `/demo`) · error (plain message, retry, correlation id) · stale (shows "updated Ns ago") · frozen (`DEMO_FROZEN`: banner, buttons disabled).

## Data contracts (OpenAPI-generated client)
`GET /api/kpis` · `GET /api/disputes` (filters: status, reason, due-before) · `GET /api/disputes/{id}` · `GET /api/disputes/{id}/decisions` · `GET /api/approvals/{token}` · `POST /api/approvals/{token}/resolve` (approve | deny | edit) · `GET/PUT /api/charter` · `POST /api/demo/scenarios/{id}` · `POST /api/demo/reset` · `POST /api/llm` (Studio proxy) · `GET /api/status`.
Shared enums (`Verdict`, `DisputeReason`, `ActionType`) come from the spec; no hand-copied strings in the UI.

## KPI definitions (the dashboard must not hand-wave)
- **Open disputes:** status needs seller response or approval pending.
- **Dollars at risk:** sum of amounts on open disputes.
- **Recovered:** sum of amounts on disputes resolved in the merchant's favor.
- **Conceded:** sum of amounts refunded or paid out via accepted claims/settled offers.
- **Share auto-resolved:** disputes closed with no human approval ÷ closed disputes.
- **Estimated hours saved:** closed disputes × assumed minutes each; **state the assumption on screen** (e.g. "assumes 20 min per dispute").

## AG Studio specifics (CONFIRMED from docs, 2026-10-06 — re-read during spike S11)
- React packages `ag-studio-react` + `ag-studio`; component `<AgStudio ai={ai} />`; works locally without a licence (watermark/console warnings without a trial key).
- AI: `createAiHarness(api, { adapter })` gives five default agents (Lead, Planning, Data, Page, Widget). Custom agents via the adapter's `agents` field (spread `agStudioDefaultAgents` to keep the defaults); custom tools; and a **Toolkit** mode exposing Studio actions without the chat panel.
- Quick start targets the OpenAI Responses API via an `executeTurn`-style adapter; a different provider likely means writing an adapter (VERIFY, register V-07, and it affects ADR-008).
- Doc pages exist for Data Setup, Async Data, Building Widgets, Custom Widgets. Read those before the dashboard week.
- Licence: no key required for the hackathon (ADR-015 Accepted). A watermark and a console error will appear; this is expected and will not be penalised during judging. Keep `package.json` version pinned for stability.

## Custom widgets (build order)
1. **Decision Timeline** (in the video): vertical timeline of events per dispute: webhook → evidence gathered → plan → verdict (with rule_id chip) → execution → confirmed state.
2. **Deadline Radar**: disputes by time remaining to `seller_response_due_date`, color by verdict/urgency.
3. **Authority Meter**: used vs remaining of each charter limit (e.g. offers auto-approved today vs `auto_offer_max`).
If time is short, ship the Timeline and Radar, or implement Timeline as a plain React component on the detail page.

## Design tokens (roles; fix values when wireframes are approved)
Neutral surface + ink; one calm accent (teal or ink blue); **ALLOW** green, **NEEDS_APPROVAL** amber, **DENY** red, always with icon + text label. One typeface family with a license you can prove. 8-pt spacing scale. Focus rings visible. Body text ≥ 4.5:1 contrast.

## Build approach
1. Generate the typed client from the OpenAPI spec the day the first endpoints exist.
2. **Fixtures first:** a mock server (MSW) serving `fixtures/ui/*.json` lets UI work proceed before backend data is real; swap to live by env var.
3. Build in video order: dispute detail + Timeline → approval card → dashboard → demo panel → Studio assistant.
4. One Playwright smoke test: open `/demo`, run scenario B, see a verdict row appear.
5. Test the approval page on an actual phone viewport early.

## Buyer-facing surfaces (ADR-012; `shop/` package)
| Route | Surface | Purpose |
|---|---|---|
| `/` | Shop landing | Fictional candle shop, product listing |
| `/product/:sku` | Product page | Add to cart |
| `/cart` | Cart | Review and proceed |
| `/checkout` | Checkout | PayPal buttons (V-23: method TBD) |
| `/confirmation/:code` | Order confirmation | Order code + tracking link |
| `/orders` | Order list | Buyer’s orders |
| `/orders/:code` | Order detail | Status, tracking, dispute button |
| `/orders/:code/dispute` | File a dispute | Buyer starts a dispute against the order |

Both apps share `packages/ui` with separate themes (signoff teal, shop neutral). A "use a demo order" shortcut on the `/demo` panel lets judges skip checkout. The judge guide at `/guide` has a switcher for Buyer view and Merchant view. See `build-plan/contracts.md` for all routes.
