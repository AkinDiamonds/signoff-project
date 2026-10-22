# Step 34 implementation plan (hand-off for Sonnet)

Read first: `34-e2e.md`, `../e2e-playwright.md`, `../../signoff/docs/demo-script.md`, `../../signoff/docs/decisions.md` (S8/S9 answers). Follow `simple-reliable-code`: smallest readable helpers, no framework.

## 0. Blockers found in the repo (resolve BEFORE writing specs)

The step's "files" list is `e2e/*`, config, CI only. The live stack cannot run these scenarios yet. Do 0.1 to 0.4 as a separate first commit (`feat(e2e): test seams for live stack`) and log it in the step's review log. Ask the user if any seam seems larger than described.

| # | Gap (evidence) | Minimal fix |
|---|---|---|
| 0.1 | `agent/app/worker.py` `main()` uses `create_default_registry()`: every job kind is a **no-op**. `register_sync_handlers` / `register_approval_handlers` are only used in tests; nothing handles `RUN_AGENT` or `EXECUTE_DECISION`. | Add `agent/app/queue/wiring.py` (or extend `registry.py`) with `build_registry()` that registers sync + approvals handlers plus two new thin handlers calling `run_agent_loop` (see `scripts/run_scenario.py:270-300`) and `execute_decision` (`:300-330`). Worker `main()` uses it. Add one pytest that a webhook produces ledger events through the real worker loop. |
| 0.2 | Server LLM is `build_llm_service(settings)`; with no key it has no provider. E2E needs deterministic plans per scenario, and a way to force failure. | Add `LLM_PROVIDER=fake` (settings + `build_provider`). A `FakeScenarioProvider` returns the plan JSON matching the dispute (plans already exist in `scripts/run_scenario.py` config; reuse/move them). Fault switch: env `FAKE_LLM_FAIL=true` OR plan lookup by `dispute_id` for the resilience dispute. Forbidden when `APP_ENV=prod` (same pattern as stub check in `settings.py`). |
| 0.3 | Approval raw token is only returned by `create_approval()` and stored hashed. No notification channel exists, so a browser test cannot reach `/approve/:token`. | Test-only seam: when `PAYPAL_ENV=stub` and `APP_ENV` is not prod, `create_approval` also appends the raw token to a `notifications` outbox (log table or in-memory list) readable at `GET /__test__/approval-links?dispute_id=` . Router mounted only under that guard. Document in ADR line + `claims-ledger` untouched (not a product claim). |
| 0.4 | Web and shop Playwright config runs with `VITE_MOCK_API=true` (mockFetch). Cross-app tests must hit the real agent. | New config (below) starts web and shop with `VITE_API_URL=http://localhost:8000` and **no** mock flag. Keep the existing mock-based config for per-step specs. |
| 0.5 | Stub auto-emits no webhooks when a dispute is created through the buyer client. | Tests call `POST /__stub__/webhooks` themselves (helper below). |

If 0.1 turns out already done on a branch the user has, skip it. Re-check with `grep -rn "register_sync_handlers" signoff/agent/app` first.

## 1. Layout (all under `signoff/e2e/`)

```
playwright.config.ts          # existing, mock-based per-step specs: leave unchanged, scope to specs/
playwright.cross.config.ts    # new: live-stack config, testDir ./cross
cross/
  global-setup.ts             # health-wait only (stack is started by make/CI, see 4)
  fixtures.ts                 # extended test: stub, agent, session, helpers
  helpers/stub.ts             # reset, faults, emit webhook, read state
  helpers/agent.ts            # typed calls: create scenario, poll dispute, timeline, approval link
  a-evidence.cross.spec.ts
  b-auto.cross.spec.ts
  c-approval.cross.spec.ts    # merchant-mobile project
  d-injection.cross.spec.ts
  e-repeat-disputer.cross.spec.ts
  resilience.cross.spec.ts
  security.cross.spec.ts      # tamper + XSS
```

