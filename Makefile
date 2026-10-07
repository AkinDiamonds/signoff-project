.PHONY: check test-agent test-web test-types e2e e2e-smoke rehearse api-types dev

ifeq ($(OS),Windows_NT)
VENV_PY := .venv\Scripts\python.exe
else
VENV_PY := .venv/bin/python
endif

check: test-agent
	@echo Checking license and repository integrity...
	@$(VENV_PY) -c "import os; assert os.path.exists('LICENSE'), 'LICENSE missing'"
	@echo check: all checks passed.

test-agent:
	@echo Running agent lints and tests...
	@$(VENV_PY) -m ruff check signoff/agent signoff/scripts
	@$(VENV_PY) -m pytest

test-web:
	@echo test-web: not yet implemented

test-types:
	@echo test-types: not yet implemented

e2e:
	@echo e2e: not yet implemented

e2e-smoke:
	@echo e2e-smoke: not yet implemented

rehearse:
	@echo rehearse: not yet implemented

api-types:
	@echo Exporting OpenAPI schema...
	@$(VENV_PY) signoff/scripts/export_openapi.py

dev:
	@echo Starting agent development server...
	@$(VENV_PY) -m uvicorn agent.app.main:app --reload --port 8000
