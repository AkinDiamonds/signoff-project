# Decision log (ADRs)

Append-only. Format: **ID · Date · Status** — Context — Decision — Consequences. Supersede rather than rewrite.

---
**ADR-001 · 2026-10-04 · Accepted** — Idea locked: Signoff, an AI dispute agent that acts only within merchant-set limits (merges spending-limit layer + dispute helper). Alternatives and scoring in the handoff §2. Changing the idea requires the builder's approval.

**ADR-002 · 2026-10-06 · Accepted** — *The gate is the only path to mutation.* Enforced structurally: separate read/mutating PayPal clients, import-linter contract, frozen `GateDecision` type, allowlisted LLM tools. Consequence: slightly more plumbing; strong, testable safety story.

**ADR-003 · 2026-10-06 · Accepted** — Thin custom tool loop with schema-validated output, no heavy agent framework (per handoff). Consequence: more code we own; deterministic and easy to explain.

**ADR-004 · 2026-10-08 · Accepted** — Postgres-backed job queue (`SKIP LOCKED`). Consequence: no Redis or extra infrastructure needed; database transactions cleanly bridge webhook ingestion, dispute synchronization, and audit ledger events; leases evaluated using database server time prevent clock drift issues across workers.

**ADR-005 · 2026-10-06 · Open** — Web framework. Finding: the official boilerplate is a **Next.js** app (PayPal TS Server SDK, simple tables), not a Vite SPA, and does not touch disputes. Options: (a) fork the boilerplate and use Next as a thin client of the FastAPI API; (b) Vite + React SPA as a Render static site, taking only the AG Studio setup. Leaning (b) for fewer moving parts (no Node server), pending spike S11 (does AG Studio setup depend on Next?).

**ADR-006 · 2026-10-06 · Proposed** — Two separate agents: dispute agent (backend, plan-only) and Studio assistant (browser, read-only data tools, LLM via backend proxy). Neither can reach mutating PayPal calls other than through the gate.

**ADR-007 · 2026-10-06 · Accepted** — Charter semantics. Separate limits for money conceded (`auto_offer_max`, `auto_accept_max`) and maximum dispute size handled autonomously (`auto_act_max_dispute_amount`). Redundant `approval_required_above` dropped. Standing flags (`auto_provide_evidence`, `auto_send_message`), restricted lists (`never_auto_reasons`, `never_auto_actions`), and `repeat_disputer_threshold` complete the versioned model. Changes are append-only with optimistic concurrency control (`base_version`).

**ADR-008 · 2026-10-07 · Accepted** — LLM provider: Proceed with Glimmer via an OpenAI-compatible interface per ADR-016. Thin client interface isolates provider details so fallback to standard OpenAI/Anthropic is seamless if needed.

**ADR-009 · 2026-10-06 · Proposed** — PayPal Agent Toolkit usage. Its dispute tools are list/get/accept-claim; accept concedes. Use the toolkit only for read tools (if Python auth works, spike S12) and credit it in "Tools used"; all mutating calls use our own client. Never hand `accept_dispute_claim` to an LLM.

**ADR-010 · 2026-10-06 · Accepted** — Fail closed by default (see CONVENTIONS §1).

**ADR-011 · 2026-10-07 · Accepted** — Open-source license: **MIT**. MIT is simpler than Apache-2.0 and sufficient for a hackathon project. License text is in `LICENSE` at the repo root, unmodified. GitHub About section will display it. Consequence: no explicit patent grant (acceptable for this context).

---
**ADR-012 · 2026-10-06 · Proposed** — Add a buyer-facing storefront and buyer portal (`shop/`) plus a product site and judge guide, so both sides of every scenario can be tested in a browser. Three hosts under one registrable domain (signoff, shop, api) so cookies stay same-site. Consequence: about 22 more hours; the cut list protects the core.

**ADR-013 · 2026-10-06 · Accepted** — A fixture-driven PayPal stub exists for tests and local development only. It is selectable only when the environment is local or test and the application refuses to start with it in production. Real-sandbox runs remain the `@live` rehearsal. Implemented in `scripts/paypal_stub/` (2026-10-21): fixture replay, deterministic ids/time, mutating state transitions, webhook emitter with duplicate/out-of-order/delay/failure/latency faults, and a test-only reset endpoint. `make dev PAYPAL_ENV=stub` starts the stub and agent together.

