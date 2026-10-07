# Step 36: Pre-deploy readiness gate

Phase: P7 Integration · Depends on: 35 · Estimate: 2h with an agent · Commit: `docs(deploy): readiness report and deploy handoff`
Status: [ ] not started
Assumes (step 00 table): S14 hosting plan. If the answer changed, edit this file first and log it below.

## Goal
A fresh clone works, everything claimed is proven, and the deploy plan has exact inputs.

## Do (in order)
1. Run `make check`, the full e2e suite and `make rehearse` against the real sandbox; save results in `docs/readiness.md`.
2. Follow the README from a fresh clone in a clean environment; fix every gap.
3. Create `docs/env-matrix.md`: every variable by service and host (names only).
4. Review `docs/claims-ledger.md` and `plan/07-verify-register.md`: no blocking open items.
5. Write `docs/deploy-handoff.md`: hosts, services, webhook subscription and return URL updates, CORS origins, licence key activation timing, always-on setting, pool refill before recording, backup recording.
6. Scan built artifacts for secrets; confirm the stub cannot start in production configuration.

## Files (touch only these)
`docs/readiness.md`, `docs/env-matrix.md`, `docs/deploy-handoff.md`, `README.md`.

## Edge cases: behavior
- Webhook and checkout return URLs must change after deployment; record them as explicit tasks.
- Licence trial date versus judging window (V-09).
- Time zones when scheduling the recording.

## Edge cases: types
- Run the full type-test suite and enum parity script one last time.

## Tests and regression
- Everything above.

## Done when
- Readiness report shows green; the deploy plan can start from `deploy-handoff.md` alone.

## Close-out
Run `make check` (level R1) and any extra re-run items named under Tests. Update `plan/STATUS.md`, the README status table, the claims ledger and ADRs if anything changed. Commit with the message above.

## Code review log
| Date | Reviewer finding | Change made | Commit | Re-run level |
|---|---|---|---|---|
| | | | | |
