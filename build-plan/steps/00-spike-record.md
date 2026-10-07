# Step 00: Record spike results and lock decisions

Phase: P0 Foundation · Depends on: - · Estimate: 1h with an agent · Commit: `docs(adr): record spike answers and decisions`
Status: [x] done

## Goal
Turn spike outcomes into ADRs and fixtures. Docs only, no code.

## Do (in order)
1. Fill the results table in `plan/01-day1-spike.md` for S1-S14 with evidence filenames.
2. Confirm raw responses are saved, scrubbed, in `fixtures/paypal/` as `<step>-<name>.json`. Minimum set: token response, create-dispute response, get-dispute with `allowed_response_options`, webhook CREATED headers and body, provide-evidence response, get-dispute after evidence.
3. Close or update every VERIFY row in `plan/07-verify-register.md` that the spike touched (date and source).
4. Write ADRs: 005 web framework, 007 charter semantics, 008 LLM provider, 009 toolkit use, 011 license, and the three new ones in `_apply-to-existing-plans.md` (012 storefront and three hosts, 013 PayPal stub for tests, 014 demo session scoping). Set each to Accepted.
5. Fill the assumptions table below. Every later step marked ASSUMES reads from it.

## Files (touch only these)
`plan/01-day1-spike.md`, `plan/07-verify-register.md`, `docs/decisions.md`, `fixtures/paypal/*`, this file.

## Edge cases: behavior
- A spike answer contradicts a later step: edit that step's ASSUMES line and record it in that step's review log.
- A fixture contains a token, real email or real name: scrub and re-run the secret scan before committing.
- S8/S9 answer "not possible in sandbox": mark scenarios A or C as "recorded outcome" in the demo script now.

## Edge cases: types
- The fixture set is the source of truth for every PayPal-facing type. If a field is not in a fixture or the schema file, it does not go in a model.

## Tests and regression
- Run the secret scanner over `fixtures/`. No other tests.

## Done when
- ADRs accepted; assumptions table complete; fixture minimum set present and scrubbed.

## Assumptions (fill in)
| Spike | Question | Answer | Steps that rely on it |
|---|---|---|---|
| S8 | Can a dispute be driven to resolved in sandbox (adjudicate, settle)? Can seller-wins be forced? | | 21, 34 |
| S9 | Offer acceptance by buyer in sandbox: possible? how? | | 19, 32, 34 |
| S10 | Transaction reuse; pool size needed | | 23, 32 |
| S12 | Toolkit Python auth works? | | 06 |
| S13 | Second reason chosen and its evidence type | | 22 |
| S14 | Render plan and cold-start behavior | | 36 |
| Checkout | PayPal buttons (JS SDK) or redirect approval for the shop | | 30, 31 |

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
