# Signoff

> A dispute clerk that never sleeps and only signs what you have authorized.

Signoff is an AI agent that handles PayPal disputes for small online merchants **inside limits the merchant sets** (the *Authority Charter*). The agent only *proposes*. A deterministic gate checks every proposal against the charter and PayPal's own allowed options, and only the gate's executor can call PayPal's mutating endpoints.

Built for the PayPal AI Hackathon. **Sandbox only. Fictional data only.**

## Status

**Pre-spike. Nothing below is built yet.** A row flips to `Working` only when `docs/claims-ledger.md` links proof (a passing test or a recorded demo step).

| Capability | Status |
|---|---|
| Webhook receiver (verify, dedupe, queue) | Planned |
| PayPal client (read + mutating, separated) | Partial (read-only client complete) |
| Authority Charter + gate | Partial (charter versioned; pure gate complete with rules G0-G7, approval waiver and golden replay; executor next) |
| Agent: not-received disputes | Working (scenarios A and B end to end; evidence, gate, execute, ledger) |
| Agent: second dispute reason | Working (`MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` receipt evidence; unknown reasons stop for human review) |
| Append-only decision log | Planned |
| Approval page (mobile) | Working (mobile-first approve/deny/edit with distinct outcomes) |
| Charter editor | Working (versioned limits, field validation, conflict screen, history) |
| Demo panel | Working (scenarios A-E, pool status, session reset, frozen/quota/cached labels) |
| Dashboard (AG Studio) | Working (live KPIs, dispute table, lazy AG Studio workspace, read-only assistant via server proxy) |
| Custom dashboard widgets | Working (Decision Timeline, Deadline Radar, Authority Meter; empty/single/many states; accessible text labels) |
| Prompt-injection test suite | Planned |
| Test-dispute generator for judges | Working (pool, scenarios A-E, session scoping, quotas, reset) |
| Deterministic PayPal stub (tests/local) | Working (fixture replay, fault injection, reset) |

## What is real vs simulated

| Piece | Real or simulated |
|---|---|
| PayPal disputes, webhooks, evidence, offers | **Real** — sandbox only (REST API, verified webhook events, provide-evidence calls). Dispute data from fixtures in `fixtures/paypal/`. |
| Storefront orders and carrier tracking | **Simulated** (mock store) — fictional products; no real carrier API. |
| Agent reasoning | **Real LLM** behind an OpenAI-compatible interface (ADR-008/ADR-016), with a labeled scenario cache and a daily budget cap. Cache hits are marked "cached reasoning" everywhere they appear. No provider key is configured locally yet, so the app reports cache-only mode until `LLM_API_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` are set. |

## Run it / try it

_Written after the Day-1 spike. Target: under 10 steps. Test credentials and "Generate test dispute" instructions go here._

## Tools used and how

- **AG Studio 3.0.0** (`ag-studio`, `ag-studio-react`): merchant dashboard workspace over live KPI and dispute data. No licence key; the expected watermark/console warning is documented in Known limits (ADR-015).
- **FastAPI + SQLAlchemy + Alembic**: agent API, PostgreSQL models and forward-only migrations.
- **PayPal REST APIs (sandbox)**: disputes, evidence, offers and webhooks; all mutating calls go through the executor.
- **OpenAI-compatible LLM provider**: dispute planning and the read-only dashboard assistant, both behind server-side proxies.

## Documentation

- `CONVENTIONS.md` — engineering rules
- `plan/` — plan, spike runbook, specs, risk register
- `docs/architecture.md`, `docs/decisions.md`, `docs/claims-ledger.md`, `docs/demo-script.md`

## Known limits

- **Sandbox only.** No production PayPal environment; all credentials are sandbox.
- **AG Studio watermark.** AG Grid / AG Studio displays a watermark and console error without a licence key. This is expected and accepted per ADR-015; the hackathon judging will not penalise it.
- **Buyer-assertion API.** The test-dispute generator uses the `POST /v1/customer/disputes` buyer-assertion client. Sandbox availability of the buyer assertion is still partial (S4), so the live rehearsal verifies it before recording; if PayPal rejects the assertion in a given sandbox, create the dispute from the sandbox UI and label it in the demo.
- **Scenario cache.** LLM calls for demo scenarios A–E may be served from a pre-populated cache to control cost. All cache hits are labeled in the UI and README.

## License

MIT — see `LICENSE`. Decision: `docs/decisions.md` ADR-011.
