# Signoff: deployed product completion plan

Prepared 2026-10-31 from the supplied previous conversation and the current repository.
This is an implementation specification, not a claim that the work below is finished.

**Owner clarifications:** read [02-owner-decisions.md](02-owner-decisions.md) first. The owner subsequently selected a normal single-merchant product, minimal email/password login with no email service or password recovery, automatic plus manually advanced simulated shipping, configurable missing-delivery behavior defaulting to review, and autonomous execution within policy. Those decisions override conflicting recommendations below. Official rules have now been supplied and summarized there.

## 1. What the owner wants

Finish the existing product so a judge can use it independently on a phone and see a convincing, truthful, end-to-end PayPal sandbox dispute workflow on Render:

1. Buy candles in the existing shop through PayPal sandbox.
2. Receive a persistent order reference linked to that exact payment.
3. Inspect realistic, explicitly simulated shipment and delivery history.
4. Open a dispute on the same payment, through a supported sandbox route.
5. See Signoff receive/synchronize it, find the correct order, retrieve evidence, and propose a valid plan.
6. See deterministic merchant permissions permit, block, or request approval for each action.
7. Approve/deny from a phone when needed and see the actual PayPal sandbox result reflected in the dashboard and audit trail.
8. Receive useful toasts, persistent notifications, and opt-in mobile web push.

Also complete onboarding/settings, visual consistency, mobile interactions, plain product copy, and removal of misleading or redundant UI. All ten workstreams in the supplied conversation remain in scope. Dependency order does not authorize dropping push, persistent notifications, or deployment validation.

Success means this works at the deployed URLs, with proof collected from the deployed release. Local screenshots, fake-provider tests, a healthy API, and a successful build are necessary but insufficient.

The conversation mentions November 12 as the submission deadline. Confirm the official cutoff/timezone and submission requirements from the owner's actual competition materials before scheduling publication. Those rule documents were referenced in the previous chat but were not attached here. Do not treat that chat's claims about model versions, browser capabilities, competition rules, or video duration as authoritative documentation.

## 2. Boundaries and operating rules

- Continue the existing React/FastAPI/PostgreSQL application. No framework rewrite, new storefront, carrier integration, payment-provider replacement, or AG Studio upgrade.
- Preserve sandbox-only payments, fictional buyers, exact decimal money, append-only history, webhook verification, durable job leases, and executor-only dispute mutations.
- The LLM proposes schema-validated actions; it never executes tools or changes policy. Approval cannot override hard PayPal, stale-state, currency, or idempotency checks.
- Simulated logistics must remain labeled in shop, evidence, notifications, and submitted sandbox narratives. Never turn missing evidence into a plausible invented delivery record. No live-carrier or win-probability claims.
- A proposed field, endpoint, table, or UI component below is NEW DESIGN, not an assertion that it exists. Verify current contracts before implementing. Check PayPal mutations against recorded fixtures and current official API docs; do not guess request fields or endpoints.
- Use the existing isolated checkout; do not create worktrees unless asked. Read `signoff/AGENTS.md`, its prescribed documents, and relevant task specifications. Run Python through `.venv/Scripts/python.exe` (the prepared Linux compatibility symlink), passing `VENV_PY=.venv/Scripts/python.exe` to make. Respect the instruction to stop and report a command after its second failure; do not loop or weaken checks.
- Read credentials by name/presence only; never print values. Do not commit secrets, exports of real customer data, approval tokens, or unredacted HAR/logs. Frontend VITE values are public. Store keys, PayPal secrets, LLM keys, push private keys, and operator credentials must remain server-side.
- This plan does not authorize a Render deployment or sandbox financial mutation now. Prepare code, migrations, rollback notes, and a reviewable release first. Obtain release authorization before deploying or running the hosted mutating rehearsal if not already explicitly supplied in the execution session. Do not publish or edit the cloud environment configuration as part of these product changes.
- Standard target is the existing single configured sandbox merchant. Do not silently claim general merchant OAuth onboarding or multi-tenant commerce. Make that limitation clear. New controls must have genuine server-enforced access; public demo frontend tokens are not administrative authentication.

## 3. Evidence already found in code

These are observations from this checkout, not verified explanations of the reported Render failure.

