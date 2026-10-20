"""Schemas for merchant approval cards and resolution requests.

Per Step 19 and types-testing catalog:
- ResolveRequest is a union: APPROVE, DENY (with optional reason), EDIT (with amount and/or message).
- Unknown fields are forbidden.
- Money is formatted as { "value": str, "currency_code": str }.
"""

from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

from agent.app.agent.schemas import ActionMoneySchema
from agent.app.domain.enums import ActionType, ApprovalResolution, Verdict


class ApproveResolveRequest(BaseModel):
    """Approve the proposed action through executor waiver rules."""

    model_config = ConfigDict(extra="forbid")

    action: Literal["APPROVE"] = "APPROVE"
    notes: str | None = Field(default=None, description="Optional merchant audit notes")


class DenyResolveRequest(BaseModel):
    """Deny the proposed action, recording decision and taking no further action."""

    model_config = ConfigDict(extra="forbid")

    action: Literal["DENY"] = "DENY"
    reason: str | None = Field(default=None, description="Merchant reason for denial")
    notes: str | None = Field(default=None, description="Optional merchant audit notes")


class EditResolveRequest(BaseModel):
    """Edit amount and/or message and re-run gate evaluation."""

    model_config = ConfigDict(extra="forbid")

    action: Literal["EDIT"] = "EDIT"
    amount: ActionMoneySchema | None = Field(default=None, description="Edited monetary amount")
    message: str | None = Field(default=None, description="Edited message content")
    notes: str | None = Field(default=None, description="Optional merchant audit notes")

    @model_validator(mode="after")
    def validate_has_at_least_one_field(self) -> "EditResolveRequest":
        if self.amount is None and not self.message:
            raise ValueError("Edit action requires at least one of 'amount' or 'message' to be provided.")
        return self


# Discriminated union matching api-client ResolveRequest
ResolveRequest = Annotated[
    ApproveResolveRequest | DenyResolveRequest | EditResolveRequest,
    Field(discriminator="action"),
]


class DisputeCardSummary(BaseModel):
    """Dispute context snapshot for human review card."""

    id: str
    amount: ActionMoneySchema
    reason: str
    status: str
    seller_response_due_date: str | None = None
    buyer_message: str | None = None


class ApprovalCardResponse(BaseModel):
    """Merchant approval card details returned by GET /api/approvals/{token}."""

    id: str
    decision_id: str
    dispute_id: str
    token_hash: str
    payload_hash: str
    action_type: ActionType
    action_payload: dict[str, Any]
    verdict: Verdict
    rule_id: str
    reason: str
    expires_at: str
    resolution: ApprovalResolution
    notes: str | None = None
    dispute: DisputeCardSummary
    created_at: str
    resolved_at: str | None = None


class ResolveResponse(BaseModel):
    """Outcome of resolving an approval card."""

    status: str = "resolved"
    resolution: str
    approval_id: str
    dispute_id: str
    decision_id: str | None = None
    executed: bool = False
