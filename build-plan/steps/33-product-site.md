# Step 33: Signoff product site and judge guide

Phase: P6 Client-facing · Depends on: 31,32 · Estimate: 2h with an agent · Commit: `feat(web): landing page and judge guide`
Status: [ ] not started

## Goal
Looks like a real product and tells a judge exactly what to do in five minutes.

## Do (in order)
1. Build the public landing page: problem, the signing-limit idea, how it works, a "Try it" call to action.
2. Build `/guide`: numbered path (open the shop, use a demo order, report a problem, watch the dashboard, approve on a phone), test credentials, a real-versus-simulated table, repo, license and video links, and a persistent Buyer view and Merchant view switcher.
3. Keep every public claim in a typed list with a ledger id; no claim without a `docs/claims-ledger.md` row.
4. Use only assets you own or have licensed; no third-party logos except PayPal's, used per its brand rules; PayPal's name is not part of the product brand.

## Files (touch only these)
`web/src/features/site/*`, tests.

## Edge cases: behavior
- Claims about unbuilt features are impossible: a test fails if a claim has no ledger id.
- Missing images have text fallbacks; page works without scripts for the text content where practical.
- Unknown routes show a helpful not-found.

## Edge cases: types
- The claims list is a readonly typed array with literal ids.

## Tests and regression
- Playwright: landing renders, call to action reaches the guide, all internal links resolve, accessibility check.

## Done when
- Tests green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
