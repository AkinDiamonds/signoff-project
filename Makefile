.PHONY: check test-agent test-web test-types e2e e2e-smoke rehearse api-types dev stub

ifeq ($(OS),Windows_NT)
VENV_PY := .venv\Scripts\python.exe
PY_PATH := signoff;signoff/agent
else
VENV_PY := .venv/bin/python
PY_PATH := signoff:signoff/agent
endif

STUB_URL ?= http://localhost:4010

check: test-agent test-web test-types
	@echo Checking license and repository integrity...
	@$(VENV_PY) -c "import os; assert os.path.exists('LICENSE'), 'LICENSE missing'"
	@echo check: all checks passed.

test-agent:
	@echo Running agent lints and tests...
	@$(VENV_PY) -m ruff check signoff/agent signoff/scripts
	@$(VENV_PY) -m pytest

test-web:
	@echo Running frontend and UI unit tests...
	@npx eslint .
	@npx vitest run --exclude "**/*.test-d.ts"

test-types:
	@echo Running compile-time type tests and enum parity checks...
	@npx vitest run signoff/packages/api-client/test/baseline.test-d.ts signoff/packages/ui/test/ui-types.test-d.ts
	@$(VENV_PY) signoff/scripts/check_enum_parity.py
	@node scripts/check-client-fresh.mjs

e2e:
	@echo e2e: not yet implemented

e2e-smoke:
	@echo Running Playwright smoke tests...
	@npx playwright test --config signoff/e2e/playwright.config.ts --grep @smoke

rehearse:
	@echo rehearse: not yet implemented

api-types:
	@echo Exporting OpenAPI schema and generating client...
	@$(VENV_PY) signoff/scripts/export_openapi.py
	@node signoff/packages/api-client/scripts/generate.mjs

stub:
	@echo Starting PayPal stub on $(STUB_URL)...
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m scripts.paypal_stub.main

dev:
ifeq ($(PAYPAL_ENV),stub)
	@echo Starting PayPal stub and agent development server...
	@PYTHONPATH="$(PY_PATH)" STUB_PORT=4010 $(VENV_PY) -m scripts.paypal_stub.main &
	@PYTHONPATH="$(PY_PATH)" PAYPAL_ENV=stub PAYPAL_BASE_URL=$(STUB_URL) $(VENV_PY) -m uvicorn agent.app.main:app --reload --port 8000
else
	@echo Starting agent development server...
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m uvicorn agent.app.main:app --reload --port 8000
endif
