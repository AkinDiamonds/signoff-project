# STATUS

**Date:** 2026-10-07 · **Phase:** Build plan, step 01 done → step 02 next · **Days to deadline:** 36 (Nov 12, 12:00 PT = 20:00 UTC)

## Done
- Handoff read. Planning scaffold created. Doc claims checked (see `07-verify-register.md`).
- Spike S1-S7 complete (GO with partial fallback on S4/S6). Fixtures saved to `fixtures/paypal/`. Results recorded in `plan/01-day1-spike.md`.
- Step 00 complete: spike ADRs, fixture hygiene, AG Grid licence decision (ADR-015), Money shape corrected, `dispute_state` added to fingerprint, `VITE_AG_STUDIO_LICENSE_KEY` removed.
- ADR-008 & ADR-016 Accepted: LLM provider confirmed reachable, configured via generic env vars.
- Open-source license added (MIT, ADR-011 Accepted).
- Step 01 complete: repo layout (`shop/`, `packages/api-client/`, `packages/ui/`), `.gitignore`, `.gitattributes`, `.python-version`, `.nvmrc`, `Makefile`, `.pre-commit-config.yaml`, CI workflow (`.github/workflows/ci.yml`), `AGENTS.md` updated with make targets.

## Next 3 actions
1. **Step 02:** Agent service skeleton (FastAPI, settings, error envelope, healthz, OpenAPI export).
2. **Step 03:** Database setup (Postgres, migrations, dispute tables).
3. **Step 04:** Web workspaces and types (React/Vite setup, OpenAPI type sync).

## Blockers
- None blocking Step 01 or Step 02.
- S8-S14 spike answers can be validated incrementally during steps 21, 23, 34.

## Open decisions (see docs/decisions.md)
ADR-005 web framework · ADR-007 charter semantics · ADR-014 demo session · checkout approach for shop (V-23)