Projects in `playwright.cross.config.ts`: `shop-desktop` (baseURL shop 5174), `merchant-desktop` (web 5173), `merchant-mobile` (`devices['Pixel 5']`). Each spec declares `test.use` or uses `testMatch` so only the right project runs it; scenarios that touch both apps open a second page via `browser.newContext({ baseURL })` instead of switching projects. Set `locale: 'en-US'`, `timezoneId: 'UTC'`, `trace: 'retain-on-failure'`, `retries: process.env.CI ? 1 : 0`, `workers: 1` (shared stub and DB; see 3). Reporter: `list` plus `html` in CI.

Types: import response types from `@signoff/api-client` (`paths`/schemas). No `any`, no `as` casts outside api-client (ESLint enforces). Parse unknown JSON with the existing Zod schemas or a narrow type guard.

## 2. Helpers (keep each under ~40 lines)

- `stub.reset()` -> `POST ${STUB_URL}/__stub__/reset`. `stub.faults({...})` -> `/__stub__/faults` (`duplicate_delivery`, `out_of_order`, `delivery_delay_seconds`, `fail_next_calls`). `stub.emit(disputeId, eventTypes, targetUrl?)` -> `/__stub__/webhooks`.
- `agent.session()` -> `POST /api/demo/reset` (no header) returns `session_id`; every test uses its own session and sends `X-Demo-Session` on its API calls and sets it in the page's storage the same way `web/src/features/demo/api.ts` does (read it to find the storage key; do not guess).
- `agent.createScenario(id, session)` -> `POST /api/demo/scenarios/{id}` with an `Idempotency-Key`; returns `dispute_id`.
- `agent.waitForDispute(id, predicate)` -> `expect.poll` on `GET /api/disputes/{id}` (timeout 30s, intervals `[250, 500, 1000]`). **Never `waitForTimeout`.**
- `agent.timeline(id)` -> `GET /api/disputes/{id}/timeline`; assert on `kind` values (`GATE_DECIDED`, `EXECUTION_CONFIRMED`, `INJECTION_FLAGGED`, `NO_ACTION`, `APPROVAL_REQUESTED`, `RUN_FAILED`) and rule ids.
- `agent.approvalLink(id)` -> the 0.3 seam.
- Seeding the pool (`scripts/seed_sandbox.py`) happens once in stack startup (section 4), not per test. Pool size is 3 per scenario by default, so a full run needs more: start the stack with `DEMO_POOL_SIZE_PER_SCENARIO=10` and `DEMO_SCENARIOS_PER_SESSION_PER_DAY` default.

## 3. Isolation and determinism (the flake rules)

1. `beforeEach`: `stub.reset()` then a fresh demo session. Stub reset restores fixtures and its tick-based clock, so ids and times are deterministic.
2. One worker (`workers: 1`) because stub state and the job queue are global. Do not enable `fullyParallel` for `cross/`.
3. Pooled orders are claimed with an atomic UPDATE and never reused; keep total scenario creations per run below pool size (10 per scenario). Scenario E needs **three** disputes from the same buyer: use buyer-portal flow or three `createScenario('E')` calls and assert the repeat-disputer rule (G5-01) on the third; verify in `charter` default threshold before choosing 3 (`/api/charter`).
4. Wait only on: `expect.poll` against API state, `page.waitForResponse` for a named URL, or web-first assertions (`expect(locator).toBeVisible()`). The UI polls (stale indicators exist), so after an API-confirmed state, assert the UI with the default expect timeout (raise to 15s globally for `cross/`).
5. Selectors: roles/labels first, then test ids that already exist: `decision-timeline`, `dispute-detail-id`, `approval-title`, `proposed-action-type`, `proposed-amount`, `evidence-strength-badge`, `untrusted-text-label`, `buyer-message-content`, `toggle-buyer-message-button`, `kpi-share-auto`, `kpi-open-disputes`, `demo-frozen-banner`, `portal-*`, `shop-*`. Do not add new ids unless missing; if you must, kebab-case `area-element`.
6. Failures leave traces: `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.
7. A flaky test is a bug. Never loop retries; quarantine only with a dated review-log entry and a STATUS ticket.

## 4. Stack startup (`make` + CI, not Playwright `webServer`, for the agent side)

Add real targets to the `Makefile` (replace the `e2e` / `rehearse` echo stubs):

- `e2e-stack`: start Postgres (`docker compose up -d postgres`), `alembic upgrade head`, `seed_sandbox`, then in background: PayPal stub (`make stub`, `STUB_AGENT_URL=http://localhost:8000`), agent (`uvicorn`, `PAYPAL_ENV=stub`, `PAYPAL_BASE_URL=http://localhost:4010`, `LLM_PROVIDER=fake`, `APP_ENV=test`, `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174`), worker with `--poll-interval 0.2`. Use a small `scripts/e2e_stack.py` (start, wait for `/readyz`, write PIDs, stop) so Windows and Linux behave the same; avoid shell `&` pipelines.
- `e2e`: `playwright test -c signoff/e2e/playwright.cross.config.ts --grep "@smoke|@full"` after `e2e-stack`.
- `e2e-smoke`: existing target keeps the mock-based smoke; add `e2e-cross-smoke` for `--grep @smoke` on the cross config.
- `rehearse`: `--grep @live` against the real sandbox (needs `.env`; fail fast with a clear message if absent).

