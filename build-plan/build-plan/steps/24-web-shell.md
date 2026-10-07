# Step 24: Signoff web shell, design system, state components

Phase: P5 Merchant UI · Depends on: 04,21 · Estimate: 3h with an agent · Commit: `feat(web): shell, tokens, state components, mock server`
Status: [ ] not started

## Goal
Every screen can be built on one set of consistent, accessible parts.

## Do (in order)
1. Implement tokens in `packages/ui` using the roles in `plan/04-frontend-spec.md`; verdict colors always paired with icon and label.
2. Build: Button, Card, VerdictChip, Money, Deadline, EmptyState, ErrorState (message, correlation id, retry), Skeleton, Banner (sandbox, frozen, cached reasoning).
3. Set up routes from `contracts.md`, TanStack Query, an error boundary, skip link and landmarks.
4. Add the mock server with typed fixtures in `fixtures/ui/` selectable by an environment switch.

## Files (touch only these)
`packages/ui/*`, `web/src/app/*`, `fixtures/ui/*`.

## Edge cases: behavior
- Money displays from the exact string; rounding never changes the stored value; fixed locale.
- Null or past deadlines; very long labels wrap or truncate with a tooltip.
- A server value outside the known union renders a neutral "Unknown" chip instead of crashing.
- Reduced-motion respected.

## Edge cases: types
- VerdictChip accepts only the Verdict union; Money component rejects numbers (type tests).

## Tests and regression
- Component tests for each state; Playwright smoke (boot, 404, skip link) and an accessibility check on the shell.

## Done when
- `make test-web`, `make test-types` and `make e2e-smoke` green.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
