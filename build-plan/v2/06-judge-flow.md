# 06 — The judge flow: store adapter, hold, claim, approval link, replay

**Goal:** a judge who has never seen the project opens a URL, picks a dispute, watches the agent work, and approves a decision — without you in the room and without a server log.
**Time:** 7 hours.
**Before you start:** Stage 4 deployed, Stage 5 proved the PayPal half.

---

## What this stage builds, and why each part exists

| Part | Why it exists | Replaces |
|---|---|---|
| A. Store read API | The agent must get order proof over HTTP, not from an in-process mock | The claim "it connects to a store through an adapter" |
| B. `StoreAdapter` | One interface, two implementations (HTTP shop, local mock). This is the Shopify answer | Luminary |
| C. Bind orders to real transactions | A real sandbox payment needs proof attached to its real transaction id | The stub-only scenario ids |
| D. Hold mode | Disputes arrive from PayPal but must not be spent before a judge sees one | A pool that burns itself on webhooks |
| E. Claim endpoint and pool page | A judge starts a dispute on purpose | Filming everything live |
| F. Approval link on the dispute page | The token only goes to the server log today, so nobody can approve | Manual log reading |
| G. Replay | When the pool is empty, a judge still sees a real run | Nothing |

Work in that order. Each part has its own commit.

---

# Part A — Store read API (90 min)

The shop already owns the orders, tracking and buyer messages. Expose them read-only, behind a key.

### A1. Add the setting
**PROMPT.**

> Add a `store_api_key` field to `Settings` in `signoff/agent/app/settings.py`, `validation_alias="STORE_API_KEY"`, default empty string. In `validate_env_combinations`, when `app_env == AppEnv.prod` and `store_api_key` is empty, add `"STORE_API_KEY"` to the same `missing` list that already reports `PAYPAL_CLIENT_ID`. Follow the existing style exactly. Add one test to `signoff/agent/tests/test_settings.py` proving production refuses to start without it, and one proving local does not.

### A2. Create the router
**PROMPT.**

> Create `signoff/agent/app/api/store.py` with a FastAPI `APIRouter` and these read-only endpoints. All of them require a header `X-Store-Key` equal to `Settings().store_api_key`; return 401 with the project's standard error envelope otherwise. No endpoint may write.
>
> - `GET /api/store/orders/by-transaction/{transaction_id}` → 404 if unknown. Returns `{order_code, customer_email, amount, currency, status, created_at, items}` reading the existing `Order` model.
> - `GET /api/store/orders/{order_code}/shipments` → list of `{carrier, tracking_number, status, event_time, payload}` from `TrackingEvent`, ordered by `event_time`.
> - `GET /api/store/orders/{order_code}/messages` → buyer messages for that order from the existing buyer-dispute records in `agent/app/shop/disputes.py`; empty list if none.
> - `GET /api/store/policies` → static merchant policy text: returns, shipping, refund window. Return a small constant object; do not invent a database table.
>
> Register the router in `signoff/agent/app/main.py` next to the others. Add Pydantic response models in the same module. Add `signoff/agent/tests/test_store_api.py` covering: missing key → 401, wrong key → 401, unknown transaction → 404, known order → 200 with shipments, and that every route is GET only.

**Check:**
```bash
cd signoff
./.venv/Scripts/python.exe -m pytest agent/tests/test_store_api.py -q
```
Expected: all pass.

---

# Part B — `StoreAdapter` (90 min)

This is the file that answers "can it work with Shopify?" in one sentence.

### B1. Move the record types out of `store_mock`
**PROMPT.**

> Create `signoff/agent/app/store/models.py` containing `OrderRecord`, `ShipmentRecord` and `MOCK_MERCHANT_ID`, moved verbatim from `signoff/agent/app/store_mock/scenarios.py`. Update `scenarios.py` to import them from the new module and re-export them so existing imports keep working. Change `agent/app/agent/evidence.py`, `agent/app/agent/reasons/not_as_described.py`, `agent/app/agent/reasons/__init__.py` and `agent/app/agent/loop.py` to import from `agent.app.store.models`. Run the full agent test suite; nothing may change behaviour.

