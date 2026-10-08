"""Agent read-only tool allowlist and safe wrapper implementations.

Per ADR-002, ADR-009, and CONVENTIONS §4, the agent and assistant receive ONLY
read-only tools. Any mutating tool (evidence submission, claim acceptance, offers)
is strictly forbidden from the tool registry.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field

from agent.app.paypal.models import Dispute, DisputeListResponse
from agent.app.paypal.read_client import PayPalReadClient

# Explicit frozen allowlist of read tool names
READ_TOOL_NAMES: frozenset[str] = frozenset({
    "list_disputes",
    "get_dispute",
    "get_dispute_details",
})

# Forbidden mutating tool names that must NEVER be in the read allowlist
FORBIDDEN_MUTATION_TOOL_NAMES: frozenset[str] = frozenset({
    "accept_dispute_claim",
    "accept_claim",
    "provide_evidence",
    "make_offer",
    "send_message",
    "escalate",
    "appeal",
    "refund",
    "cancel",
})


@dataclass(frozen=True)
class ReadToolDefinition:
    """Descriptor for a registered read-only agent tool."""

    name: str
    description: str
    parameters_schema: dict[str, Any]
    handler: Callable[..., Any]

    def __post_init__(self) -> None:
        if self.name not in READ_TOOL_NAMES:
            raise ValueError(
                f"Tool name '{self.name}' is not in the frozen READ_TOOL_NAMES allowlist: {sorted(READ_TOOL_NAMES)}"
            )
        if self.name in FORBIDDEN_MUTATION_TOOL_NAMES:
            raise ValueError(f"Tool name '{self.name}' is a forbidden mutating operation.")


class ListDisputesInput(BaseModel):
    page_size: int = Field(default=10, ge=1, le=50, description="Number of disputes per page")
    dispute_state: str | None = Field(default=None, description="Optional dispute state filter")
    status: str | None = Field(default=None, description="Optional dispute status filter")


class GetDisputeInput(BaseModel):
    dispute_id: str = Field(..., min_length=1, description="Unique PayPal dispute ID")


async def list_disputes_tool(
    client: PayPalReadClient,
    page_size: int = 10,
    dispute_state: str | None = None,
    status: str | None = None,
) -> DisputeListResponse:
    """Fetch recent disputes from PayPal read client."""
    return await client.list_disputes(
        page_size=page_size,
        dispute_state=dispute_state,
        status=status,
    )


async def get_dispute_tool(
    client: PayPalReadClient,
    dispute_id: str,
) -> Dispute:
    """Fetch complete dispute details by ID from PayPal read client."""
    return await client.get_dispute(dispute_id=dispute_id)


READ_TOOLS: dict[str, ReadToolDefinition] = {
    "list_disputes": ReadToolDefinition(
        name="list_disputes",
        description="List customer disputes from PayPal with optional status/state filters.",
        parameters_schema=ListDisputesInput.model_json_schema(),
        handler=list_disputes_tool,
    ),
    "get_dispute": ReadToolDefinition(
        name="get_dispute",
        description="Retrieve complete dispute details and evidence history by dispute ID.",
        parameters_schema=GetDisputeInput.model_json_schema(),
        handler=get_dispute_tool,
    ),
    "get_dispute_details": ReadToolDefinition(
        name="get_dispute_details",
        description="Retrieve complete dispute details (alias for get_dispute).",
        parameters_schema=GetDisputeInput.model_json_schema(),
        handler=get_dispute_tool,
    ),
}
