# Step 28: AG Studio dashboard and read-only assistant

Phase: P5 Merchant UI · Depends on: 25,21,16 · Estimate: 4h with an agent · Commit: `feat(web): ag studio dashboard and assistant proxy`
Status: [ ] not started

## Goal
The AG Studio dashboard with live data and a natural-language assistant that can only read.

## Do (in order)
1. Install the pinned AG Studio packages (versions from the spike). **No licence key needed** (ADR-015: watermark and console error are expected and accepted).
2. Build the typed data adapter mapping `/api/kpis` and `/api/disputes` into Studio data; apply the theme from the tokens.
3. Add `POST /api/llm` in the agent as the assistant's proxy: model allowlist, size cap, rate limit, budget, no tools beyond Studio's data tools.
4. Configure custom agent instructions: dashboard questions only, no actions; show sample questions.

## Files (touch only these)
`web/src/features/dashboard/*`, `agent/app/api/llm_proxy.py`, tests.

## Edge cases: behavior
- Studio fails to load: the page shows a link to the plain dispute list.
- Watermark and console error from AG Studio are **expected** (ADR-015); do not try to suppress them.
- API error: widget error state, not blank.
- Asked to approve a dispute or edit the charter: refuses, and the tool list has no such tool.
- Proxy ignores client-supplied model overrides; oversize body rejected; budget exhausted gives a friendly message.
- The LLM key never appears in the web build output (build scan).

## Edge cases: types
- The assistant's tool list is a typed constant; a type test fails if a mutation name is added; adapter input and output types come from the api-client.

## Tests and regression
- Playwright: dashboard loads and KPI numbers match the API; canned assistant question with the fake LLM; build-output secret scan.

## Done when
- Tests green; regression: steps 24 and 25 tests.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