**Check:** agent tests still 373 passing.

### B2. Define the interface and two implementations
**PROMPT.**

> In `signoff/agent/app/store/`:
>
> - `base.py`: a `Protocol` named `StoreAdapter` with exactly four methods — `find_order(transaction_id) -> OrderRecord | None`, `get_shipments(order_code) -> list[ShipmentRecord]`, `get_messages(order_code) -> list[dict]`, `get_policies() -> dict`. All synchronous. Every method must be documented with what it returns and what it raises.
> - `http_adapter.py`: `HttpStoreAdapter(base_url, api_key)`, calling the Part A endpoints with `httpx` and an `X-Store-Key` header. Timeout 10 seconds. On connection failure raise a dedicated `StoreUnavailable` error rather than returning None — None means "order not found", not "store is down". Map the response JSON into `OrderRecord`/`ShipmentRecord`.
> - `local_adapter.py`: `LocalStoreAdapter(session)` wrapping the existing `load_order_context` in `agent/app/store_mock/repository.py`. Used by tests and by the stub demo.
> - `factory.py`: `build_store_adapter(settings, session)` returning `LocalStoreAdapter` when `paypal_env == stub`, else `HttpStoreAdapter(settings.public_base_url, settings.store_api_key)`. The base URL points at this same API, which is correct: the shop data lives in the same database, and putting it behind HTTP is what makes the interface real.
>
> Add `signoff/agent/tests/test_store_adapter_contract.py` that runs the same contract tests against both implementations using an in-memory SQLite session and an httpx mock transport. Every adapter must satisfy: unknown transaction returns None, known transaction returns the order with its shipments, a network failure raises `StoreUnavailable` rather than None.

**Check:** the contract tests pass against both adapters.

### B3. Use the adapter in the agent loop
**PROMPT.**

> In `signoff/agent/app/agent/loop.py`, replace the direct `load_order_context(...)` call with the injected `StoreAdapter`. Add the adapter to the agent context or constructor alongside the existing session. If the store is unavailable, the run must fail closed — stop and request human review — not run with empty evidence. Add a test proving a `StoreUnavailable` produces a human-review outcome, never an automatic decision.

**Check:** `grep -rn "store_mock" signoff/agent/app/agent/` returns only `local_adapter.py` and `models.py` references.

---

# Part C — Bind a real transaction to a seeded order (45 min)

The stub scenarios are keyed by transaction id. A real payment has a different id. Bind them.

### C1. Seed CLI
**PROMPT.**

> Add `signoff/scripts/bind_order.py`. Usage:
> `python -m scripts.bind_order --txn <paypal_transaction_id> --scenario A|B|C|D|E`
> It inserts an `Order` and its `TrackingEvent` rows copied from the chosen `SCENARIOS` entry, with `order_code` set to `SIG-{scenario}-{first 8 chars of txn}` and `paypal_transaction_id` set to the real id. It must be idempotent: running twice does not duplicate. It prints the inserted order code and the evidence it will supply (carrier, tracking number, delivered or not). Reuse `seed_scenarios` rather than writing new insert logic.

**Check:**
```bash
cd signoff
./.venv/Scripts/python.exe -m scripts.bind_order --txn TX-TEST-12345678 --scenario A
```
Then `GET /api/store/orders/by-transaction/TX-TEST-12345678` returns the order.

### C2. Bind the real disputes
**YOU.** For each real dispute you are keeping, take its capture transaction id from Stage 5 and pick the scenario that tells the story you want:

| Scenario | Story | Use it when the dispute is |
|---|---|---|
| A | Delivered, with tracking | a not-received claim you intend to fight |
| C | Large, two shipments | above the $100 auto-act limit, so it needs approval |
| D | Injection attempt in the buyer note | where you want to show the block |
| E | Repeat disputer | where you want to show the history flag |

