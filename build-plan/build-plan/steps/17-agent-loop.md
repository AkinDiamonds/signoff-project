# Step 17: Agent loop and plan schema

Phase: P3 Agent · Depends on: 09,12,13,15,16 · Estimate: 3h with an agent · Commit: `feat(agent): plan-only agent loop wired to the gate`
Status: [ ] not started

## Goal
The agent reads, proposes and hands everything to the gate; it can never act.

## Do (in order)
1. Implement the loop: load dispute and context through read tools only, build the prompt with fixed rules and buyer text as quoted data in a separate field, call the LLM, validate against the plan schema, store the run (model, prompt version, input hash).
2. Pass every proposed action to the gate; route ALLOW to an execute job, NEEDS_APPROVAL to approval creation (step 19), DENY to the ledger.
3. Enforce the read-tool allowlist.

## Files (touch only these)
`agent/app/agent/loop.py`, `agent/app/agent/prompts.py`, `agent/app/agent/schemas.py`, tests.

## Edge cases: behavior
- Empty plan: ledger records "no action".
- Duplicate actions deduplicated; evidence ordered before message.
- Action not applicable to the dispute reason: rejected and logged.
- The model names a mutating tool: rejected and logged.
- Too many actions: whole plan routed to approval.
- Run for a stale fingerprint: skipped.
- Retry after a crash reuses the same run id.
- Very long or non-English buyer text: truncated with a marker, hash kept.

## Edge cases: types
- Unknown action types are rejected by the schema; amounts are decimal strings; the plan forbids extra fields.

## Tests and regression
- Scripted fake-LLM outputs for every case; allowlist test; stale skip.

## Done when
- Tests green; no import of any mutating client from the agent package (contract passes).

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
