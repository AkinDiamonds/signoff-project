.PHONY: check test-agent test-web test-types e2e e2e-smoke rehearse api-types dev

check:
	@echo "Running signoff verification checks..."
	@echo "Checking license and file integrity..."
	@python -c "import os; assert os.path.exists('LICENSE'), 'LICENSE missing'"
	@echo "check: all skeleton checks passed."

test-agent:
	@echo "test-agent: not yet implemented"

test-web:
	@echo "test-web: not yet implemented"

test-types:
	@echo "test-types: not yet implemented"

e2e:
	@echo "e2e: not yet implemented"

e2e-smoke:
	@echo "e2e-smoke: not yet implemented"

rehearse:
	@echo "rehearse: not yet implemented"

api-types:
	@echo "api-types: not yet implemented"

dev:
	@echo "dev: not yet implemented"
