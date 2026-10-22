"""Proposed actions domain models and discriminated union.

Per build-plan/contracts.md and plan/03-gate-spec.md:
ProposedAction = discriminated union:
  ProvideEvidence | SendMessage | MakeOffer(amount) | AcceptClaim(amount?) | Escalate | Appeal
"""

import hashlib
import json
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from agent.app.domain.enums import ActionType
from agent.app.domain.money import Money


class BaseProposedAction(BaseModel):
    """Base model for all proposed actions with strict validation."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    action_type: ActionType


class ProvideEvidence(BaseProposedAction):
    """Action proposing to provide dispute evidence to PayPal."""

    action_type: Literal[ActionType.PROVIDE_EVIDENCE] = ActionType.PROVIDE_EVIDENCE
    evidence_type: str | None = None
    notes: str | None = None
    documents: tuple[dict[str, Any], ...] = Field(default_factory=tuple)
    tracking_info: tuple[dict[str, Any], ...] = Field(default_factory=tuple)


class SendMessage(BaseProposedAction):
    """Action proposing to send a message to the buyer via PayPal."""

    action_type: Literal[ActionType.SEND_MESSAGE] = ActionType.SEND_MESSAGE
    message: str


class MakeOffer(BaseProposedAction):
    """Action proposing a settlement offer (e.g. refund)."""

    action_type: Literal[ActionType.MAKE_OFFER] = ActionType.MAKE_OFFER
    amount: Money
    offer_type: str = "REFUND"
    note: str | None = None


class AcceptClaim(BaseProposedAction):
    """Action proposing to accept the buyer's claim."""

    action_type: Literal[ActionType.ACCEPT_CLAIM] = ActionType.ACCEPT_CLAIM
    amount: Money | None = None
    accept_claim_type: str = "REFUND"
    note: str | None = None


class Escalate(BaseProposedAction):
    """Action proposing to escalate the dispute to a PayPal claim."""

    action_type: Literal[ActionType.ESCALATE] = ActionType.ESCALATE
    note: str | None = None


class Appeal(BaseProposedAction):
    """Action proposing to appeal a resolved dispute."""

    action_type: Literal[ActionType.APPEAL] = ActionType.APPEAL
    note: str | None = None


# Descriptive aliases matching spec conventions
ProvideEvidenceAction = ProvideEvidence
SendMessageAction = SendMessage
MakeOfferAction = MakeOffer
AcceptClaimAction = AcceptClaim
EscalateAction = Escalate
AppealAction = Appeal

ProposedAction = Annotated[
    ProvideEvidence | SendMessage | MakeOffer | AcceptClaim | Escalate | Appeal,
    Field(discriminator="action_type"),
]


def _serialize_for_hash(val: Any) -> Any:
    """Helper to convert values into JSON-serializable primitives for hashing."""
    if isinstance(val, BaseModel):
        return _serialize_for_hash(val.model_dump(mode="python"))
    if isinstance(val, Decimal):
        return f"{val:.2f}"
    if isinstance(val, dict):
        return {k: _serialize_for_hash(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_serialize_for_hash(item) for item in val]
    return val


def compute_action_hash(action: Any) -> str:
    """Compute deterministic SHA-256 hash of a proposed action."""
    if hasattr(action, "model_dump"):
        raw_dict = action.model_dump(mode="python")
    elif isinstance(action, dict):
        raw_dict = dict(action)
    else:
        raw_dict = {"repr": repr(action)}

    payload = _serialize_for_hash(raw_dict)
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def parse_action_from_stored(
    action_type: str,
    action_payload: dict[str, Any] | None,
) -> ProposedAction:
    """Reconstruct domain ProposedAction from stored action_type and payload."""
    payload = dict(action_payload or {})
    payload["action_type"] = action_type

    if "amount" in payload and isinstance(payload["amount"], dict):
        amt_dict = payload["amount"]
        payload["amount"] = Money(
            currency_code=amt_dict.get("currency_code", "USD"),
            value=Decimal(str(amt_dict.get("value", "0.00"))),
        )

    val = action_type.value if hasattr(action_type, "value") else str(action_type)
    if val == ActionType.PROVIDE_EVIDENCE.value:
        return ProvideEvidence.model_validate(payload)
    if val == ActionType.SEND_MESSAGE.value:
        return SendMessage.model_validate(payload)
    if val == ActionType.MAKE_OFFER.value:
        return MakeOffer.model_validate(payload)
    if val == ActionType.ACCEPT_CLAIM.value:
        return AcceptClaim.model_validate(payload)
    if val == ActionType.ESCALATE.value:
        return Escalate.model_validate(payload)
    if val == ActionType.APPEAL.value:
        return Appeal.model_validate(payload)

    raise ValueError(f"Unknown action type: {action_type}")