| Finding | Actual location | Consequence / required investigation |
|---|---|---|
| Orders and tracking already use SQLAlchemy models | `signoff/agent/app/db/models.py`, `shop/service.py` | Reuse PostgreSQL records; earlier chat's claim that no order persistence exists is incomplete. |
| PayPal order ID is embedded in the first item JSON; capture ID is stored as `paypal_transaction_id` | `shop/service.py` | Make identifiers explicit; validate capture ownership/status/amount/currency; reconcile existing rows without fabricating IDs. |
| Capture can accept a client-supplied PayPal order ID; absent capture data can produce `STUB-CAPTURE-*` | `shop/service.py::capture_shop_order` | Investigate ownership mismatch and permissive fallback; never allow synthetic success in sandbox mode. |
| Normal checkout adds one `IN_TRANSIT` event; no complete normal-order fulfilment progression was found in inspected service | `shop/service.py` | Seeded scenarios alone do not prove a purchased order's delivery journey. |
| Buyer order detail omits PayPal transaction ID | `shop/schemas.py::OrderDetailResponse` | Buyer cannot inspect the payment-to-order correlation even though capture response contains an ID. |
| Dispute API chooses buyer ID before seller ID; agent uses only first seller ID | `api/disputes.py`, `agent/loop.py` | A likely correlation gap; reproduce with actual scrubbed PayPal data before declaring root cause. |
| Local and HTTP store adapters already exist | `store/{factory,http_adapter,local_adapter}.py`, `api/store.py` | In sandbox the worker uses the API's `/api/store/*` routes and `STORE_API_KEY`; verify API/worker URL and shared key. |
| Some timestamp parsers substitute current time for missing/invalid input | `store/http_adapter.py`, `store/local_adapter.py`, `api/store.py` | This can create misleading evidence chronology; reject or mark unavailable rather than inventing event time. |
| Evidence builder already computes components, score, notes, tracking and missing-data explanations | `agent/evidence.py`, `agent/reasons/` | Improve provenance and presentation; do not rebuild from scratch or call its score confidence. |
| Structured schemas and a repair path already exist; provider request sends model/messages/temperature | `agent/{schemas,llm,prompts}.py` | Diagnose actual action-validation errors; add provider-supported structured output without weakening strict validation. |
| Settings hardcodes Connected, merchant ID and webhook URL; refetches status then claims sync even in catch | `web/src/features/settings/SettingsPage.tsx` | Replace false success with observed readiness and an honest error. |
| Raw demo approval links live in a process-local map | `approvals/service.py`, `api/disputes.py` | Separate Render API/worker and restarts can lose link discovery. Add durable authorized approval access. |
| Buyer merchant link builds `/disputes/{id}`, merchant route is `/app/disputes/:id` | `shop/src/portal/BuyerDisputePage.tsx`, `web/src/app/routes.tsx` | Fix and test deployed cross-app navigation. |
| UI calls evidence strength Confidence and claims carrier-log correlation | `web/src/features/disputes/DisputeDetailPage.tsx` | Replace with evidence strength and source-specific descriptions. |
| No complete toast/inbox/web-push subsystem was found in inspected application paths | `web/src`, `packages/ui/src`, `agent/app` | Implement as new work; timeline history is not a notification delivery system. |

Previous environment validation, not rerun for this planning-only change: Python 481 passed/1 ledger replay failure; frontend 169 assertions passed but overall typecheck failed; Ruff 14 findings; ESLint 9; enum parity missing `DISPUTE_POOLED`; strict mypy 44 errors in 20 files; import-linter exit 1 unresolved. Counts may change. Recent browser checks verified only merchant/shop landing rendering, not checkout, dispute actions, push, or worker operation. `/api/status` reporting LIVE proves provider configuration, not a successful real model call.

## 4. Required architecture decisions before implementation

Record these decisions in the existing append-only `signoff/docs/decisions.md` and reference them in each task. Do not create a second product specification with contradictory behavior.

1. **Identity and access:** preserve the single-merchant demo, but establish a server-authenticated merchant/operator session for configuration, fulfilment controls, notifications and approval access. Prefer an existing usable session mechanism after audit. If absent, use a small signed, secure, HTTP-only cookie session with CSRF protection, configured server-side operator login and durable/revocable session records. No admin key in a VITE variable or URL. A public judge demo session can access only its own fictional records; no blanket admin rights. Document how a judge obtains access and how this works with separate Render frontend/API origins (explicit credentialed CORS, cookie policy and custom same-site domain or same-origin API proxy as needed). Cross-site cookie blocking must be tested, not hand-waved.
2. **Canonical payment identity:** merchant-scoped seller capture ID is primary where verified by PayPal data. Store PayPal order ID separately. Consider buyer ID only as an explicitly verified alias; buyer/seller IDs are not interchangeable by assumption. One resolver is shared by list/detail, agent context and buyer lookup.
3. **Fulfilment simulation:** explicit, protected 'Advance simulated shipment' control for demo-owned paid orders; no uncontrolled timer. Persist forward-only milestones, timestamps and provenance. Reloads and deploys must not reset them. Never auto-mark delivered at payment capture. Optional elapsed-time automation can follow only after the explicit flow works.
4. **Approval discovery:** durable approval IDs accessible through authenticated merchant routes, reusing the existing resolver/re-gate service. Retain hashed expiring bearer links where needed. Do not persist raw approval tokens in plaintext or depend on shared memory/files across Render services.
5. **Notifications:** persisted notification rows plus transactional outbox and worker delivery. Polling is sufficient for in-app refresh; do not add WebSockets solely for appearance. Web push uses standard Push API/service worker/VAPID with an ADR for any new library. Push is opt-in, and platform restrictions must be visible.

## 5. How the executing agent must work

Complete tasks T00–T17 in order. Each task is one bounded change or a few small related commits. A task is done only after its listed exit checks. Within a task, test the bug first, implement the smallest coherent fix, run targeted checks, then update the execution record. Do not bundle this into one enormous unreviewable rewrite.

Use `build-plan/v3/EXECUTION-LOG.md` (create during execution) to record task status, commit SHA, changed files, exact commands and exit codes, test counts, evidence paths, blockers, next task, and any approved scope decisions. Distinguish PASS, FAIL, BLOCKED, NOT RUN, and expected failure. Never turn a failed suite green by removing assertions, excluding failing tests, loosening typing, or disabling lint rules. Diagnose and fix repository defects explicitly.

### T00 — Capture the baseline and audit both deployed experiences

**Read:** current routes, README, `build-plan/v2/04-deploy.md`, `signoff/docs/{real-mode,env-checklist,claims-ledger}.md`, relevant existing tests.

