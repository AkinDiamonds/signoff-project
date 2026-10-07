# Step 19: Approvals backend

Phase: P3 Agent · Depends on: 12,13,17 · Estimate: 3h with an agent · Commit: `feat(approvals): tokens, resolve and edit re-gate`
Status: [ ] not started
Assumes (step 00 table): S9 offer acceptance. If the answer changed, edit this file first and log it below.

## Goal
Humans can approve, deny or edit, safely and exactly once.

## Do (in order)
1. Create approvals on NEEDS_APPROVAL with a random token stored only as a hash, bound to the action hash, expiring before the dispute due time.
2. `GET /api/approvals/{token}` returns the card data; `POST .../resolve` accepts approve, deny or edit.
3. Edit changes only the amount or message and re-runs the gate; approve executes through the executor with the waiver rules.
4. Add the expiry job.

## Files (touch only these)
`agent/app/approvals/*`, `agent/app/api/approvals.py`, tests.

## Edge cases: behavior
- Unknown, expired or used token: same uniform not-found style response with distinct internal reason; rate limited.
- Concurrent resolves: one wins, the other gets a conflict.
- Dispute changed since the card was made: stale conflict and re-plan.
- Edits that are negative, above the disputed amount or have too many decimals: 422.
- Deny records the decision and takes no other action.
- Notes are stored raw and escaped on output.

## Edge cases: types
- The resolve request is a union (approve, deny, edit with at least one field); token is a distinct type from other ids.

## Tests and regression
- Matrix above; token entropy and hash-at-rest checks; concurrency.

## Done when
- Tests green; client regenerated.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
