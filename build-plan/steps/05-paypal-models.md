# Step 05: PayPal models and fixture contract tests

Phase: P1 Ingestion · Depends on: 03 · Estimate: 2h with an agent · Commit: `feat(paypal): models, parsers and dispute fingerprint`
Status: [ ] not started

## Goal
Parse real PayPal shapes safely and compute a stable state fingerprint.

## Do (in order)
1. Write pydantic models for dispute, dispute summary, evidence, allowed response options, links, money, webhook event and token response, built only from fixtures.
2. Write `parse_dispute` that fails closed when a required field is missing and ignores unknown fields.
3. Write the fingerprint function using exactly the inputs listed in `contracts.md`.
4. Add a test that every file in `fixtures/paypal/` parses with the matching model.

## Files (touch only these)
`agent/app/paypal/models.py`, `agent/app/paypal/fingerprint.py`, tests.

## Edge cases: behavior
- Amounts arrive as strings and become Decimal; JSON floats are rejected; zero or negative amounts are invalid; currency must be three uppercase letters.
- Missing `allowed_response_options` on a waiting-for-seller dispute becomes an empty set (the gate will deny) rather than a crash.
- Due date absent becomes null; dates with Z or offsets both parse to UTC.
- Reordered links or evidence lists produce the same fingerprint; a changed status, evidence or offer count changes it.
- Very long or non-English message text is preserved and hashed, truncated only at display time.

## Edge cases: types
- No float annotations anywhere in the models (a test scans for them); `Fingerprint` is a distinct type.

## Tests and regression
- Every fixture parses; for each required field, removing it fails parsing; fingerprint sensitivity and stability table; property test that key order does not matter.

## Done when
- Tests green; no model field lacks fixture evidence.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
