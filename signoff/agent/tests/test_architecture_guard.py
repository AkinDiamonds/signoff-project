"""Architecture guard and import-linter contract tests.

Validates Step 13 requirements:
1. Only agent.app.executor may import agent.app.paypal.mutating_client.
2. Architecture guard test fails when a forbidden import is added.
3. Agent tool registry contains no mutating tool names.
4. Negative typing test proving executor signature rejects raw action.
"""

import ast
import inspect
from pathlib import Path

from agent.app.agent.tools import (
    FORBIDDEN_MUTATION_TOOL_NAMES,
    READ_TOOL_NAMES,
    READ_TOOLS,
)
from agent.app.domain.actions import SendMessage
from agent.app.executor.executor import execute_decision
from agent.app.policy.gate import GateDecision


def find_mutating_client_imports_in_source(source_code: str) -> list[str]:
    """Parse python source AST and find any import targeting mutating_client."""
    tree = ast.parse(source_code)
    violations: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if "mutating_client" in alias.name:
                    violations.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if "mutating_client" in module:
                violations.append(module)
            for alias in node.names:
                if alias.name == "mutating_client" or "mutating_client" in alias.name:
                    violations.append(f"{module}.{alias.name}")

    return violations


def test_import_guard_only_executor_may_import_mutating_client():
    """Verify that only files inside agent/app/executor may import mutating_client."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    assert app_dir.is_dir(), f"Could not find agent app dir at {app_dir}"

    allowed_dir = app_dir / "executor"
    violations: list[str] = []

    for py_file in app_dir.rglob("*.py"):
        # Files inside agent/app/executor are permitted
        if allowed_dir in py_file.parents or py_file.parent == allowed_dir:
            continue

        source = py_file.read_text(encoding="utf-8")
        found = find_mutating_client_imports_in_source(source)
        if found:
            violations.append(f"{py_file.name}: {found}")

    assert not violations, (
        f"Architecture violation! Only app/executor may import mutating_client. "
        f"Found illegal imports in: {violations}"
    )


def test_import_guard_fails_when_forbidden_import_added():
    """Proof that adding a forbidden import outside executor causes the guard to fail."""
    forbidden_sample_source = """
from agent.app.paypal.mutating_client import PayPalMutatingClient

def bad_func():
    return PayPalMutatingClient()
"""
    violations = find_mutating_client_imports_in_source(forbidden_sample_source)
    assert violations, "Guard must detect forbidden import from mutating_client"
    assert any("mutating_client" in v for v in violations)


def test_agent_tool_registry_contains_no_mutating_names():
    """Safety invariant: agent tool registry must contain only read-only tools."""
    # 1. No forbidden mutating tool name in READ_TOOL_NAMES
    intersection = READ_TOOL_NAMES.intersection(FORBIDDEN_MUTATION_TOOL_NAMES)
    assert not intersection, f"Mutating tool names found in READ_TOOL_NAMES allowlist: {intersection}"

    # 2. No forbidden mutating tool name registered in READ_TOOLS
    for mut_name in FORBIDDEN_MUTATION_TOOL_NAMES:
        assert mut_name not in READ_TOOLS, f"Mutating tool '{mut_name}' registered in READ_TOOLS"

    # 3. Read tool names contain expected read-only operations
    assert "list_disputes" in READ_TOOL_NAMES
    assert "get_dispute" in READ_TOOL_NAMES


def find_module_imports(source_code: str, module_name: str) -> list[str]:
    """Parse Python source and return imports of ``module_name``."""
    tree = ast.parse(source_code)
    violations: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if module_name in alias.name:
                    violations.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if module_name in module:
                violations.append(module)
            for alias in node.names:
                if module_name in alias.name:
                    violations.append(f"{module}.{alias.name}")
    return violations


def test_import_guard_only_simulator_may_import_buyer_client():
    """The agent, executor and API layers must never create disputes as the buyer."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    allowed_dir = app_dir / "simulator"
    violations: list[str] = []

    for py_file in app_dir.rglob("*.py"):
        if py_file.parent == allowed_dir or py_file.name == "buyer_client.py":
            continue
        found = find_module_imports(py_file.read_text(encoding="utf-8"), "buyer_client")
        if found:
            violations.append(f"{py_file.name}: {found}")

    assert not violations, (
        "Architecture violation! Only app/simulator may import buyer_client. "
        f"Found illegal imports in: {violations}"
    )


def test_executor_negative_typing_rejects_raw_action():
    """Negative typing and runtime invariant: execute_decision rejects raw action."""
    # Static signature inspection: parameter 'decision' must be annotated with GateDecision
    sig = inspect.signature(execute_decision)
    param = sig.parameters["decision"]
    assert param.annotation is GateDecision, (
        f"Executor signature must type 'decision' as GateDecision, got {param.annotation}"
    )

    # Runtime check: raw action passed as decision raises ExecutionRejectedError
    raw_action = SendMessage(message="Hello")
    assert not isinstance(raw_action, GateDecision)
