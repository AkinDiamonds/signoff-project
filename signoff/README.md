# Signoff

> A dispute clerk that never sleeps and only signs what you have authorized.

Signoff is an AI agent that handles PayPal disputes for small online merchants **inside limits the merchant sets** (the *Authority Charter*). The agent only *proposes*. A deterministic gate checks every proposal against the charter and PayPal's own allowed options, and only the gate's executor can call PayPal's mutating endpoints.

Built for the PayPal AI Hackathon. **Sandbox only. Fictional data only.**

## Status

**Pre-spike. Nothing below is built yet.** A row flips to `Working` only when `docs/claims-ledger.md` links proof (a passing test or a recorded demo step).

| Capability | Status |
|---|---|
| Webhook receiver (verify, dedupe, queue) | Planned |
| PayPal client (read + mutating, separated) | Planned |
| Authority Charter + gate | Planned |
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
| PayPal disputes, webhooks, evidence, offers | _fill in after spike_ |
| Storefront orders and carrier tracking | Simulated (mock store) |
| Agent reasoning | _real LLM / labeled cache — fill in_ |

## Run it / try it

_Written after the Day-1 spike. Target: under 10 steps. Test credentials and "Generate test dispute" instructions go here._

## Tools used and how

_Maintained as tools are adopted. One line each: what it is, what it does here._

## Documentation

- `CONVENTIONS.md` — engineering rules
- `plan/` — plan, spike runbook, specs, risk register
- `docs/architecture.md`, `docs/decisions.md`, `docs/claims-ledger.md`, `docs/demo-script.md`

## Known limits

_Honest list, maintained as discovered._

## License

_MIT or Apache-2.0 — decision in `docs/decisions.md` (ADR-011)._