**ADR-014 · 2026-10-06 · Accepted** — Demo data is scoped by a demo session id so concurrent judges do not trample each other. This is not multi-tenancy: there is one merchant and one charter; reset hides a session's disputes and never deletes ledger rows. Implemented in `agent/app/simulator/` (header `X-Demo-Session`, pooled orders claimed atomically, inactive sessions hide their rows).

**ADR-015 · 2026-10-07 · Accepted** — AG Grid / AG Studio licence for the hackathon. AG Grid staff confirmed in the PayPal Hackathon Discord that all AG products can be used without a licence for the hackathon; a watermark and console error will appear but will not be penalised during judging. Decision: proceed without a trial key. The watermark and console error are expected and accepted. Version is pinned in `package.json` for stability. V-08 and V-09 are closed. README known limits must mention the watermark.

**ADR-016 · 2026-10-07 · Accepted** — LLM provider for the dispute agent: Use Glimmer via OpenAI-compatible endpoint. Endpoint is confirmed reachable from Render without VPN. Provider configuration and authentication are passed exclusively through environment variables (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL`). No company or proprietary internal identifiers are stored in the repo. Per hackathon guidelines, any LLM is permitted as long as PayPal technologies and AI are meaningfully integrated. Thin abstraction layer allows hot-swapping providers if needed.

**ADR-017 · 2026-10-21 · Accepted** — Web shell dependencies: `@tanstack/react-query` ^5 (server state, supports React 18), `react-router` ^7 (routes; v8 requires React 19 and is not used), `@playwright/test` and `@axe-core/playwright` (smoke and accessibility checks, dev only). The mock API uses the existing `fetch` injection in `createApiClient` instead of MSW, to avoid another dependency. Consequence: the mock is enabled only by `VITE_MOCK_API` and throws in production builds.

**ADR-018 · 2026-10-22 · Accepted** — Test seam for approval notification links in non-production stub environments. Production approvals store only hashed tokens with no raw tokens exposed or external notification channels configured. In non-production environments with `PAYPAL_ENV=stub`, `create_approval()` mirrors raw tokens into a test outbox readable at `GET /__test__/approval-links?dispute_id=` to enable cross-app end-to-end tests to navigate to approval screens. The test router is excluded in production (`APP_ENV=prod`) and when connected to live PayPal sandbox.

**ADR-019 · 2026-10-31 · Accepted** — Owner-confirmed release scope: normal single-merchant product, minimal owner email/password access without signup/email/recovery, automatic simulated shipment events plus labeled manual sandbox advancement, merchant-configurable missing-delivery behavior defaulting to human review, autonomous valid actions within signing limits, and Android Chrome as primary phone validation target. See `build-plan/v3/02-owner-decisions.md`. No authorization to weaken executor/gate boundaries or present simulated logistics as verified carrier data.

**ADR-020 · 2026-10-31 · Accepted** — Reproducible verification: declare mypy (MIT) and import-linter (BSD-2-Clause) as development dependencies because conventions already require them; use the existing uv tool for Python resolution and Node 24.19.0 for lockfile compatibility. Pytest clears all application settings aliases before imports, ignores developer dotenv files, and permits only an explicitly named local disposable test DB. Direct forbidden-import contracts use the top-level `agent` package; indirect imports through authorized services remain permitted, with direct architecture guard tests retained. No runtime dependency or financial policy change.

**ADR-021 · 2026-10-31 · Implemented; browser verification open** — Minimal single-owner access uses a server-configured email and scrypt credential (N=16384, r=8, p=5, random 16-byte salt), opaque eight-hour HttpOnly cookies, hashed sessions/rate limits in PostgreSQL, and purpose-separated HMAC CSRF/credential tags derived from the existing approval secret. No signup, email service or recovery. Production cannot disable authentication; unprovisioned owner access fails closed. Production cookies request Secure/SameSite=None/Partitioned to support separate Render sites on Android Chrome; real browser attribute verification remains unresolved and is a release gate. See OWNER-ACCESS.md and the T02 execution log. Readiness distinguishes configured values from observed checks, webhook receipts and worker heartbeats. No new runtime dependency, financial authority or gate semantics.
