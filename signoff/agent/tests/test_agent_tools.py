"""Unit tests for agent read tool allowlist and tool registry safety invariants."""

import pytest
from pydantic import ValidationError

from agent.app.agent.tools import (
    FORBIDDEN_MUTATION_TOOL_NAMES,
    READ_TOOL_NAMES,
    READ_TOOLS,
    GetDisputeInput,
    ListDisputesInput,
    ReadToolDefinition,
)


def test_read_tool_names_is_frozen():
    assert isinstance(READ_TOOL_NAMES, frozenset)
    assert len(READ_TOOL_NAMES) > 0


def test_no_mutation_tool_in_read_allowlist():
    """Safety invariant: Adding any mutation tool name to READ_TOOL_NAMES fails this test."""
    intersection = READ_TOOL_NAMES.intersection(FORBIDDEN_MUTATION_TOOL_NAMES)
    assert not intersection, f"Forbidden mutating tools found in READ_TOOL_NAMES: {intersection}"

    for mutation_name in FORBIDDEN_MUTATION_TOOL_NAMES:
        assert mutation_name not in READ_TOOL_NAMES
        assert mutation_name not in READ_TOOLS


def test_read_tool_definitions_conform_to_allowlist():
    """All registered read tools must belong to READ_TOOL_NAMES."""
    for tool_name, tool_def in READ_TOOLS.items():
        assert tool_name in READ_TOOL_NAMES
        assert tool_def.name == tool_name
        assert callable(tool_def.handler)
        assert tool_def.parameters_schema is not None


def test_reject_mutating_tool_definition_registration():
    """Attempting to construct a ReadToolDefinition with a mutating or disallowed name raises ValueError."""
    with pytest.raises(ValueError, match="not in the frozen READ_TOOL_NAMES allowlist"):
        ReadToolDefinition(
            name="arbitrary_unauthorized_tool",
            description="Unauthorized tool",
            parameters_schema={},
            handler=lambda *args: None,
        )

    with pytest.raises(ValueError, match="not in the frozen READ_TOOL_NAMES allowlist"):
        ReadToolDefinition(
            name="accept_claim",
            description="Concede dispute",
            parameters_schema={},
            handler=lambda *args: None,
        )


def test_tool_input_schemas():
    list_input = ListDisputesInput(page_size=25, dispute_state="REQUIRED_ACTION")
    assert list_input.page_size == 25
    assert list_input.dispute_state == "REQUIRED_ACTION"

    with pytest.raises(ValidationError):
        ListDisputesInput(page_size=100)  # ge=1, le=50

    get_input = GetDisputeInput(dispute_id="PP-D-12345")
    assert get_input.dispute_id == "PP-D-12345"

    with pytest.raises(ValidationError):
        GetDisputeInput(dispute_id="")