1. Record checkout SHA, clean/dirty state, versions, and existing differences. Preserve all owner work.
2. Inventory actual Render API, worker, database, merchant site and shop. Record deployed SHA/service revision when observable. Environment presence in Codex does not prove Render configuration. Inspect names/readiness only.
3. Read-only browser audit of merchant `/`, `/guide`, `/app`, `/app/disputes`, one authorized fictional dispute detail, `/app/policy`, `/app/settings`, demo/pool and approval views; shop catalog/product/cart/checkout/order lookup/detail/buyer dispute. Use desktop 1440×900 and mobile 390×844 and 320×740. Record screenshots, behavior, network/console errors and overflow. Do not click purchase, approve, refund, reset or save on the deployed system during this audit.
4. Produce `audit/page-inventory.md` and `audit/interaction-inventory.csv`: page, viewport, control, expected behavior, observed behavior, real/simulated/placeholder, keep/fix/remove, severity, evidence. Include inaccessible states as NOT OBSERVED, not passed.
5. Reproduce reported schema failure and missing order link locally with scrubbed fixtures. Request a specific missing scrubbed fixture/log through secure means if required; do not guess from the old screenshot.
6. Establish a disposable test DB with explicit per-command URL overrides. Never run migration round-trip tests, seeders or `e2e_stack` against the owner's configured shared/deployed DB. That script recreates its dedicated database; check the target before using it.
7. Run baseline checks from section 8 and save output. Add audit findings to this plan's implementation log without rewriting verified history.

**Exit:** complete page/control inventory, environment matrix, reproducible gap list, safe local test isolation and acknowledged baseline failures.

### T01 — Restore a reliable engineering baseline

**Touch:** Makefile/CI, Python/Node version/dependency tooling and affected tests/source only as justified.

1. Align the old Node 20.9 pin with a version supported by the actual lockfile; the prepared Node 24.19 runtime passed builds. Pin a supported tested version consistently in local setup and Render/CI.
2. Fix Linux venv discovery in CI, use frozen npm installation, and make typecheck/import-linter actual required checks. Investigate import-linter's failure; do not accept a banner as a pass.
3. Resolve lint and strict typing defects and reconcile buyer reason `OTHER` with actual backend support. Unknown reasons must route safely to human review; do not delete a supported reason just to satisfy a stale type test.
4. Fix enum parity through the authoritative Python/OpenAPI/client generation flow. Investigate the ledger replay G2-02 mismatch using a fixed clock and original decision context; preserve append-only stored history and gate semantics.
5. Establish reproducible Python dependency resolution/lock through the project's chosen tool, with an ADR if introducing tooling. Avoid an unrelated dependency upgrade campaign.

**Exit:** all baseline required checks pass, or each residual failure has an explicit diagnosed issue and remains a release blocker. No test exclusions or undocumented failures.

### T02 — Add truthful integration readiness and merchant access

**Touch:** `settings.py`, `main.py`, API status/integration routes, new session/access modules as needed, Settings/queries, existing error envelope.

1. Implement decision 1 and authorization tests before exposing new write controls. Scope demo records and merchant records server-side. Check existing unguarded merchant writes, including charter updates and approvals.
2. Extend or add a safe integration-readiness response: configured merchant identity, environment, database, last worker heartbeat, last successful PayPal read/auth check, last verified webhook timestamp, store adapter reachability and LLM configured/last-success/cached/unavailable. Use explicit unknown/not-checked states.
3. Store checks/heartbeats durably. Do not call paid LLM or create PayPal transactions just to render Settings. A token/read-only check is distinct from webhook delivery verified by an actual event.
4. Replace hardcoded connected/merchant/webhook values. 'Check connection' performs a supported backend check; errors remain errors. Never call a status refetch synchronization.
5. Add a small setup checklist linking to policy, store evidence, notifications and the sandbox guide. Existing single-merchant env-managed credentials stay on the server; do not invent a general PayPal Connect button.

**Tests/exit:** unavailable PayPal, stale worker, missing store key and failed check produce honest states; unauthorized and cross-demo writes are rejected; no secret in response/build; Settings success is backed by a real check result.

### T03 — Make capture and transaction correlation reliable

**Touch:** `shop/{service,schemas,router}.py`, `db/models.py`, new forward-only Alembic migration if required, `paypal/orders_client.py`, `store/`, `api/disputes.py`, agent context loading, buyer types/UI.

1. Add explicit PayPal order/capture identifiers and merchant scoping where needed. Inspect duplicate existing IDs before adding a uniqueness constraint. Backfill only verifiable records; quarantine ambiguous/missing links without deleting orders.
2. Validate supplied PayPal order ID against the server-recorded order. Require verified completed capture, expected merchant where available, currency and amount. Missing captures must fail closed in sandbox; synthetic IDs remain stub-only, if needed at all.
3. Use stable PayPal request idempotency keys and durable local intents. Handle double callbacks, concurrent capture and 'PayPal succeeded, DB write failed' with reconciliation rather than blind recapture. Bind tracking creation idempotently to the recovered paid order.
4. Implement one resolver across agent and UI: consider all disputed transactions, resolve verified aliases, prefer merchant-side identity, reject ambiguity. Do not match on email/amount alone. Distinguish not found, ambiguous and store unavailable.
5. Return permitted payment reference fields in authorized buyer order detail; update OpenAPI, generated API client and boundary schemas.

