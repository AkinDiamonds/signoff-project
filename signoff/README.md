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
| Agent: not-received disputes | Planned |
| Agent: second dispute reason | Planned |
| Append-only decision log | Planned |
| Approval page (mobile) | Planned |
| Dashboard (AG Studio) | Planned |
| Prompt-injection test suite | Planned |
| Test-dispute generator for judges | Planned |

## What is real vs simulated

| Piece | Real or simulated |
|---|---|
| PayPal disputes, webhooks, evidence, offers | **Real** — sandbox only (REST API, verified webhook events, provide-evidence calls). Dispute data from fixtures in `fixtures/paypal/`. |
| Storefront orders and carrier tracking | **Simulated** (mock store) — fictional products; no real carrier API. |
| Agent reasoning | **Real LLM** behind an OpenAI-compatible interface (ADR-008/ADR-016), with a labeled scenario cache and a daily budget cap. Cache hits are marked "cached reasoning" everywhere they appear. No provider key is configured locally yet, so the app reports cache-only mode until `LLM_API_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` are set. |

## Run it / try it

_Written after the Day-1 spike. Target: under 10 steps. Test credentials and "Generate test dispute" instructions go here._

## Tools used and how

_Maintained as tools are adopted. One line each: what it is, what it does here._

## Documentation

- `CONVENTIONS.md` — engineering rules
- `plan/` — plan, spike runbook, specs, risk register
- `docs/architecture.md`, `docs/decisions.md`, `docs/claims-ledger.md`, `docs/demo-script.md`

## Known limits

- **Sandbox only.** No production PayPal environment; all credentials are sandbox.
- **AG Studio watermark.** AG Grid / AG Studio displays a watermark and console error without a licence key. This is expected and accepted per ADR-015; the hackathon judging will not penalise it.
- **Buyer-assertion API.** The test-dispute generator creates disputes via sandbox UI rather than the `POST /v1/customer/disputes` buyer-assertion API (S4 partial). Labeled clearly in the demo script.
- **Scenario cache.** LLM calls for demo scenarios A–E may be served from a pre-populated cache to control cost. All cache hits are labeled in the UI and README.

## License

MIT — see `LICENSE`. Decision: `docs/decisions.md` ADR-011.
