# Step 18: Injection screening and adversarial suite

Phase: P3 Agent · Depends on: 17 · Estimate: 2h with an agent · Commit: `feat(agent): injection screener and suite`
Status: [ ] not started

## Goal
Prove that hostile text cannot cause an action, and log the attempt.

## Do (in order)
1. Implement the screener producing signals (impersonation of system or admin, instructions aimed at the assistant, attempts to change limits, plan-shaped JSON in text).
2. A flagged run has its plan ignored (G5-02) and the dispute surfaces as "needs human review".
3. Create the suite as data files with at least 25 hostile cases and at least 8 benign cases.
4. The harness asserts: no mutating call, rule id logged, benign cases not flagged.

## Files (touch only these)
`agent/app/agent/screener.py`, `agent/tests/injection/*`, tests.

## Edge cases: behavior
- A buyer plainly asking for a refund is normal and must not be flagged.
- Zero-width characters, look-alike characters, very long text, mixed languages.
- Instructions hidden in tracking notes or other fields, not only messages.
- Repeated attempts are each logged.

## Edge cases: types
- The flag is a typed object with an enum of signals; a test lists every signal and its trigger case.

## Tests and regression
- The suite itself; a regression test that the defense still holds when the screener is disabled (gate and schema alone block the cases).

## Done when
- Tests green; scenario D defined in the fixtures.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