**Tests:** different buyer/seller IDs; multiple disputed transactions; unrelated supplied order ID; missing/failed capture; currency mismatch; duplicate/concurrent capture; restart/reconcile; duplicate legacy mappings.

**Exit:** one actual sandbox purchase has a durable order code and capture ID, all screens and agent resolve the same order, and restart preserves the link. Verify later on Render in T16, not just stub tests.

### T04 — Complete persistent simulated fulfilment

**Touch:** existing Order/TrackingEvent, shop service/routes, store adapters, buyer portal, new protected demo fulfilment UI, worker only if necessary.

1. Reuse existing `TrackingStatus` milestones: PRE_TRANSIT → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED. Map order status to PAID/SHIPPED/DELIVERED without inventing incompatible enum values. Keep dispute lifecycle separate from shipping lifecycle; inspect existing OrderStatus.DISPUTED behavior before migrating or changing its meaning.
2. Persist a shipment identity, milestone source (`simulated`) and occurrence time, with migration only where existing payload/schema cannot support it cleanly. Reject invalid/unknown dates; never substitute now for invalid historic evidence. No future event counts as delivered.
3. Add idempotent protected advancement for a paid demo-owned order. Choose scenario state before opening the dispute: delivered, in transit, missing tracking, or exception. Show the same events in buyer detail and agent store API.
4. Make controls accessible and labeled 'Simulated shipment'. Require operator access or a constrained demo capability; no public arbitrary tracking edits and no uploads to a real carrier.
5. Do not rewrite evidence for a run already executed when advancing a shipment. New evidence requires an explicit refresh/re-evaluation path that still respects current dispute state and mutation idempotency.

**Tests/exit:** legal/illegal transitions, duplicate requests, concurrent advance, server restart and browser reload, missing/early/future delivery, cross-demo access. A new paid shop order can demonstrate every intended milestone without database editing or a seed-only shortcut.

### T05 — Make evidence inspectable and truthful

**Touch:** `agent/evidence.py`, `agent/reasons/`, store models/adapters/API, dispute response types, detail evidence panel and timeline.

1. Define a typed evidence snapshot (NEW CONTRACT): source order/payment references; gathered-at; records and source IDs; simulated/PayPal provenance; tracking history; items/amount; missing/ignored data; strength components; submission eligibility; generated notes; snapshot version/hash.
2. Persist or durably associate each run with its evidence snapshot. Never reconstruct historic evidence from today's mutable tracking records. Record no invented PII and avoid returning full raw PayPal payloads to public sessions.
3. Expose a merchant-scoped evidence read endpoint or extend detail with a typed evidence object. Preserve list performance; fetch details lazily. Unknown/missing order and store outage are distinct.
4. Render 'Evidence strength', its components and limitations, actual source records, missing information and preview of what can be submitted. 'Evidence gathered', 'submission intended', 'submitted', and 'confirmed by PayPal' are separate states.
5. Preserve the distinction between notes-only evidence and proof of delivery. Missing tracking is not automatically fraud, automatic refund, or adequate delivery proof. Route decisions through existing reason handling and policy.

**Tests/exit:** correct provenance and dates; missing/invalid tracking; store 404 vs 401/5xx; unsupported reason; refresh history; notes-only evidence never labeled proof of delivery. A person can explain every displayed score component from stored records.

### T06 — Fix real-provider plan validation and failure recovery

**Touch:** `agent/{schemas,prompts,llm,cache,loop}.py`, relevant tests and diagnostic envelopes.

1. Capture a scrubbed failing action structure reproducing `actions.0/actions.1`; retain schema version, provider/model label, validation paths/types, attempt count and correlation ID without logging secrets or raw buyer messages.
2. Generate prompt/schema examples from the same Pydantic discriminated union. All action names, required money shape and fields must agree. Check response truncation and provider envelope handling.
3. Verify provider capabilities. Use strict JSON-schema/structured output only where documented and supported; otherwise use the strict prompt path. Do not silently catch every provider error as unsupported schema mode.
4. Keep the existing single bounded repair attempt, supplying the actual required schema and sanitized validation feedback. No arbitrary coercion of action names, floats, currencies or unexpected fields. Enforce action applicability and evidence references before execution; LLM text cannot manufacture tracking or bypass the gate.
5. Cache only validated plans with prompt/schema version and evidence-aware inputs; invalid output must not be cached. Expose cached vs live reasoning per run.
6. After exhaustion, persist a visible human-review task and failed run reason. A model failure does not authorize a refund, fake successful plan or a misleading approval card for an action that was never validly proposed.

**Tests/exit:** valid actions, malformed JSON, wrong discriminator, extra fields, money errors, refusal, truncation, timeout, 429, outage, exhausted budget, repair success/failure, hostile buyer text. Real hosted provider produces a valid plan for multiple fictional evidence states in the authorized rehearsal; one lucky response is insufficient.

### T07 — Verify webhook, sync, gate and executor as one workflow

**Touch:** `webhooks.py`, `paypal/{webhook_verify,read_client,mutating_client}.py`, `sync/`, `queue/`, `policy/`, `executor/`, `worker.py` as needed.

