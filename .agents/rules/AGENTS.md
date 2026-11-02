# Agent Rules for signoff-project

## 1. Autonomous Command Execution & Token Preservation Policy

**CRITICAL**: Do NOT execute commands that produce long or verbose terminal output autonomously.
- **Prohibited from autonomous execution:**
  - Full test suites (e.g. `pytest`, `make check`, `npm test`)
  - Verbose test runs (`pytest -v`, `pytest -xvs`)
  - Verbose linting or git logs (`git log` without limit, `ruff check` on entire repo)
- **Permitted autonomous commands:**
  - Highly targeted single-test checks that produce <= 5 lines (e.g. `pytest <path>::<test_name> -q`)
  - Short status inspections (e.g. `git status -s`)
