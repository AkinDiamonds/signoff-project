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

**ADR-008 · 2026-10-06 · Open** — LLM provider and budget. Constraint: the Studio quick start targets the OpenAI Responses API; other providers need an adapter. Options: one OpenAI-compatible provider for both agents, or any provider for the dispute agent plus a thin adapter for Studio. Decide after V-07 prototype.

**ADR-009 · 2026-10-06 · Proposed** — PayPal Agent Toolkit usage. Its dispute tools are list/get/accept-claim; accept concedes. Use the toolkit only for read tools (if Python auth works, spike S12) and credit it in "Tools used"; all mutating calls use our own client. Never hand `accept_dispute_claim` to an LLM.

**ADR-010 · 2026-10-06 · Accepted** — Fail closed by default (see CONVENTIONS §1).

**ADR-011 · pending · Open** — Open source license (MIT or Apache-2.0). Apache-2.0 adds an explicit patent grant; MIT is simpler. Must be visible in the repo About section.