1. Verify signatures with the correct sandbox app/webhook ID; correlate verified event ID, dispute ID, queue job, run and execution. Separate distinct events from duplicate deliveries. Never deduplicate by timestamp alone.
2. Prove poller catch-up for missed/delayed events, lease recovery on restart, dead-letter visibility and stale job cancellation. A worker must actually process; API health alone is not readiness.
3. Preserve pure deterministic gates and current rule meanings. For any semantic change, add failing gate/parser tests first and document the decision. Never create an exception to make the demo pass.
4. Revalidate fresh PayPal allowed actions, fingerprint, deadline and amount immediately before mutation. Preserve INTENDED/SENT/CONFIRMED/FAILED states and reconcile ambiguous timeouts by read, never blind write retry.
5. Distinguish evidence submission, settlement offer, accept-claim/refund consequence and PayPal case resolution. No new standalone refund endpoint unless explicitly required and verified; reuse the existing gated action semantics.

**Tests/exit:** duplicate event causes one effective action; distinct events retained; stale-state action blocked; replay deterministic; restart after PayPal response recovers; failed provider write does not mark resolved. Verify evidence/offer/accept-claim against official request contracts and scrubbed sandbox responses.

### T08 — Make approvals work across Render services and phone refreshes

**Touch:** `approvals/service.py`, approval API/executor, dispute API, ApprovalPage and new durable merchant approval listing/access route.

1. Implement decision 4. Discover pending approvals from DB, not `DEMO_APPROVAL_LINKS`. Authenticated action-by-approval-ID calls reuse the existing resolve/edit/deny service with the same hashes, expirations and re-gating.
2. Preserve secure expiring bearer links where supported. Do not use notification URLs containing raw approval tokens; deep-link to authenticated dispute/approval views. Public demo capability exposure must be explicitly limited to demo-owned actions.
3. Support approve, deny and permitted edit with reviewable amount, currency, action, evidence and policy explanation. Double tap, concurrent resolve, expired, stale, already-used and offline states are explicit. Expiry is server time.
4. Approval request is not execution success. Refresh until confirmed or show pending/failed honestly; approval denial must not execute anything.

**Exit:** an approval created by the worker remains visible to the separate API after both restart; phone refresh works; one approval yields at most one effective action; forged/expired/cross-session requests fail.

### T09 — Deliver toasts and persistent notifications

**Touch:** shared UI provider/components, shell, mutation hooks; new notification/outbox models/migration, API routes and worker handlers (all NEW DESIGN).

1. Introduce a small shared toast component/provider with accessible live regions, dismiss action, sensible timeout and deduplication. Success only after confirmed operation; pending and retry states are distinct. No notification storm from polling rerenders.
2. Integrate policy save, order capture, fulfilment advance, approval resolution, evidence submission confirmation, connection checks, copy-link and recoverable failures. Add inline field errors where a toast alone is inadequate.
3. Persist notifications for new dispute, review needed, approval requested, confirmed action, execution failure and deadline reminder. Proposed minimum data: ID, scoped merchant/demo recipient, kind, source event ID, dispute/approval reference, created/read timestamps and safe message. Define a DB uniqueness key over recipient/source/kind.
4. Create notification plus outbox within the same committed business transaction. Worker leases/retries delivery with bounded backoff, idempotent destination attempts and visible permanent failure. No 'sent' before the send succeeds.
5. Add notification centre with unread count, pagination, read/unread, accessible empty/loading/error states, links to the relevant case, and refresh on focus/poll. Reading a notification does not approve a case. Deadline reminders have a stable deduplication window and stop when no longer relevant.

**Tests/exit:** retry/duplicate events produce one inbox item; cross-session reads/writes denied; unread count persists across reload; no secret/PII in message; API/worker restart preserves pending delivery and inbox history.

### T10 — Deliver actual opt-in mobile web push

**Touch:** frontend manifest/service worker, Settings opt-in UI, new subscription endpoints/models, worker push delivery, runtime configuration/docs.

1. Add HTTPS PWA manifest/icons and a versioned service worker on the merchant origin. Use standard PushManager/VAPID and an established maintained library if needed, with dependency ADR. Never cache private API responses, checkout/approval actions or secrets; plan service-worker update/invalidation behavior.
2. Store scoped subscriptions securely; public VAPID key is browser-readable, private key is server-only and stable across deployments. Proposed new variable names such as WEB_PUSH_VAPID_PRIVATE_KEY/PUBLIC_KEY/SUBJECT must be documented and supplied securely, not fabricated by the coding agent.
3. Ask permission only after the user taps 'Enable phone notifications'. Handle unsupported, default, granted, denied, unsubscribe and revoked states. Do not automatically prompt on page load.
4. Deliver from the durable outbox. Treat 404/410 subscription expiration as cleanup, 429/5xx as bounded retry, and other errors as diagnosable failures. Subscription endpoint URLs are untrusted input: restrict HTTPS destinations to verified push-service patterns, reject local/private/reserved targets, bound payloads/timeouts and redact endpoint URLs/keys from logs.
5. Use generic locked-screen copy ('A dispute needs your review') and authenticated deep links. Notification click opens the right merchant page and never performs an approval or payment.
6. Test Android Chromium and physical iPhone/iPad where supported. On iOS, explain supported OS/Home Screen installation requirements before opt-in. Permission granted in a desktop emulator is not proof of mobile push delivery. In-app inbox remains functional when push is unavailable.

**Exit:** record a real backgrounded-phone notification from the deployed worker, click-through to the correct case, opt-out, stale-subscription cleanup and restart persistence. Mark physical-device validation BLOCKED if unavailable; do not silently omit it from release acceptance.

### T11 — Correct dashboard state and audit history

**Touch:** KPI API/projections, dashboard adapters, dispute list/detail, timeline, widgets, query invalidation.

