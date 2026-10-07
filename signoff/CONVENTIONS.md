# CONVENTIONS

Rules for everyone who touches this repo: me and any AI coding assistant. Where speed and a rule conflict, the rule wins for the **gate, executor, ledger and README claims**; speed wins everywhere else.

## 1. Principles
1. **Fail closed.** Unknown, error, timeout or ambiguity → `NEEDS_APPROVAL` or no action. Never `ALLOW` by default.
2. **One door.** Only `app/executor` calls mutating PayPal endpoints. The LLM, API routes and UI cannot.
3. **Deterministic where it matters.** Gate, charter and ledger are pure, boring code. The LLM only proposes.
4. **Evidence over claims.** Nothing appears in README, Devpost or video unless `docs/claims-ledger.md` links proof.
5. **Always keep a vertical slice alive.** webhook → plan → gate → executor → ledger → dashboard works end-to-end, crudely, from week 2 onward.
6. **Plan, then code.** Non-trivial work starts from a `plan/` item or an ADR in `docs/decisions.md`.
7. **Boring tech.** A new dependency needs a one-line ADR (why, alternatives, license).

## 2. Workflow (solo, still disciplined)
- Trunk-based: `main` always deploys. Short-lived branches `feat/…`, `fix/…`, `docs/…`; squash-merge via PR even when alone (the PR checklist is the review).
- Conventional commits: `feat(gate): …`, `fix(webhook): …`, `docs(adr): …`.
- Session ritual: **start** by reading `plan/STATUS.md`; **end** by updating it (done, next 3, blockers) and the README/ADR if anything changed.
- CI must be green to merge: ruff, mypy --strict, pytest, import-linter, eslint, tsc, vitest, gitleaks, generated-API-types-up-to-date check.

## 3. Definition of Done (every PR)
- [ ] Behavior covered by tests (gate: every rule has an allow/deny/boundary test).
- [ ] Failure paths handled and tested (timeout, invalid input, duplicate).
- [ ] No secrets, no real personal data; `.env.example` updated if config changed.
- [ ] Logs are structured and carry `dispute_id` / `run_id`.
- [ ] README status and `docs/claims-ledger.md` updated if a capability changed.
- [ ] ADR added if a non-obvious decision was made.
- [ ] `plan/STATUS.md` updated.

## 4. Architecture boundaries (enforced by tests, not goodwill)
- `app/paypal/read_client.py` — GET only. Importable anywhere.
- `app/paypal/mutating_client.py` — importable **only** from `app/executor/`. Enforced by `import-linter` contract in CI.
- LLM tool registry is an explicit allowlist of read-only tool names. A test fails if any tool name maps to a mutating method.
- The executor accepts only a `GateDecision` (frozen model, constructed only inside `app/policy/gate.py`) with `verdict=ALLOW`, and re-validates against a freshly fetched dispute before calling PayPal.
- The AG Studio assistant (browser) has **read-only data tools**. It never receives dispute-agent tools.
- The PayPal Agent Toolkit's `accept_dispute_claim` concedes the dispute. It is never given to an LLM.

## 5. Python (agent/)
- Python 3.12 pinned (`.python-version`; toolkit needs ≥3.11). Lockfile committed (uv or pip-tools).
- FastAPI, httpx (async, explicit timeouts), pydantic v2, SQLAlchemy 2 + Alembic, structlog (JSON), pytest, pytest-asyncio, hypothesis, respx.
- `mypy --strict`; `ruff` (lint + format). No `Any` without a comment.
- **Money is `Decimal`**, never float. Currency is always carried with the amount; mismatch → deny.
- Datetimes are timezone-aware UTC. The gate takes `now` as a parameter (no hidden clock).
- Pydantic models at every boundary (webhook payloads, PayPal responses we rely on, LLM output). Unknown fields from PayPal are tolerated; missing required fields fail closed.
- Migrations are forward-only Alembic revisions. No manual DB edits, including in the hosted demo.

## 6. TypeScript (web/)
- `strict` TS, no `any`, no non-null `!` without a comment. ESLint + Prettier.
- API client generated from the FastAPI OpenAPI spec (`openapi-typescript` + `openapi-fetch`). Generated file is committed; CI fails if stale.
- TanStack Query for server state. Every data view implements **loading, empty, error** states.
- Vitest + Testing Library for components; Playwright for one smoke test of the demo path.
- Verdict colors always paired with an icon and label (color is never the only signal).
- Pin AG Studio to the exact version in `package.json`; do not upgrade after a licence key is issued (keys are tied to release dates).

## 7. PayPal integration
- Sandbox only. `PAYPAL_ENV=sandbox` is asserted at startup; the live base URL is not present in code.
- Every PayPal call: timeout, bounded retries with jitter on 5xx/429/network for **GET** only; mutating calls never auto-retry blindly — they follow the write-ahead protocol in `plan/05-resilience.md`.
- Log the PayPal debug id from every response. Never log tokens or full payloads containing buyer messages at INFO.
- Cache the OAuth token with an expiry margin; refresh once on 401, then fail.
- Every response shape we depend on has a recorded, scrubbed fixture in `fixtures/paypal/` and a test against it.
- Don't invent fields. If it isn't in a fixture or `schema.yaml`, it doesn't exist.

## 8. LLM
- Provider behind a thin interface; model name from config. Temperature 0 where the provider allows.
- Output is schema-validated; invalid output → one repair attempt → then fail closed to approval.
- Buyer messages and any PayPal free text are **untrusted data**: passed in a separate quoted field, never in the system prompt, never allowed to alter tool availability.
- Prompts are versioned (`PROMPT_VERSION`) and recorded in `agent_runs`.
- Scenario cache is allowed for demo cost control and is always labeled "cached reasoning" in the UI and README.
- Daily spend cap enforced in code (`LLM_DAILY_BUDGET_USD`); over cap → cache or approval, never silent failure.

## 9. Security
- Secrets only in environment variables; `.env` git-ignored; gitleaks in pre-commit and CI.
- Webhook signature verified before any processing; failures are logged and dropped.
- Strict CORS allowlist; rate limits on demo endpoints; `DEMO_FROZEN=true` kill switch.
- Approval links are single-use, expiring, and bound to a payload hash.
- Fictional data only. No real buyer/seller PII anywhere.

## 10. Docs discipline
- **README**: status table reflects reality. If it isn't working, it says `Planned` or `Partial`.
- **docs/decisions.md**: append-only ADRs (date, status, context, decision, consequences). Supersede, don't rewrite.
- **docs/claims-ledger.md**: every public claim → proof link. Review before submission.
- **plan/07-verify-register.md**: nothing marked VERIFY is relied on until its row is closed with a source and date.
- **plan/STATUS.md**: updated at the end of every working session.

## 11. Testing expectations
- Gate: 100% branch coverage + property tests. Executor: crash/retry simulations. Webhook: duplicate, replay, bad signature, out-of-order.
- Injection suite (`agent/tests/injection/`): adversarial buyer messages; assertion is that **no mutating call occurs** and a rule_id is logged.
- Nightly (or manual before demos) **demo rehearsal**: runs scenarios A–E against the sandbox and fails loudly if any outcome differs from `docs/demo-script.md`.

## 12. Naming
- Rule IDs: `G<step>-<nn>` (e.g. `G3-02`). Never reuse or renumber; deprecate instead.
- Verdicts: `ALLOW | NEEDS_APPROVAL | DENY`. Evidence score is called **evidence strength**, never "win probability".
