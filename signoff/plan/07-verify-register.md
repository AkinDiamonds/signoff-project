# VERIFY register

Status: **OPEN** (not checked) · **DOCS-CONFIRMED** (read in official docs, not yet exercised) · **PROVEN** (exercised in sandbox, fixture saved) · **REFUTED**.
Rule: do not depend on an OPEN item. "DOCS-CONFIRMED on 2026-10-06" means a docs page or search snippet was read; re-read the page when you implement.

| ID | Item | Status | Source / how to close | Blocks |
|---|---|---|---|---|
| V-01 | Disputes API has no PayPal SDK (use REST) | DOCS-CONFIRMED 2026-10-06 | API reference note "not currently supported by our SDK" | client design |
| V-02 | Buyer-side dispute creation needs buyer consent via Log in with PayPal (scope `.../disputes/create`) and a JWT in `PayPal-Auth-Assertion` | DOCS-CONFIRMED 2026-10-06 (steps unrun) | Disputes integration guide, docs.paypal.ai disputes set-up; prove in spike S4-S5 | everything |
| V-03 | Agent Toolkit dispute tools are only list, get, accept-claim (accept = buyer wins) | DOCS-CONFIRMED 2026-10-06 | PyPI page, developer.paypal.com agent-tools | build vs reuse |
| V-04 | Toolkit Python version/auth handling (PyPI showed 1.4.1 on one page; latest unknown) | OPEN | spike S12 | ADR-009 |
| V-05 | Boilerplate is a **Next.js** app using the PayPal TypeScript Server SDK, with transactions / subscriptions / balances pages; no disputes | DOCS-CONFIRMED 2026-10-06 (repo README) | spike S11 | ADR-005 |
| V-06 | Boilerplate actually wires AG Studio (README describes "simple tables"); versions used | OPEN | read `package.json`, `app/` | ADR-005 |
| V-07 | Studio agent framework: custom agents/tools/adapter exist (React docs v3). Quick start uses OpenAI Responses; non-OpenAI provider needs an adapter | DOCS-CONFIRMED 2026-10-06 (feature), OPEN (effort for non-OpenAI) | ag-grid.com/studio/react/ai-adapter, ai-custom-agents; prototype in week 4 or earlier | ADR-008 |
| V-08 | AG Studio runs locally without a licence; trial key needed to remove watermark and test in production | DOCS-CONFIRMED 2026-10-06 | licence-install page | demo hosting |
| V-09 | Trial length (45 days) counted from activation or fixed? What happens to judges after expiry? Keys tied to release dates | OPEN | Ask in PayPal Discord / AG Grid; if 45 days from activation, activation on or after Oct 31 covers Dec 15 | judging |
| V-10 | Sandbox-only dispute operations incl. update-status, settle, **adjudicate** (handoff listed require-evidence) | PARTLY (adjudicate seen in API reference) | schema.yaml; spike S8 | Scenario A |
| V-11 | Partial offers need buyer acceptance; how to simulate in sandbox | OPEN | spike S9 | Scenario C |
| V-12 | Webhook signature verification: API call vs offline verification; headers needed | OPEN | spike S6 | webhook design |
| V-13 | Transaction Search lags up to ~3h and caps ranges at 31 days (boilerplate README); use capture IDs instead | DOCS-CONFIRMED 2026-10-06 | boilerplate README | seeding |
| V-14 | Seeding many transactions; reuse of a transaction after settlement | OPEN | spike S3, S10 | scenario pool |
| V-15 | Evidence requirements for second reason; file types/sizes | OPEN | reasons-evidence docs; spike S13 | second reason |
| V-16 | Webhook delivery retry behavior and timeouts | OPEN | PayPal webhook docs | resilience |
| V-17 | APIMatic prize requirements; Render Workflows availability/limits; $50 Render credit claim | OPEN | sponsor pages, Oct 7 webinar | hedges |
| V-18 | Render instance sleep/cold-start for the chosen plan | OPEN | spike S14 | webhook reliability |
| V-19 | Do dispute endpoints honor an idempotency/request-id header | OPEN | PayPal docs; spike | executor protocol (must work without) |
| V-20 | Official rules: eligibility, payout, third-party help, AI-tool disclosure | OPEN | rules page; read in full | everything |
| V-21 | All statistics in handoff section 3 (card-chargeback numbers vs PayPal disputes) | OPEN | primary sources only | pitch, video |
| V-22 | Judges' ability to run the project (hosted URL requirement, free to test through Dec 15) | OPEN | rules; plan hosting costs | submission |
