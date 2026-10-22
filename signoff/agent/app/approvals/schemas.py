"""Schemas for merchant approval cards and resolution requests.

Per Step 19 and types-testing catalog:
- ResolveRequest is a union: APPROVE, DENY (with optional reason), EDIT (with amount and/or message).
- Unknown fields are forbidden.
- Money is formatted as { "value": str, "currency_code": str }.
"""

import re
import uuid
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from agent.app.domain.enums import ActionType, ApprovalResolution, Verdict


class EditMoneySchema(BaseModel):
    """Money amount submitted on an approval edit.

    Unlike the LLM-facing schema in ``agent.app.agent.schemas``, this one keeps the
    raw decimal string and does not enforce a positive value. Approving a human edit
    is a domain decision, so the service validates positivity, precision and the
    disputed-amount ceiling and reports each violation as a 422 ``EditValidationError``.
    """

    model_config = ConfigDict(extra="forbid")

    currency_code: str = Field(default="USD", description="3-letter ISO currency code")
    value: str = Field(..., description="Decimal string representation of the amount, e.g. '25.00'")

    @field_validator("currency_code")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(r"^[A-Z]{3}$", clean):
            raise ValueError(f"Currency code must be exactly three uppercase letters, got {v!r}")
        return clean

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> str:
        if isinstance(v, float):
            raise ValueError("JSON floats are rejected for money values; must be a decimal string")
        if isinstance(v, (int, Decimal)):
            v = str(v)
        if not isinstance(v, str):
            raise ValueError(f"Money value must arrive as a decimal string, got {type(v).__name__}")
        raw = v.strip()
        try:
            parsed = Decimal(raw)
        except InvalidOperation as exc:
            raise ValueError(f"Invalid decimal string: {v!r}") from exc
        if not parsed.is_finite():
            raise ValueError(f"Money value must be finite, got {parsed}")
        return raw


# Historical name used by callers of this module.
ActionMoneySchema = EditMoneySchema


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
    amount: EditMoneySchema | None = Field(default=None, description="Edited monetary amount")
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
    amount: EditMoneySchema
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
    # UUID of the persisted decision, so callers can look it up directly.
    # Serialized as a string by Pydantic/FastAPI.
    decision_id: uuid.UUID | None = None
    executed: bool = False