---

# Part D — Hold mode (2 hours)

The problem: seconds after a dispute is filed, the webhook arrives and the agent acts. By the time a judge arrives, the interesting part is over — and each run costs an LLM call.

### D1. Add the setting
**PROMPT.**

> Add `demo_hold_disputes: bool` to `Settings`, `validation_alias="DEMO_HOLD_DISPUTES"`, default `False`.

### D2. Stop the agent at the right place
**PROMPT.**

> In `signoff/agent/app/sync/handler.py`, at the point where a `JobKind.RUN_AGENT` job is created (around the `kind=JobKind.RUN_AGENT.value` construction), first check `settings.demo_hold_disputes`. Apply the rule **only** to disputes created after the deploy, never to disputes already processed.
>
> Use a `DemoPool` table (create it in `signoff/agent/app/db/models.py`): `dispute_id` primary key, `state` (`pooled` | `claimed` | `done`), `claimed_at`, `scenario_label`, `created_at`. On sync, if hold is on and no pool row exists, insert one with state `pooled` and return without enqueuing `RUN_AGENT`. Write a ledger event kind `DISPUTE_POOLED` so the timeline explains the pause.
>
> If hold is on and the row exists with state `pooled`, still do not enqueue. Only enqueue when state is `claimed`.
>
> Add `DEMO_POOL_HOLD` to the docs and to `signoff/docs/env-checklist.md`.

**Important:** the sync still runs and the dispute still appears in the list. Only the agent is held. That is what makes the pool visible before it is used.

### D3. Claim endpoint
**PROMPT.**

> Add `POST /api/demo/claim/{dispute_id}` to the existing demo router at `signoff/agent/app/simulator/router.py` (it already carries the `/api/demo` prefix). It requires header `X-Demo-Token` equal to `DEMO_CLAIM_TOKEN` (new setting, default empty; if empty the endpoint returns 404 so it cannot be used by accident). Behaviour:
>
> - Unknown dispute → 404.
> - Pool row already `claimed` or `done` → 409 with `{"code":"ALREADY_CLAIMED"}` and the existing claimed time.
> - Otherwise, set state `claimed` and `claimed_at`, enqueue a `RUN_AGENT` job, return `{"dispute_id":..., "status":"claimed"}`.
>
> Use a conditional `UPDATE ... WHERE state = 'pooled'` so two judges cannot claim the same dispute. Add tests for the double-claim race and for the empty-token 404.

**Check:** two `curl` calls in a row — the first returns 200, the second 409.

### D4. Pool listing
**PROMPT.**

> Add `GET /api/demo/pool` returning each dispute with `{dispute_id, state, scenario_label, amount, reason, created_at, seller_response_due_date, claimed_at}`. Read amounts and reasons from the existing `Dispute` rows; never expose buyer messages or any token here.

---

# Part E — Pool page in the merchant app (2 hours)

### E1. The page
**PROMPT.**

> Add a `/app/pool` route in `signoff/web/src/features/` with a page titled **Demo disputes**. For each pooled dispute show: a plain-language label (`scenario_label`), the amount, the reason, the due date, and a primary button **Open this dispute**. Claiming posts to `/api/demo/claim/{id}` then navigates to `/app/disputes/{id}`.
>
> States to build: loading, empty ("No demo disputes right now — three finished runs are available below"), already claimed by someone else (409, explain politely and offer the replay), and error. Mobile-first, 390px wide.
>
> Put the same list on the landing page under a **Try it in 3 minutes** section, linking to `/app/pool`.

### E2. Start-over
**PROMPT.**

> Add a **Start over** button on the pool page that clears the judge's local demo state and returns to the list. It must not delete any ledger row or decision. Add a test proving the ledger row count is unchanged after Start over.

### E3. Labels
**YOU.** The `scenario_label` is what a judge reads before choosing. Write one short sentence each, in the style of the existing copy, for example: "Delivered with tracking — the agent fights this one" and "Larger than your limit — needs your approval". No jargon, no rule ids.

