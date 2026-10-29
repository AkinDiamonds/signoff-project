"""Plan and action schemas for agent LLM output validation.

Per Step 17 and CONVENTIONS:
- Unknown action types are rejected by the schema.
- Amounts are decimal strings.
- All schemas forbid extra fields (model_config = ConfigDict(extra="forbid")).
"""

import re
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from agent.app.domain.actions import (
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProvideEvidence,
    SendMessage,
)
from agent.app.domain.enums import ActionType
from agent.app.domain.money import Money


class ActionMoneySchema(BaseModel):
    """Monetary amount schema for LLM outputs requiring decimal string values."""

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
        if isinstance(v, int):
            d = Decimal(str(v))
        elif isinstance(v, str):
            try:
                d = Decimal(v.strip())
            except InvalidOperation as exc:
                raise ValueError(f"Invalid decimal string: {v!r}") from exc
        elif isinstance(v, Decimal):
            d = v
        else:
            raise ValueError(f"Money value must arrive as a decimal string, got {type(v).__name__}")

        if not d.is_finite():
            raise ValueError(f"Money value must be finite, got {d}")
        if d <= Decimal("0"):
            raise ValueError(f"Money value must be strictly positive, got {d}")

        return f"{d:.2f}"

    def to_domain(self) -> Money:
        return Money(currency_code=self.currency_code, value=Decimal(self.value))


class ProvideEvidenceActionSchema(BaseModel):
    """Action proposing to provide dispute evidence."""

    model_config = ConfigDict(extra="forbid")

    action_type: Literal[ActionType.PROVIDE_EVIDENCE, "PROVIDE_EVIDENCE"] = ActionType.PROVIDE_EVIDENCE
    evidence_type: str | None = None
    notes: str | None = None
    documents: tuple[dict[str, Any], ...] = Field(default_factory=tuple)
    tracking_info: tuple[dict[str, Any], ...] = Field(default_factory=tuple)

    def to_domain(self) -> ProvideEvidence:
        return ProvideEvidence(
            action_type=ActionType.PROVIDE_EVIDENCE,
            evidence_type=self.evidence_type,
            notes=self.notes,
            documents=self.documents,
            tracking_info=self.tracking_info,
        )


class SendMessageActionSchema(BaseModel):
    """Action proposing to send a message to the buyer."""

    model_config = ConfigDict(extra="forbid")

    action_type: Literal[ActionType.SEND_MESSAGE, "SEND_MESSAGE"] = ActionType.SEND_MESSAGE
    message: str | None = None
    detail: str | None = None

    @model_validator(mode="after")
    def populate_message(self) -> "SendMessageActionSchema":
        if not self.message and self.detail:
            self.message = self.detail
        if not self.message:
            raise ValueError("Either message or detail must be provided")
        return self

    def to_domain(self) -> SendMessage:
        return SendMessage(
            action_type=ActionType.SEND_MESSAGE,
            message=self.message or "",
        )


class MakeOfferActionSchema(BaseModel):
    """Action proposing a settlement offer."""

    model_config = ConfigDict(extra="forbid")

    action_type: Literal[ActionType.MAKE_OFFER, "MAKE_OFFER"] = ActionType.MAKE_OFFER
    amount: ActionMoneySchema
    offer_type: str = "REFUND"
    note: str | None = None

    def to_domain(self) -> MakeOffer:
        return MakeOffer(
            action_type=ActionType.MAKE_OFFER,
            amount=self.amount.to_domain(),
            offer_type=self.offer_type,
            note=self.note,
        )


class AcceptClaimActionSchema(BaseModel):
    """Action proposing to accept the buyer claim."""

    model_config = ConfigDict(extra="forbid")

    action_type: Literal[ActionType.ACCEPT_CLAIM, "ACCEPT_CLAIM"] = ActionType.ACCEPT_CLAIM
    amount: ActionMoneySchema | None = None
    accept_claim_type: str = "REFUND"
    note: str | None = None

    def to_domain(self) -> AcceptClaim:
        return AcceptClaim(
            action_type=ActionType.ACCEPT_CLAIM,
            amount=self.amount.to_domain() if self.amount else None,
            accept_claim_type=self.accept_claim_type,
            note=self.note,
        )


class EscalateActionSchema(BaseModel):
    """Action proposing dispute escalation."""

    model_config = ConfigDict(extra="forbid")

    action_type: Literal[ActionType.ESCALATE, "ESCALATE"] = ActionType.ESCALATE
    note: str | None = None

    def to_domain(self) -> Escalate:
        return Escalate(action_type=ActionType.ESCALATE, note=self.note)


class AppealActionSchema(BaseModel):
    """Action proposing dispute appeal."""

    model_config = ConfigDict(extra="forbid")

    action_type: Literal[ActionType.APPEAL, "APPEAL"] = ActionType.APPEAL
    note: str | None = None

    def to_domain(self) -> Appeal:
        return Appeal(action_type=ActionType.APPEAL, note=self.note)


AgentActionSchema = Annotated[
    ProvideEvidenceActionSchema
    | SendMessageActionSchema
    | MakeOfferActionSchema
    | AcceptClaimActionSchema
    | EscalateActionSchema
    | AppealActionSchema,
    Field(discriminator="action_type"),
]


class AgentPlan(BaseModel):
    """LLM proposed plan schema. Forbids extra fields and enforces strict action typing."""

    model_config = ConfigDict(extra="forbid")

    actions: list[AgentActionSchema] = Field(default_factory=list)
