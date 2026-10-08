.PHONY: check test-agent test-web test-types e2e e2e-smoke rehearse api-types dev

ifeq ($(OS),Windows_NT)
VENV_PY := .venv\Scripts\python.exe
else
VENV_PY := .venv/bin/python
endif

ifeq ($(wildcard $(VENV_PY)),)
PYTHON := python
else
PYTHON := $(VENV_PY)
endif

check: test-agent test-web test-types
	@echo Checking license and repository integrity...
	@$(PYTHON) -c "import os; assert os.path.exists('LICENSE'), 'LICENSE missing'"
	@echo check: all checks passed.

test-agent:
	@echo Running agent lints and tests...
	@$(PYTHON) -m ruff check signoff/agent signoff/scripts
	@$(PYTHON) -m pytest

test-web:
	@echo Running frontend and UI unit tests...
	@npx eslint .
	@npx vitest run --exclude "**/*.test-d.ts"

test-types:
	@echo Running compile-time type tests and enum parity checks...
	@npx vitest run signoff/packages/api-client/test/baseline.test-d.ts
	@$(PYTHON) signoff/scripts/check_enum_parity.py
	@node scripts/check-client-fresh.mjs

e2e:
	@echo e2e: not yet implemented

e2e-smoke:
	@echo e2e-smoke: not yet implemented

rehearse:
	@echo rehearse: not yet implemented

api-types:
	@echo Exporting OpenAPI schema and generating client...
	@$(PYTHON) signoff/scripts/export_openapi.py
	@node signoff/packages/api-client/scripts/generate.mjs

dev:
	@echo Starting agent development server...
	@$(PYTHON) -m uvicorn agent.app.main:app --reload --port 8000