1. Separate PayPal dispute status, agent run state, gate verdict, approval state and execution result. An old approval verdict must not obscure a newer failed run; a successful mutation does not necessarily mean the case is resolved.
2. Show linked order/evidence, current plan, plain reason and rule, last successful sync and actionable errors. Reflect worker results via current server data with bounded polling and stale/offline labels.
3. Reconcile KPI totals with source records. Remove or clearly label assumed time/money-saved estimates; verify 'auto resolved' counts actual outcomes. Never count a submitted offer as a win.
4. Order history by server time plus stable tie-breaker. Keep duplicate-delivery metadata without manufacturing repeated actions. Do not rewrite ledger records to make chronology look prettier.
5. Preserve AG Studio's existing integration and truthful fallback unless audit plus owner decision justifies removal. Known empty grid/icons must not conceal primary actionable data.

**Exit:** list/detail/approval/KPI/notifications all agree after automatic action, human decision, failed run, refresh and browser back. Audit shows the actual chain and source IDs.

### T12 — Finish mobile UX, copy and deliberate removal

**Touch:** shared tokens/components, Layout/MarketingLayout, all audited pages, buyer portal, links, guide/claims.

1. Use the existing token system for typography, color, spacing, borders and focus. Produce one mobile merchant shell, readable summary cards, collapsible secondary detail and a consistent primary action per screen.
2. Make tables usable without page-level overflow, wrap identifiers, use grids that shrink below 320px, keep dialogs within the viewport and handle software keyboard/safe areas. Use approximately 44px touch targets, labeled inputs, visible focus, semantic headings and accessible confirmations.
3. Rewrite the full audited copy inventory: headings, labels, hints, errors, loading/empty states, policy rules, notification messages and onboarding. Explain 'Signing limits', 'Needs your review', 'Simulated shipping', and 'Evidence strength'. Technical IDs belong in expandable detail; useful rule explanations stay visible.
4. Fix `/app/disputes/{id}` deep links, cross-app URLs, SPA refreshes and back behavior. Replace absolute hardcoded deployment URLs with verified configuration.
5. Remove false success text, dead controls, invented carrier claims and unsupported fixed PayPal response-window claims. Use the dispute's actual deadline. Consolidate duplicate navigation/demo entry points; retain compatibility redirects for useful old links.
6. Use the T00 inventory to classify every removal. Do not delete buyer replies, approvals, signing limits, evidence history, push, or AG Studio merely because they are hard. If a feature is broken, fix it or explicitly obtain a scope decision.

**Exit:** every inventoried control is functional, honestly disabled with reason, or deliberately removed; mobile 320/390 widths have no unintended horizontal overflow; keyboard/focus tests pass and no serious/critical axe findings on changed flows. Phone checks include checkout, order lookup, evidence, approval and notifications.

### T13 — Build an automated acceptance suite

Reuse `signoff/agent/tests`, Vitest suites and `signoff/e2e` infrastructure. Add failing tests before fixing gate/parser semantics. Prefer behavior and integration tests over tests that mirror implementation. Implement the matrix in section 7 as cross-app tests on a fresh isolated DB; use fixtures with fixed clocks. Browser tests may use stub services, but must not intercept away the very backend behavior they claim to test.

Add migration tests for current populated schema → new schema, preservation of existing IDs/history and repeated deploy safety. Test API/worker as different processes, not only a single TestClient. Check secret canaries in both frontend build outputs. Add exact schema-generation freshness checks and both Python/TS enum parity. CI must run on pull requests as well as the release branch.

**Exit:** relevant unit/integration/type/architecture/accessibility tests and all acceptance scenarios pass; failing output is attached rather than hidden. Hosted tests use a separate explicit mode with no default mutation of a configured Render system.

### T14 — Prepare a reviewable Render release

**Read/extend:** existing `build-plan/v2/04-deploy.md`, `signoff/docs/{real-mode,env-checklist}.md`; create `build-plan/v3/RENDER-RELEASE.md` during execution.

1. Inventory existing service IDs/configuration using the available Render UI/API access. Prefer current services, not a second unknown stack. Record API/worker/frontend release SHA, database target and region. If access is missing, prepare exact commands/settings and ask for that specific access or operator step only when needed.
2. Prepare a configuration matrix: API and worker share DATABASE_URL, STORE_API_KEY, sandbox merchant credentials and provider settings; PUBLIC_BASE_URL points to the API; worker reconciliation/heartbeat enabled; webhook is `/webhooks/paypal` on the same configured sandbox app; frontends have the correct API/shop/merchant URLs; ALLOWED_ORIGINS exact; sessions and push configured per decisions above. Do not print values.
3. Ensure APP_ENV=prod with PAYPAL_ENV=sandbox for hosted sandbox testing. Disable fake LLM, stub PayPal and mock-fetch frontend modes. Clearly label genuine cache hits. Check DEMO_HOLD_DISPUTES and claim flow deliberately: a held case must be explicitly released by the judge flow, not mistaken for a stopped worker.
4. Make additive migrations backward compatible with the previous API/worker during rollout. Verify recoverable DB backup/snapshot before migration. No destructive seed/reset or catalog replacement in release commands. Snapshot restoration is last resort because it can lose new records.
5. Prepare exact build/predeploy/start commands using the existing Docker image and npm workspaces. Confirm required scripts/fixtures are copied into the image. Run migrations once, not racing on API and worker startup. Pin consistent dependency/runtime versions.
6. Record frontend build-time configuration: changing VITE/PUBLIC values requires rebuilding static sites. Configure SPA rewrites and the merchant service-worker scope; invalidate stale assets correctly.
7. Set rollout sequence and rollback: quiesce worker if compatibility requires; migrate; deploy API; deploy worker; deploy/rebuild both frontends; check health, access/session and queue; re-enable processing. Roll back app versions only if schema-compatible; otherwise use a prepared forward fix. Never replay uncertain SENT mutations blindly.

