# Signoff

> A dispute clerk that never sleeps and only signs what you have authorized.

Signoff is an AI agent that handles PayPal disputes for small online merchants **inside limits the merchant sets** (the *Authority Charter*). The agent only *proposes*. A deterministic gate checks every proposal against the charter and PayPal's own allowed options, and only the gate's executor can call PayPal's mutating endpoints.

Built for the PayPal AI Hackathon. **Sandbox only. Fictional data only.**

## Status

**Built and working end to end against the PayPal stub.** A row reads `Working` only when `docs/claims-ledger.md` links proof (a passing test or a recorded demo step). The live sandbox path is documented in `docs/real-mode.md`.

| Capability | Status |
|---|---|
| Webhook receiver (verify, dedupe, queue) | Working (signature verification, transactional dedupe, leased job queue, 512 KB cap) |
| PayPal client (read + mutating, separated) | Working (read-only client plus a mutating client that only `app/executor` may import, enforced by an import-linter contract) |
| Authority Charter + gate | Working (versioned charter, pure gate with rules G0-G7, approval waiver, golden replay, write-ahead executor) |
| Agent: not-received disputes | Working (scenarios A and B end to end; evidence, gate, execute, ledger) |
| Agent: second dispute reason | Working (`MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` receipt evidence; unknown reasons stop for human review) |
| Append-only decision log | Working (append-only decisions and ledger events, cursor pagination, replay script) |
| Approval page (mobile) | Working (mobile-first approve/deny/edit with distinct outcomes) |
| Charter editor | Working (versioned limits, field validation, conflict screen, history) |
| Demo panel | Working (scenarios A-E, pool status, session reset, frozen/quota/cached labels) |
| Dashboard (AG Studio) | Working (live KPIs, dispute table, lazy AG Studio workspace, read-only assistant via server proxy) |
| Custom dashboard widgets | Working (Decision Timeline, Deadline Radar, Authority Meter; empty/single/many states; accessible text labels) |
| Storefront & buyer portal | Working (catalog, sandbox cart/checkout, demo orders, tracking, dispute reporting) |
| Product landing & judge guide | Working (5-minute path, test credentials, real-vs-simulated table, view switcher, claims ledger) |
| Cross-app end-to-end suite | Working (Playwright scenarios A-E, resilience and security against the live stub stack; `make e2e-stack && make e2e`) |
| Prompt-injection test suite | Working (screener plus hostile/benign corpora; the blocked action is logged with its rule id) |
| Test-dispute generator for judges | Working (pool, scenarios A-E, session scoping, quotas, reset) |
| Deterministic PayPal stub (tests/local) | Working (fixture replay, fault injection, reset) |

## What is real vs simulated

| Piece | Real or simulated |
|---|---|
| PayPal disputes, webhooks, evidence, offers | **Real** — sandbox only (REST API, verified webhook events, provide-evidence calls). Dispute data from fixtures in `fixtures/paypal/`. |
| Storefront orders and carrier tracking | **Simulated** (mock store) — fictional products; no real carrier API. |
| Agent reasoning | **Real LLM** behind an OpenAI-compatible interface (ADR-008/ADR-016), with a labeled scenario cache and a daily budget cap. Cache hits are marked "cached reasoning" everywhere they appear. No provider key is configured locally yet, so the app reports cache-only mode until `LLM_API_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` are set. |

## Run it / try it

### Everything in Docker (recommended)

Prerequisites: Docker Desktop with Compose v2, and free host ports `5173`, `5174`, `5175`, `8000`, `8001`, `4010` and `5432`.

1. Build and start the whole stack:

   ```bash
   docker compose up --build -d
   ```

   The first build takes a few minutes. `docker compose ps -a` should show `postgres`, `stub`, `agent`, `frozen-agent`, `worker`, `web`, `frozen-web` and `shop` running; `migrate` exits `0` after applying migrations and seeding the demo pool.

2. Open the apps:

   | Service | URL |
   | --- | --- |
   | Merchant web | http://localhost:5173 |
   | Shop | http://localhost:5174 |
   | Frozen merchant web (kill switch) | http://localhost:5175 |
   | Agent API | http://localhost:8000 |
   | Frozen agent API | http://localhost:8001 |
   | PayPal stub | http://localhost:4010 |
   | PostgreSQL | localhost:5432 |

3. Try a scenario: open http://localhost:5173/app/demo, click **Run scenario A**, wait for the dispute, then open it. The worker reconciles every 5 seconds, so the timeline fills in without any manual webhook.

4. Logs and shutdown:

   ```bash
   docker compose logs -f agent worker
   docker compose down          # keeps the database volume
   docker compose down -v       # deletes it; reseeds on the next up
   ```

Notes:

- Stop `make dev` and `make e2e-stack` first; they use the same ports.
- Use `localhost`, not `127.0.0.1`, so the browser origin matches `ALLOWED_ORIGINS`.
- The containers run with `APP_ENV=test`, the PayPal stub and the fake LLM. No live credentials are used.
- Frontend API URLs are baked at build time. To change a hostname or port, rebuild with new `VITE_API_URL`/`PUBLIC_*` build args.

### Local development (no app containers)

```bash
docker compose up -d postgres
make dev PAYPAL_ENV=stub
```

Run the cross-app suite with `make e2e-stack && make e2e`.

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

- **AG Studio grid widget.** The Studio grid renders no rows in this build. The value widgets and the plain dispute table carry the same data. Decision recorded in build-plan/v2/decision-log.md.
- **AG Studio icons.** Some Studio panel icons render as empty squares without a licence key. This is cosmetic and does not affect the data.

- **Sandbox only.** No production PayPal environment; all credentials are sandbox.
- **AG Studio watermark.** AG Grid / AG Studio displays a watermark and console error without a licence key. This is expected and accepted per ADR-015; the hackathon judging will not penalise it.
- **Buyer-assertion API.** The test-dispute generator uses the `POST /v1/customer/disputes` buyer-assertion client. Sandbox availability of the buyer assertion is still partial (S4), so the live rehearsal verifies it before recording; if PayPal rejects the assertion in a given sandbox, create the dispute from the sandbox UI and label it in the demo.
- **Scenario cache.** LLM calls for demo scenarios A–E may be served from a pre-populated cache to control cost. All cache hits are labeled in the UI and README.

## License

MIT — see `LICENSE`. Decision: `docs/decisions.md` ADR-011.
