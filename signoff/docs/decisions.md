# Decision log (ADRs)

Append-only. Format: **ID · Date · Status** — Context — Decision — Consequences. Supersede rather than rewrite.

---
**ADR-001 · 2026-10-04 · Accepted** — Idea locked: Signoff, an AI dispute agent that acts only within merchant-set limits (merges spending-limit layer + dispute helper). Alternatives and scoring in the handoff §2. Changing the idea requires the builder's approval.

**ADR-002 · 2026-10-06 · Accepted** — *The gate is the only path to mutation.* Enforced structurally: separate read/mutating PayPal clients, import-linter contract, frozen `GateDecision` type, allowlisted LLM tools. Consequence: slightly more plumbing; strong, testable safety story.

**ADR-003 · 2026-10-06 · Accepted** — Thin custom tool loop with schema-validated output, no heavy agent framework (per handoff). Consequence: more code we own; deterministic and easy to explain.

**ADR-004 · 2026-10-06 · Proposed** — Postgres-backed job queue (SKIP LOCKED). See `docs/architecture.md`.

**ADR-005 · 2026-10-06 · Open** — Web framework. Finding: the official boilerplate is a **Next.js** app (PayPal TS Server SDK, simple tables), not a Vite SPA, and does not touch disputes. Options: (a) fork the boilerplate and use Next as a thin client of the FastAPI API; (b) Vite + React SPA as a Render static site, taking only the AG Studio setup. Leaning (b) for fewer moving parts (no Node server), pending spike S11 (does AG Studio setup depend on Next?).

**ADR-006 · 2026-10-06 · Proposed** — Two separate agents: dispute agent (backend, plan-only) and Studio assistant (browser, read-only data tools, LLM via backend proxy). Neither can reach mutating PayPal calls other than through the gate.

**ADR-007 · 2026-10-06 · Open** — Charter semantics. `auto_offer_max` and `approval_required_above` are redundant; scenario C's "above the limit" is about dispute size. Proposal in `plan/03-gate-spec.md`. Decide before implementing G3.

**ADR-008 · 2026-10-07 · Accepted** — LLM provider: Proceed with Glimmer via an OpenAI-compatible interface per ADR-016. Thin client interface isolates provider details so fallback to standard OpenAI/Anthropic is seamless if needed.

**ADR-009 · 2026-10-06 · Proposed** — PayPal Agent Toolkit usage. Its dispute tools are list/get/accept-claim; accept concedes. Use the toolkit only for read tools (if Python auth works, spike S12) and credit it in "Tools used"; all mutating calls use our own client. Never hand `accept_dispute_claim` to an LLM.

**ADR-010 · 2026-10-06 · Accepted** — Fail closed by default (see CONVENTIONS §1).

**ADR-011 · 2026-10-07 · Accepted** — Open-source license: **MIT**. MIT is simpler than Apache-2.0 and sufficient for a hackathon project. License text is in `LICENSE` at the repo root, unmodified. GitHub About section will display it. Consequence: no explicit patent grant (acceptable for this context).

---
**ADR-012 · 2026-10-06 · Proposed** — Add a buyer-facing storefront and buyer portal (`shop/`) plus a product site and judge guide, so both sides of every scenario can be tested in a browser. Three hosts under one registrable domain (signoff, shop, api) so cookies stay same-site. Consequence: about 22 more hours; the cut list protects the core.

**ADR-013 · 2026-10-06 · Proposed** — A fixture-driven PayPal stub exists for tests and local development only. It is selectable only when the environment is local or test and the application refuses to start with it in production. Real-sandbox runs remain the `@live` rehearsal.

**ADR-014 · 2026-10-06 · Proposed** — Demo data is scoped by a demo session id so concurrent judges do not trample each other. This is not multi-tenancy: there is one merchant and one charter; reset hides a session's disputes and never deletes ledger rows.

**ADR-015 · 2026-10-07 · Accepted** — AG Grid / AG Studio licence for the hackathon. AG Grid staff confirmed in the PayPal Hackathon Discord that all AG products can be used without a licence for the hackathon; a watermark and console error will appear but will not be penalised during judging. Decision: proceed without a trial key. The watermark and console error are expected and accepted. Version is pinned in `package.json` for stability. V-08 and V-09 are closed. README known limits must mention the watermark.

**ADR-016 · 2026-10-07 · Accepted** — LLM provider for the dispute agent: Use Glimmer via OpenAI-compatible endpoint. Endpoint is confirmed reachable from Render without VPN. Provider configuration and authentication are passed exclusively through environment variables (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL`). No company or proprietary internal identifiers are stored in the repo. Per hackathon guidelines, any LLM is permitted as long as PayPal technologies and AI are meaningfully integrated. Thin abstraction layer allows hot-swapping providers if needed.
