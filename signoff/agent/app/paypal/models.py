"""Pydantic boundary models for PayPal disputes, webhooks, and OAuth tokens.

Constructed strictly from recorded PayPal sandbox fixtures. All models fail
closed on missing required fields and ignore unknown fields. Floats are forbidden
and monetary values are validated strictly as Decimals.
"""

import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
)

from agent.app.domain.enums import DisputeReason, DisputeStatus


def _parse_utc_datetime(v: Any) -> datetime | None:
    """Parse string/datetime into a timezone-aware UTC datetime.

    Rejects naive datetimes without timezone per contracts.md.
    Converts any timezone offset into UTC.
    """
    if v is None:
        return None
    if isinstance(v, datetime):
        dt = v
    elif isinstance(v, str):
        normalized = v.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError(f"Invalid ISO datetime string: {v!r}") from exc
    else:
        raise ValueError(f"Expected datetime or ISO string, got {type(v).__name__}")

    if dt.tzinfo is None:
        raise ValueError("Naive datetimes are rejected; must be timezone-aware UTC")

    return dt.astimezone(UTC)


UtcDatetime = Annotated[datetime, BeforeValidator(_parse_utc_datetime)]
OptionalUtcDatetime = Annotated[datetime | None, BeforeValidator(_parse_utc_datetime)]


class Money(BaseModel):
    """Monetary amount with ISO currency code per contracts.md.

    Amounts must arrive as strings and become Decimal. JSON floats are rejected;
    zero or negative amounts are invalid; currency must be three uppercase letters.
    """

    model_config = ConfigDict(extra="ignore")

    currency_code: str
    value: Decimal

    @field_validator("currency_code")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        if not re.match(r"^[A-Z]{3}$", v):
            raise ValueError(f"Currency code must be exactly three uppercase letters, got {v!r}")
        return v

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> Decimal:
        if isinstance(v, float):
            raise ValueError("JSON floats are rejected for money values; must be a decimal string")
        if not isinstance(v, (str, Decimal, int)):
            raise ValueError(f"Money value must arrive as a string, got {type(v).__name__}")
        if isinstance(v, int):
            dec = Decimal(str(v))
        elif isinstance(v, str):
            try:
                dec = Decimal(v)
            except InvalidOperation as exc:
                raise ValueError(f"Invalid decimal string: {v!r}") from exc
        else:
            dec = v

        if dec <= Decimal("0"):
            raise ValueError(f"Money value must be strictly positive, got {dec}")
        return dec

    @field_serializer("value", when_used="json")
    def serialize_value(self, v: Decimal) -> str:
        return f"{v:.2f}"


class Link(BaseModel):
    """HATEOAS link reference from PayPal responses."""

    model_config = ConfigDict(extra="ignore")

    href: str
    rel: str
    method: str | None = None


class BuyerInfo(BaseModel):
    """Buyer identity information from dispute transaction."""

    model_config = ConfigDict(extra="ignore")

    payer_id: str | None = None
    email: str | None = None
    name: str | None = None


class SellerInfo(BaseModel):
    """Seller/merchant identity information from dispute transaction."""

    model_config = ConfigDict(extra="ignore")

    merchant_id: str | None = None
    email: str | None = None
    name: str | None = None


class ItemInfo(BaseModel):
    """Item line in a disputed transaction."""

    model_config = ConfigDict(extra="ignore")

    item_name: str | None = None
    item_description: str | None = None
    item_quantity: str | None = None
    reason: str | None = None
    item_type: str | None = None


class DisputedTransaction(BaseModel):
    """Transaction associated with a PayPal dispute."""

    model_config = ConfigDict(extra="ignore")

    buyer_transaction_id: str
    seller_transaction_id: str | None = None
    create_time: OptionalUtcDatetime = None
    transaction_status: str | None = None
    gross_amount: Money | None = None
    buyer: BuyerInfo | None = None
    seller: SellerInfo | None = None
    items: list[ItemInfo] = Field(default_factory=list)
    seller_protection_eligible: bool | None = None
    seller_protection_type: str | None = None