---

# Part F — Approval link a judge can reach (60 min)

Today `LOG_APPROVAL_LINKS` writes the URL to the server log. The user decision is that the **demo workspace** surfaces it.

### F1. Keep the raw token for the demo
**PROMPT.**

> In `signoff/agent/app/approvals/service.py`, when `create_approval` generates `raw_token`, additionally store it in an in-memory map on the app state: `app.state.demo_approval_links[dispute_id] = raw_token`, and record created time. Only do this when a new setting `demo_show_approval_links` is true (default false). The database must continue to store only `token_hash`. Document in the docstring that this map is process-local, holds no more than 200 entries (evict oldest), and exists only for the hosted demo.

### F2. Expose it on the dispute detail response
**PROMPT.**

> In `signoff/agent/app/api/disputes.py`, add an optional field `approval_url` to the dispute detail response. Populate it only when `demo_show_approval_links` is true and a token exists for that dispute: `f"{settings.web_base_url}/approve/{raw_token}"`. Never populate it in the list endpoint. Add a test proving the field is absent when the flag is false and absent when no token exists.

### F3. Show it
**PROMPT.**

> On the dispute detail page, when `approval_url` is present, render a prominent **Open approval card** button. Open it in the same tab so a judge on a phone does not lose their place. Show the gate reason and rule id next to the button.

**Check:** from the pooled dispute, one tap reaches the approval page.

---

# Part G — Replay (45 min)

**PROMPT.**

> Add a **Finished runs** section on the pool page listing disputes whose pool state is `done`, newest first, with amount, reason, verdict and the rule id. Tapping one opens the existing dispute detail in read-only mode. Reuse the dispute detail page; do not build a new one. Add an empty state.

**YOU.** Mark a pool row `done` when its dispute reaches a resolved state — either in the sync handler when the dispute resolves, or with a small admin call. Pick the simpler of the two and record which in `decision-log.md`.

---

# Part H — Refresh the pool (30 min)

**YOU**, before the video and again before submission.

Run this checklist and record the result in the table in `05-real-sandbox.md`:

1. For each of five disputes, confirm the buyer response window has more than one third left.
2. Replace any that do not: file a new dispute, capture the transaction id, run `python -m scripts.bind_order --txn <txn> --scenario <X>`, and let the webhook pool it.
3. Confirm `GET /api/demo/pool` shows five `pooled` rows.

---

## Done when

- [ ] `StoreAdapter` is used by the agent; `grep` shows no direct `store_mock` import in `agent/app/agent/`
- [ ] Contract tests pass against both adapters
- [ ] Five disputes are `pooled` and visible on `/app/pool`
- [ ] A judge can claim one, watch it run, and reach the approval card in one tap
- [ ] A second claim of the same dispute returns 409
- [ ] Finished runs are listed and readable
- [ ] Web 159+ pass, agent 373+ pass

---

## If it goes wrong

**Every dispute is claimed the moment it is filed.** Hold mode is not on, or the sync handler check is placed after the enqueue. Put the check immediately before the `RUN_AGENT` job is created.

**The agent runs but finds no order.** `bind_order` was run after the dispute was claimed. The lookup happens when the agent runs, so bind first, then claim. To recover: let the dispute be re-synced, or claim a fresh one.

**`StoreUnavailable` every time on the deployed API.** `PUBLIC_BASE_URL` is wrong, or `STORE_API_KEY` differs between the setting and the caller. Both come from the same settings object, so this only happens if `PUBLIC_BASE_URL` points at a different instance.

**The approval button never appears.** `DEMO_SHOW_APPROVAL_LINKS` is false, or the approval was created before you enabled it. Old tokens are not in the in-memory map.

---

## Cut

In this order: Part G replay, the Start-over button, the pool page's empty and 409 states (keep the happy path), Part C's idempotency (seed by hand once).