**Exit:** release document contains commands/settings, exact SHAs, migration/backup evidence, verification, rollback and a concrete release approval checkpoint. All work up to that checkpoint is complete and reviewable.

### T15 — Deploy the authorized release

After release authorization, deploy the prepared artifact/SHAs through the supported Render route. Confirm each service actually runs that version and the worker has current heartbeat/reconciliation, not just HTTP health. Apply required secrets securely in Render rather than assuming Codex variables propagate. Build both static sites with the intended release configuration. Record deployment IDs/timestamps and failures. Do not call 'git push succeeded' proof of successful deployment.

**Exit:** all services reflect the selected compatible release; DB migration revision, worker operation, CORS/session, static assets and direct-route refresh checks pass.

### T16 — Prove the deployed buyer-to-agent-to-merchant flow

Run only with authorization, fictional sandbox accounts and uniquely tagged rehearsal data. No destructive reset of other judges' records. Use the deployed merchant and shop sites on separate browser contexts; use a real supported phone for mobile push/approval.

1. Purchase a fresh candle order using PayPal sandbox. Save sanitized order code, order ID and capture ID; confirm server amount/currency and persisted record after reload.
2. Advance that order's simulated shipment using the authorized UI. Verify buyer and merchant see the same labeled timeline; record exact evidence snapshot.
3. Separately sign in as the buyer in PayPal's sandbox Resolution Center and open a dispute against that capture. This is the actual product journey; no Signoff-hosted buyer-dispute form or buyer-assertion shortcut may substitute for it. Record the manual PayPal operator step honestly; never replace a real dispute with a local fake and call it live.
4. Observe verified webhook or documented poller catch-up, linked order, evidence, valid model plan, gate verdict, queued execution/approval and current dashboard state. Collect correlation IDs and scrubbed screenshots/response fragments.
5. Demonstrate at least one allowed evidence submission confirmed by PayPal, and one over-limit case requiring phone approval followed by the supported sandbox offer/claim action. Verify the PayPal state independently; do not infer it only from the local ledger. If sandbox does not expose a supported action, mark the specific capability blocked and retain proof of the upstream response.
6. Demonstrate missing evidence and provider-invalid-output paths with controlled rehearsal fixtures/staging configuration, never a public unauthenticated failure toggle. Confirm visible human review and no unauthorized action.
7. Receive a real background push; open it, approve/deny deliberately in-app, then verify persistent inbox and final history. Test API/worker restart with pending work, not by losing active test data.
8. Recheck phone navigation, refresh on deep links, network reconnection, errors and copy. Fix defects and rerun affected checks; do not declare success based on the local suite.

**Exit:** dated evidence bundle from actual Render release covers section 7, with PASS/BLOCKED/NOT RUN per row. All required rows must pass to claim complete delivery. Manual PayPal steps and platform limitations stay visible.

### T17 — Handoff and competition readiness

Update root/nested README, claims ledger, environment checklist, demo script and STATUS with only proven behavior. Provide a short judge journey with access instructions, supported phone push setup, real/simulated distinctions and a recovery path. Prepare a concise demonstration recording matching verified official rules; no claims based on cached/fake reasoning presented as live.

Deliver owner report: deployed URLs, release SHAs/deploy IDs, scenario evidence, checks/counts, unresolved limitations, rollback and first troubleshooting steps. Do not leave 'works locally; deploy it yourself' as the final outcome when deployment access and approval have been provided.

## 6. Recommended delivery order and effort budget

These are planning estimates, not promises or reasons to skip verification. Sequence work even if one agent executes it all.

| Milestone | Tasks | Approximate focused effort | Reviewable outcome |
|---|---|---|---|
| Audit and reliable baseline | T00–T02 | 1–2 days | Honest readiness and protected merchant access |
| Complete commerce/evidence slice | T03–T05 | 2 days | Purchased order → persistent tracking → inspectable evidence |
| Reliable agent and approvals | T06–T08 | 2 days | Valid plan → gated action or durable phone approval |
| Notifications and mobile product | T09–T12 | 2–3 days | In-app feedback, persistent inbox, web push, usable screens |
| Automated proof and Render release | T13–T16 | 1–2 days | Tested deployed journey and physical-phone evidence |
| Submission buffer | T17 | Reserve remaining time | Accurate guide, recording, fixes |

If the remaining deadline cannot accommodate the full estimate, report the concrete conflict early with task status and owner decisions needed. Do not silently remove an approved workstream or claim unfinished work is done. T13 tests should grow during implementation; the task is final suite consolidation, not permission to postpone all testing.

## 7. Acceptance matrix: implementation and hosted release