class FundMovement(BaseModel):
    """Fund movement ledger entry on a dispute."""

    model_config = ConfigDict(extra="ignore")

    party: str
    amount: Money
    initiated_time: UtcDatetime
    type: str
    reason: str


class DisputeMessage(BaseModel):
    """Buyer or seller message posted to the dispute thread.

    Very long or non-English message text is preserved in full.
    """

    model_config = ConfigDict(extra="ignore")

    posted_by: str
    time_posted: UtcDatetime
    content: str


class Extensions(BaseModel):
    """Dispute metadata extensions."""

    model_config = ConfigDict(extra="ignore")

    merchant_contacted: bool | None = None
    buyer_contacted_time: OptionalUtcDatetime = None


class Evidence(BaseModel):
    """Evidence submission record attached to a dispute."""

    model_config = ConfigDict(extra="ignore")

    evidence_type: str
    source: str
    date: UtcDatetime
    notes: str | None = None
    dispute_life_cycle_stage: str | None = None


class DisputeOffer(BaseModel):
    """Settlement offer details on a dispute."""

    model_config = ConfigDict(extra="ignore")

    buyer_requested_amount: Money | None = None


class RefundDetails(BaseModel):
    """Refund limits and eligibility for a dispute."""

    model_config = ConfigDict(extra="ignore")

    allowed_refund_amount: Money | None = None


class AcceptClaimOption(BaseModel):
    """Allowed options for accepting a dispute claim."""

    model_config = ConfigDict(extra="ignore")

    accept_claim_types: list[str] = Field(default_factory=list)


class MakeOfferOption(BaseModel):
    """Allowed options for making a dispute offer."""

    model_config = ConfigDict(extra="ignore")

    offer_types: list[str] = Field(default_factory=list)


class AllowedResponseOptions(BaseModel):
    """Action response options currently permitted by PayPal.

    If absent or missing on a dispute, defaults to empty options (gate will deny)
    rather than crashing.
    """

    model_config = ConfigDict(extra="ignore")

    accept_claim: AcceptClaimOption | None = None
    make_offer: MakeOfferOption | None = None

    @property
    def is_empty(self) -> bool:
        has_claim = bool(self.accept_claim and self.accept_claim.accept_claim_types)
        has_offer = bool(self.make_offer and self.make_offer.offer_types)
        return not (has_claim or has_offer)


class Dispute(BaseModel):
    """Complete PayPal dispute entity (e.g. from GET /v1/customer/disputes/{id})."""

    model_config = ConfigDict(extra="ignore")

    dispute_id: str
    create_time: UtcDatetime
    update_time: UtcDatetime
    disputed_transactions: list[DisputedTransaction] = Field(default_factory=list)
    reason: DisputeReason | str
    status: DisputeStatus | str
    dispute_amount: Money
    dispute_state: str
    fund_movements: list[FundMovement] = Field(default_factory=list)
    dispute_life_cycle_stage: str
    dispute_channel: str
    messages: list[DisputeMessage] = Field(default_factory=list)
    extensions: Extensions | None = None
    evidences: list[Evidence] = Field(default_factory=list)
    seller_response_due_date: OptionalUtcDatetime = None
    offer: DisputeOffer | None = None
    refund_details: RefundDetails | None = None
    allowed_response_options: AllowedResponseOptions = Field(default_factory=AllowedResponseOptions)
    links: list[Link] = Field(default_factory=list)

    @field_validator("allowed_response_options", mode="before")
    @classmethod
    def default_empty_response_options(cls, v: Any) -> Any:
        if v is None:
            return {}
        return v


class DisputeSummary(BaseModel):
    """Dispute item summary as returned by GET /v1/customer/disputes (list)."""

    model_config = ConfigDict(extra="ignore")

    dispute_id: str
    create_time: UtcDatetime
    update_time: UtcDatetime
    disputed_transactions: list[DisputedTransaction] = Field(default_factory=list)
    reason: DisputeReason | str
    status: DisputeStatus | str
    dispute_state: str
    dispute_amount: Money
    dispute_life_cycle_stage: str
    dispute_channel: str
    seller_response_due_date: OptionalUtcDatetime = None
    links: list[Link] = Field(default_factory=list)


