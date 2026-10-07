# Step 16: LLM interface, cache and budget

Phase: P3 Agent · Depends on: 02 · Estimate: 2h with an agent · Commit: `feat(llm): provider interface, scenario cache, budget cap`
Status: [ ] not started

## Goal
Controlled, testable access to the model with a safe failure story.

## Do (in order)
1. Define the LLM interface returning either a validated structured result or a typed failure.
2. Implement the provider chosen in ADR-008 and a deterministic fake for tests.
3. Implement the scenario cache keyed by prompt version and input hash; cache hits are flagged for the UI label "cached reasoning".
4. Implement timeouts, one repair attempt for invalid output, and the daily budget cap.
5. Expose mode (live, cached, unavailable) in `/api/status`.

## Files (touch only these)
`agent/app/agent/llm.py`, `agent/app/agent/cache.py`, `agent/app/agent/budget.py`, tests.

## Edge cases: behavior
- Timeout, provider 429 or 5xx, invalid JSON, empty plan, refusal text, extra fields: each handled and typed.
- Budget exhausted or key missing: cache-only mode, then approval fallback, never a silent failure.
- Only validated outputs enter the cache; bumping the prompt version invalidates it.
- Concurrent calls near the cap do not overspend.

## Edge cases: types
- The only accepted return type is the plan schema; free text is never executed.

## Tests and regression
- Failure matrix with the fake; budget race test; cache labeling.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