| ID | Setup/action | Required observable result |
|---|---|---|
| A01 | Sandbox checkout and reload | One durable paid order; actual capture ID, exact currency/amount; no duplicate capture. |
| A02 | Buyer and seller transaction IDs differ | Correct merchant order found consistently by list/detail/agent, using verified mapping. |
| A03 | Multi-transaction/ambiguous match | All candidates considered; ambiguity visible; no guessed evidence/action. |
| A04 | Advance a paid demo shipment | Durable forward-only labeled simulated events; buyer/agent snapshots agree. |
| A05 | Delivered shipment, supported dispute/action | Evidence shows actual stored records and provenance; gated submission confirmed by PayPal. |
| A06 | No order, missing tracking, invalid/future timestamp, or store outage | Accurate missing-data/error state; no invented delivery or silent success. |
| A07 | Over-limit monetary proposal | Server requires approval; phone approve/deny/edit uses fresh gate and acts at most once. |
| A08 | Invalid model output twice | Bounded repair exhausted; visible human review; no cache pollution or executor call. |
| A09 | Duplicate webhook / distinct subsequent event | Duplicate is safe; distinct event preserved; no repeated effective mutation. |
| A10 | Stale approval, double tap, expired link, restart | Rejected/reconciled accurately; no hard-rule waiver or lost pending approval. |
| A11 | New dispute, review, action confirmation and failure | Correct deduplicated persistent notifications and accessible transient feedback. |
| A12 | Phone push opt-in, background delivery, click, opt-out | Real device receives message; correct authenticated case opens; no action on click. |
| A13 | Other demo session/unauthorized user | Cannot change fulfilment/policy, read inbox/approval or obtain other buyers' evidence. |
| A14 | 320px/390px screens, keyboard, offline/reconnect | No blocking overflow; reachable actions; preserved forms; honest errors/retries. |
| A15 | Restart API and separate worker | Durable order/evidence/inbox/approval/outbox; queued work resumes without duplicates. |
| A16 | Deployed deep links, worker heartbeat, configured provider | Actual selected release; routes reload; worker current; real valid provider plan proven. |

At least A01/A02/A04/A05/A07/A11/A12/A15/A16 need deployed evidence. Exercise destructive/hostile/failure-injection cases in isolated automated environments and safely scoped hosted staging/rehearsal data where appropriate; document any hosted case not exercised. Matrix PASS requires expected behavior, not merely HTTP 200 or a screenshot of a badge.

## 8. Verification commands and evidence handling

Run from repository root using a disposable explicit test database. Verify actual make targets first; current `make test-agent` stops at Ruff before pytest, and `make test-web` stops at ESLint before Vitest. Run independent checks too so skipped downstream suites are visible. Keep command exit codes when capturing logs.

```bash
make test-agent VENV_PY=.venv/Scripts/python.exe
make test-web
make test-types VENV_PY=.venv/Scripts/python.exe
.venv/Scripts/python.exe -m pytest -q
MYPYPATH=signoff .venv/Scripts/python.exe -m mypy --strict signoff/agent/app
PYTHONPATH=signoff:signoff/agent .venv/Scripts/python.exe .venv/bin/lint-imports
npx tsc --noEmit
npx vitest run --maxWorkers=2 --minWorkers=1
.venv/Scripts/python.exe signoff/scripts/check_enum_parity.py
VITE_API_URL=http://localhost:8000 npm run build
```

The import-linter invocation is the installed Linux console script launched through the mandated Python path; first confirm the installed package/version and command entrypoint. Test runner problems remain failures until diagnosed. The current requirements may need tooling corrections in T01.

During the implementation task (unlike read-only onboarding), deliberate schema/API changes must run the repository OpenAPI export + generated client steps and commit the reviewed output. Check both the exported spec and generated TypeScript, not only schema.ts against a potentially stale spec. Do not execute generators during a read-only audit.

Use the existing cross-app configuration for stub integration:

```bash
make e2e-stack VENV_PY=.venv/Scripts/python.exe
npx playwright test --config signoff/e2e/playwright.cross.config.ts --grep '@smoke|@full'
```

Read its implementation first: it recreates `signoff_e2e`, starts stub/fake services and may terminate its registered processes. Override all test settings as needed so inherited prod/sandbox credentials and remote database URLs cannot leak into tests. Keep service-launch sessions alive in this runner. Run real hosted rehearsal separately with explicit URLs/approval; do not aim the stub stack at Render or use production failure toggles.

Evidence directory (NEW artifact layout): `build-plan/v3/evidence/<release-sha>/`. Store run summary, checks, redacted screenshots and scenario traces. Keep private raw traces outside Git in ignored storage; Playwright traces/HAR can contain cookies, buyer details and authorization URLs. Inspect/redact before sharing. Label viewport, URL origin/path, release SHA, timestamp and live/stub/cached mode on evidence. Never label a stub response as PayPal sandbox confirmation.

## 9. Final definition of done

- Every task has an execution-log outcome; no missing workstream.
- Required automated checks pass with meaningful test counts and no unexplained failures.
- The exact reviewed release runs on Render API, worker and both frontends.
- A fresh real sandbox purchase maps to its actual dispute and labeled simulated fulfilment evidence.
- At least one verified PayPal evidence action and one required human approval work end to end.
- Mobile toasts, durable inbox and real opt-in background push work with documented platform support.
- Restart/retry/failure cases preserve evidence and prevent duplicate or unauthorized mutations.
- Copy and claimed functionality match observed reality; no secrets or false live-carrier claims.
- Owner receives deployment proof, known limitations, judge instructions and rollback steps.

Until then report partial progress precisely. A functioning landing page, an LLM_MODE label, seed-only scenario, or localhost test pass does not satisfy this definition.
