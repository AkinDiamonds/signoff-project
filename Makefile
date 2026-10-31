.PHONY: check prepare-test-db owner-password test-agent test-web test-types e2e e2e-stack e2e-smoke e2e-cross-smoke rehearse api-types dev stub docker-up docker-down docker-reset docker-logs

ifeq ($(OS),Windows_NT)
# Run every recipe through Git Bash's sh so the commands below mean the same
# thing in PowerShell, cmd and bash. Git Bash exports SHELL=/bin/bash.exe, which
# make cannot spawn, so probe with cmd.exe (COMSPEC) first. A normal PowerShell
# PATH only has <git>\cmd, so fall back to deriving <git>\bin\sh.exe from git.exe.
SHELL := $(COMSPEC)
SH_BIN := $(strip $(shell where sh.exe 2>NUL))
ifeq ($(SH_BIN),)
# where git.exe reports <git>\cmd\git.exe (or <git>\mingw64\bin\git.exe);
# sh.exe lives at <git>\bin\sh.exe. Paths contain spaces, so keep them whole.
GIT_BIN := $(strip $(shell where git.exe 2>NUL))
SH_BIN := $(patsubst %\cmd\git.exe,%\bin\sh.exe,$(patsubst %\mingw64\bin\git.exe,%\bin\sh.exe,$(patsubst %\usr\bin\git.exe,%\bin\sh.exe,$(GIT_BIN))))
SH_BIN := $(if $(findstring \bin\sh.exe,$(SH_BIN)),$(SH_BIN))
endif
ifeq ($(SH_BIN),)
$(error Could not find sh.exe. Install Git for Windows and put git.exe on PATH.)
endif
SHELL := $(SH_BIN)
# make 3.81 skips the shell for commands with no special characters and runs
# them directly; `echo` is not an executable on Windows, so keep the message
# quoted to force the shell.
VENV_PY := .venv/Scripts/python.exe
PY_PATH := signoff;signoff/agent
else
VENV_PY := .venv/bin/python
PY_PATH := signoff:signoff/agent
endif

STUB_URL ?= http://localhost:4010

check: test-agent test-web test-types
	@echo "Checking license and repository integrity..."
	@$(VENV_PY) -c "import os; assert os.path.exists('LICENSE'), 'LICENSE missing'"
	@echo "check: all checks passed."

prepare-test-db:
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m scripts.prepare_test_database

owner-password:
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m scripts.owner_password

test-agent:
	@echo "Running agent lints and tests..."
	@$(VENV_PY) -m ruff check signoff/agent signoff/scripts
	@MYPYPATH=signoff $(VENV_PY) -m mypy --strict signoff/agent/app
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -c "from importlinter.cli import lint_imports_command; lint_imports_command()"
	@$(VENV_PY) -m pytest

test-web:
	@echo "Running frontend and UI unit tests..."
	@npx eslint .
	@npx vitest run --maxWorkers=2 --minWorkers=1

test-types:
	@echo "Running compile-time type tests and enum parity checks..."
	@npx tsc --noEmit
	@$(VENV_PY) signoff/scripts/check_enum_parity.py
	@node scripts/check-client-fresh.mjs

e2e-stack:
	@echo "Starting cross-app e2e stack..."
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m scripts.e2e_stack start

e2e: e2e-stack
	@echo "Running cross-app Playwright suite..."
	@npx playwright test --config signoff/e2e/playwright.cross.config.ts --grep "@smoke|@full"

e2e-smoke:
	@echo "Running Playwright smoke tests..."
	@npx playwright test --config signoff/e2e/playwright.config.ts --grep @smoke

e2e-cross-smoke:
	@echo "Running cross-app smoke tests..."
	@npx playwright test --config signoff/e2e/playwright.cross.config.ts --grep @smoke

rehearse:
	@if [ ! -f .env ]; then echo "rehearse requires .env with live sandbox credentials"; exit 1; fi
	@npx playwright test --config signoff/e2e/playwright.cross.config.ts --grep @live

api-types:
	@echo "Exporting OpenAPI schema and generating client..."
	@$(VENV_PY) signoff/scripts/export_openapi.py
	@node signoff/packages/api-client/scripts/generate.mjs

stub:
	@echo "Starting PayPal stub on $(STUB_URL)..."
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m scripts.paypal_stub.main

dev:
ifeq ($(PAYPAL_ENV),stub)
	@echo "Starting PayPal stub and agent development server..."
	@PYTHONPATH="$(PY_PATH)" STUB_PORT=4010 $(VENV_PY) -m scripts.paypal_stub.main &
	@PYTHONPATH="$(PY_PATH)" PAYPAL_ENV=stub PAYPAL_BASE_URL=$(STUB_URL) $(VENV_PY) -m uvicorn agent.app.main:app --reload --port 8000
else
	@echo "Starting agent development server..."
	@PYTHONPATH="$(PY_PATH)" $(VENV_PY) -m uvicorn agent.app.main:app --reload --port 8000
endif

docker-up:
	@echo "Building and starting the Docker demo stack..."
	@docker compose up --build -d

docker-down:
	@echo "Stopping the Docker demo stack (database volume kept)..."
	@docker compose down

docker-reset:
	@echo "Stopping the Docker demo stack and deleting the database volume..."
	@docker compose down -v

docker-logs:
	@docker compose logs -f --tail=100