class DisputeListResponse(BaseModel):
    """Paginated list response from GET /v1/customer/disputes."""

    model_config = ConfigDict(extra="ignore")

    items: list[DisputeSummary] = Field(default_factory=list)
    links: list[Link] = Field(default_factory=list)


class ProvideEvidenceResponse(BaseModel):
    """Response returned by POST .../provide-evidence."""

    model_config = ConfigDict(extra="ignore")

    links: list[Link] = Field(default_factory=list)


class TokenResponse(BaseModel):
    """OAuth2 client credentials token response."""

    model_config = ConfigDict(extra="ignore")

    access_token: str
    token_type: str
    expires_in: int
    scope: str | None = None
    app_id: str | None = None
    nonce: str | None = None


OAuthTokenResponse = TokenResponse


class WebhookEvent(BaseModel):
    """Incoming PayPal webhook event notification envelope."""

    model_config = ConfigDict(extra="ignore")

    id: str
    create_time: UtcDatetime
    resource_type: str
    event_type: str
    event_version: str | None = None
    summary: str | None = None
    resource: Dispute | DisputeSummary | dict[str, Any] | None = None
    links: list[Link] = Field(default_factory=list)


def parse_dispute(data: dict[str, Any] | str | bytes) -> Dispute:
    """Parse PayPal dispute payload failing closed on missing required fields.

    Ignores unknown fields per PayPal schema evolution conventions.
    """
    if isinstance(data, (str, bytes)):
        return Dispute.model_validate_json(data)
    if isinstance(data, dict):
        return Dispute.model_validate(data)
    raise TypeError(f"Expected dict, str, or bytes, got {type(data).__name__}")


def parse_dispute_summary(data: dict[str, Any] | str | bytes) -> DisputeSummary:
    """Parse PayPal dispute summary item failing closed on missing required fields."""
    if isinstance(data, (str, bytes)):
        return DisputeSummary.model_validate_json(data)
    if isinstance(data, dict):
        return DisputeSummary.model_validate(data)
    raise TypeError(f"Expected dict, str, or bytes, got {type(data).__name__}")


def parse_dispute_list(data: dict[str, Any] | str | bytes) -> DisputeListResponse:
    """Parse paginated dispute list response."""
    if isinstance(data, (str, bytes)):
        return DisputeListResponse.model_validate_json(data)
    if isinstance(data, dict):
        return DisputeListResponse.model_validate(data)
    raise TypeError(f"Expected dict, str, or bytes, got {type(data).__name__}")


def parse_provide_evidence_response(data: dict[str, Any] | str | bytes) -> ProvideEvidenceResponse:
    """Parse provide evidence response."""
    if isinstance(data, (str, bytes)):
        return ProvideEvidenceResponse.model_validate_json(data)
    if isinstance(data, dict):
        return ProvideEvidenceResponse.model_validate(data)
    raise TypeError(f"Expected dict, str, or bytes, got {type(data).__name__}")


def parse_token_response(data: dict[str, Any] | str | bytes) -> TokenResponse:
    """Parse OAuth token response."""
    if isinstance(data, (str, bytes)):
        return TokenResponse.model_validate_json(data)
    if isinstance(data, dict):
        return TokenResponse.model_validate(data)
    raise TypeError(f"Expected dict, str, or bytes, got {type(data).__name__}")


def parse_webhook_event(data: dict[str, Any] | str | bytes) -> WebhookEvent:
    """Parse incoming webhook event envelope."""
    if isinstance(data, (str, bytes)):
        return WebhookEvent.model_validate_json(data)
    if isinstance(data, dict):
        return WebhookEvent.model_validate(data)
    raise TypeError(f"Expected dict, str, or bytes, got {type(data).__name__}")
