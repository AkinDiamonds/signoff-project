# Step 01: Repo, license and CI skeleton

Phase: P0 Foundation · Depends on: 00 · Estimate: 2h with an agent · Commit: `chore(repo): layout, license, CI and make targets`
Status: [ ] not started

## Goal
A public repo with a visible license and CI that blocks bad commits before any feature exists.

## Do (in order)
1. Create the layout: `agent/`, `web/` (Signoff site and dashboard), `shop/` (storefront and buyer portal), `packages/api-client/`, `packages/ui/`, `scripts/`, `fixtures/`, `docs/`, `plan/`, `build-plan/`.
2. Add `LICENSE` with the unmodified standard text chosen in ADR-011, correct year and holder.
3. Add `.gitignore` (env files, virtualenvs, node_modules, build output, Playwright reports), `.gitattributes` forcing LF, `.python-version`, `.nvmrc` (Node version required by AG Studio and the boilerplate, 20.9 or newer).
4. Add a `Makefile` with these exact targets: `check`, `test-agent`, `test-web`, `test-types`, `e2e`, `e2e-smoke`, `rehearse`, `api-types`, `dev`. Targets for later steps print "not yet implemented" and exit successfully.
5. Add pre-commit hooks: secret scan, ruff, prettier.
6. Add the CI workflow with jobs: agent, web, types, secrets, and an "api types fresh" check (placeholder until step 04).
7. Replace the "Commands" section of `AGENTS.md` with the make targets.
8. Run the secret scan over full git history before the first public push. Enable branch protection requiring CI (manual).

## Files (touch only these)
`LICENSE`, `.gitignore`, `.gitattributes`, `.python-version`, `.nvmrc`, `Makefile`, `.pre-commit-config.yaml`, CI workflow, `AGENTS.md`.

## Edge cases: behavior
- License text edited by hand: GitHub will not show it in About. Use the exact standard text.
- Secrets already in history: rewrite history before going public, never after.
- Local and CI language versions differ: both read the pinned version files.
- Lockfiles are committed, never ignored.

## Edge cases: types
- None at this step. Strict TypeScript flags arrive in step 04.

## Tests and regression
- Push a temporary branch with a deliberately failing lint and a fake secret: CI must fail on both. Delete the branch.
- `make check` passes locally on the empty skeleton.

## Done when
- CI green on main; license visible in the repo About section; branch protection on.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