Web and shop dev servers: `webServer` entries in the cross config with `env: { VITE_API_URL: 'http://localhost:8000' }` and no `VITE_MOCK_API`. The agent is **not** in `webServer`; the config's `globalSetup` only waits for `/readyz` and stub `/health` and throws a readable error telling the user to run `make e2e-stack`.

## 5. Scenarios (assert exactly this; rule ids come from the gate, copy them from the timeline, do not invent)

Tag every test `@full`. Tag one per scenario that is fast and stable `@smoke` (target: A, B, D, and the kill switch; total < 2 minutes).

**A: evidence (shop-desktop + merchant-desktop)**
1. Shop: demo order shortcut -> portal -> report "not received" (or `createScenario('A')` for speed in the smoke tag; the full tag drives the shop UI).
2. `stub.emit(dispute, ['CUSTOMER.DISPUTE.CREATED'])`.
3. `waitForDispute` until timeline has `EXECUTION_CONFIRMED`.
4. Merchant detail page `/app/disputes/:id`: `decision-timeline` shows the Allow verdict and evidence step; `evidence-strength-badge` visible; state text matches S8 (resolved vs "recorded outcome"; read `docs/decisions.md` and assert only the documented one).
5. Stub state (`/__stub__/state`) has evidence for that dispute exactly once.

**B: small auto-handled**: capture KPIs before (`GET /api/kpis`); run B; after confirmation assert no approval exists, timeline has no `APPROVAL_REQUESTED`, dashboard `kpi-share-auto` / counts changed vs before (assert direction, not exact floats), and the disputes table row is present.

**C: approval on phone (merchant-mobile)**: run C; assert timeline `APPROVAL_REQUESTED` and detail page shows the needs-approval chip; open `agent.approvalLink` in the mobile context; assert `approval-title`, `proposed-action-type` is an offer, edit amount via `edit-amount-input` to a partial value, tap approve; assert page shows resolved state; assert timeline `APPROVAL_RESOLVED` then `EXECUTION_CONFIRMED`; stub state has the offer. If S9 says buyer acceptance is not possible, end at "offer made"; if possible, use the portal `portal-offer-card` accept path. Also assert the tap targets are usable on touch (`tap()`, not `click()`), and a second open of the same link shows the uniform not-found page (single use).

**D: hostile reply**: buyer replies via portal (`portal-reply-textarea`) with the injection text. Assert no mutating call reached the stub after the reply (compare `/__stub__/state` counts before/after), timeline has `INJECTION_FLAGGED` with a rule id, detail page shows `untrusted-text-label` and the message as plain text.

**E: repeat disputer**: three scenarios for the same buyer email; on the third assert `APPROVAL_REQUESTED` with rule `G5-01` and that no auto-execution happened; approval page opens and shows the flag.

