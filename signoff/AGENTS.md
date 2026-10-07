# AGENTS.md — instructions for AI coding assistants

Read in this order before touching anything: `plan/STATUS.md` → `CONVENTIONS.md` → `plan/00-index.md` → the plan file for the current task.

## Hard invariants (never violate, never "temporarily")
1. Only `app/executor` may import `app/paypal/mutating_client`. 
2. The LLM never receives a mutating tool. Its output is a schema-validated plan, nothing more.
3. The gate is a pure function; every verdict has a `rule_id` and a plain-English reason.
4. Fail closed on any error.
5. Sandbox only; no secrets in commits; fictional data only.
6. Do not change the product idea. Propose changes as an ADR for the builder to approve.
7. Do not rely on anything marked VERIFY until `plan/07-verify-register.md` says it is closed.

## Rules of engagement
- Do not invent PayPal fields or endpoints. Use `fixtures/paypal/` or the OpenAPI schema.
- No new dependency without an ADR line.
- Small diffs. One concern per PR.
- Write the test first for gate rules and parsers.
- If a task is ambiguous or touches the gate/executor semantics, stop and write the question in `plan/STATUS.md` under Blockers.

## Before you say "done"
Run and paste the output of: lint, type-check, tests, import-linter (agent); lint, tsc, vitest (web). State what you did **not** verify.

## Commands
_Filled in after the Day-1 spike._
