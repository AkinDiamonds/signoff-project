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

---

## 2. Local Model (Muse Glimmer) Collaboration Protocol

The user maintains a self-hosted local model ("Muse Glimmer"). Whenever:
1. Tests or checks need to be run, or
2. Deep investigation / log crunching / tracing is required:

**The agent MUST:**
Provide a structured, copy-pasteable **Diagnostic Packet** for the user to hand off to Muse Glimmer.

### Standard Format for Diagnostic Packets

Whenever handing off a run or diagnostic task, format it cleanly in a markdown block:

```markdown
# [Diagnostic Packet for Local Model: Muse Glimmer]

## Context
- Project: signoff-project
- Workspace: c:\Users\HP\Downloads\signoff-project
- Python interpreter: .venv\Scripts\python

## Target
- Files involved: <list relevant files>
- Scenario / Test: <what is being verified or investigated>

## Command to Run
```bash
<exact command>
```

## Instructions for Local Model
1. Run the command above locally.
2. Filter the output: do NOT return raw traces or multi-line logs.
3. Return only:
   - PASS / FAIL status
   - Exact failure line and assertion / exception (max 10 lines)
   - State of relevant variables or loggers at failure time
```

---

## 3. Ingesting Feedback from the Local Model
When the user pastes the local model's summary:
- Ingest the concise diagnostic directly.
- Identify the root cause and apply the fix in code.
- Do not ask for raw logs unless the summary is ambiguous.