**Resilience (`resilience.cross.spec.ts`)**
- Duplicate webhook: `stub.faults({duplicate_delivery:true})`, emit once; assert exactly one agent run (count `RUN_STARTED` in timeline == 1) and one `webhook_events` row visible via timeline `WEBHOOK_RECEIVED` deduped.
- Delayed webhook caught by poller: `faults({delivery_delay_seconds: N})` or simply create the dispute and never emit; the reconcile job (start worker with a short reconcile interval via env, or enqueue `RECONCILE` through a test seam) must pick it up; assert `DISPUTE_SYNCED` appears with no `WEBHOOK_RECEIVED` before it. If reconcile is not scheduled periodically anywhere, add that scheduling in 0.1 and note it.
- LLM failure -> approval fallback: dispute id or env switch from 0.2 makes the provider fail; assert `RUN_FAILED` or the fallback approval per the loop's behavior (read `agent/app/agent/loop.py` failure branch first), and that the detail page shows the approval fallback text, with no execution.
- Kill switch: restart is expensive, so use a per-test agent started with `DEMO_FROZEN=true` OR a test seam that flips `app.state.settings.demo_frozen` (settings are frozen, so prefer a second agent process on port 8001 + a web server pointed at it, only for this one test, tagged `@smoke`). Assert `POST /api/demo/scenarios/A` returns the `FROZEN` error envelope and `demo-frozen-banner` shows on `/app/demo`; charter edit also blocked.

**Security (`security.cross.spec.ts`)**
- Tamper: in shop cart route-intercept `POST /api/shop/orders`, add a `price`/`amount` field to the body; assert the created order total equals the catalog price (`shop-order-details`).
- XSS: send `<img src=x onerror=window.__xss=1>` as the dispute message; open detail and approval pages; assert `window.__xss` is undefined and the text is visible literally.

**Accessibility**: one axe scan (`@axe-core/playwright`, already a dev dep) per page type reached here is already covered by earlier specs; do not duplicate.

## 6. CI

Add `.github/workflows/e2e.yml` (do not edit `ci.yml` beyond nothing): jobs `smoke` on `pull_request` (`make e2e-stack && make e2e-cross-smoke`, 2-minute budget) and `full` on `push` to main + nightly cron. Both: Postgres service, `npx playwright install --with-deps chromium`, upload `playwright-report` and `test-results` on failure. `@live` never runs in CI.

## 7. Order of work (commit at each arrow)

1. Blockers 0.1-0.4 + their pytest -> `make test-agent` green.
2. `e2e_stack.py`, Makefile targets, cross config, global setup, helpers; one trivial spec proving stack health -> commit.
3. A and B -> run twice. 4. D and E -> run. 5. C (mobile). 6. Resilience. 7. Security. 8. CI. Run the whole suite **three times in a row** (`for i in 1 2 3`), all green, then time `@smoke` (< 120 s).
9. Close-out per `34-e2e.md`: `make check` (R1), update `plan/STATUS.md`, README status table, claims ledger/ADRs if S8/S9 wording changed, fill the review log, commit `test(e2e): full two-sided scenarios and resilience`.

## 8. Pitfalls for the implementer

- Do not modify existing mock-based specs or `playwright.config.ts` behavior; `make e2e-smoke` and per-step suites must still pass (re-run them).
- Never `waitForTimeout`; never raise retries to hide a flake; never edit an expected rule id to make a test pass (per `demo-script.md`), fix the cause.
- Pool exhaustion (`POOL_EMPTY` 409) looks like a flaky test: size the pool, and make stack start idempotent.
- The demo session id must be passed on both API helper calls and in the page, or the merchant UI will filter out the dispute ("mine" scope vs `scope-all-button`).
- Webhook ids must not repeat across tests unless the test is the duplicate test; stub reset restarts its event sequence, so also clear/replace the agent DB between runs (`make e2e-stack` recreates the schema) or use fresh demo sessions plus unique dispute ids from `createScenario`.
- Keep failing-output small when debugging: run one spec with `--reporter=line`, read the trace only for the failing test.
