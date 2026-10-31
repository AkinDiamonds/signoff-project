# Copy this prompt into the implementing agent

You are completing the existing Signoff project, not building a replacement. Read `build-plan/v3/00-execution-plan.md` fully. It is the master plan based on the owner's previous chat and this repository. Follow T00–T17 sequentially and preserve all listed workstreams, including mobile web push and verification on Render.

Start by reading repository instructions and preserving existing changes. Use the existing isolated checkout. Inspect actual files, schemas, scripts and installed tools before editing; paths in the plan are starting points, not permission to invent APIs. Python commands must follow the repository's venv rule. Read environment variable names/presence only and keep secrets out of outputs.

Create `build-plan/v3/EXECUTION-LOG.md`. Record each task as TODO/IN PROGRESS/PASS/FAIL/BLOCKED with commit, files, exact checks/exit codes/counts, evidence and next action. Run T00's read-only deployed audit first. Distinguish what you observe from what the old chat or README claims. Before running tests, explicitly isolate their database and service settings from any configured Render/shared sandbox database.

Implement one bounded task at a time. For each:

1. State the concrete defect and the smallest required change.
2. Read the task's actual code, contract and tests.
3. Add a meaningful failing regression test where behavior is being fixed; gate/parser changes require test-first.
4. Implement the complete task across backend/types/UI/migrations where required. Reuse current functionality. Keep financial authority, executor boundary and fail-closed behavior intact.
5. Run targeted checks; fix the diagnosed issue without suppressing assertions, lint or typing. If a command fails twice, obey AGENTS.md: stop/report that failure and state the exact blocker; do not endlessly retry or search other environments.
6. Update schema/generated client for intentional API changes, then verify parity.
7. Save proof and execution-log status. Continue to the next task without asking routine preference questions. Ask only for an access/credential, essential product decision or explicit release authorization that is actually missing.

Do not finish after writing code, making screenshots or passing stub tests. Prepare the full Render release and rollback document. Deployment and hosted sandbox mutations require explicit authorization unless already granted in your execution session. Complete all independently authorized preparation before asking. Do not alter or publish the Codex cloud environment configuration.

Once authorized, deploy the exact reviewed release, verify all Render services and run the plan's hosted acceptance journey using fictional sandbox data. Prove purchase → payment ID → simulated tracking → actual dispute → retrieved evidence → valid model plan → deterministic gate → PayPal confirmation or phone approval → current dashboard/history → persistent notification → real phone push. Keep failed/blocked/unrun steps visible. No fabricated carrier data, financial outcomes or test results.

If you exhaust context, leave a handoff in EXECUTION-LOG with current task, last successful checks, changed files, pending processes and exact next command. Resume there; do not restart the plan or silently skip tasks. The final report must name deployed URLs, release SHA, passing and failing checks, evidence paths, remaining limitations and rollback. Treat 'works locally' as intermediate progress.
