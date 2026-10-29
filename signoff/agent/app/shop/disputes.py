"""Buyer-side dispute management endpoints for the storefront portal.

Per Step 32:
- Order lookup validation and linked-buyer eligibility check
- Create dispute with supported reasons only and Money amount validation
- Duplicate dispute blocking for the same transaction
- Safe message handling with plain-text escaping (no markup evaluation)
- Buyer reply messages (Scenario D) and offer response (S9)
"""

import html
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Dispute, Order
from agent.app.db.session import get_db_session
from agent.app.domain.enums import DisputeStatus, OrderStatus
from agent.app.domain.money import Money
from agent.app.errors import AppError, NotFoundError
from agent.app.paypal.buyer_client import BuyerDisputeClient
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.settings import Settings

router = APIRouter(tags=["Buyer Portal Disputes"])

LINKED_SANDBOX_BUYER_EMAIL = "alex.morgan@example.test"


def _linked_buyer_email() -> str:
    return Settings().paypal_buyer_email or LINKED_SANDBOX_BUYER_EMAIL


class SupportedDisputeReason(StrEnum):
    """Dispute reasons supported by the Signoff dispute agent."""

    MERCHANDISE_OR_SERVICE_NOT_RECEIVED = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
    MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED = "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"


class DisputeMessageResponse(BaseModel):
    """Dispute communication message."""

    posted_by: str
    time_posted: datetime
    content: str


class DisputeOfferResponse(BaseModel):
    """Merchant offer details."""

    offer_type: str
    amount: Money
    note: str | None = None
    status: str | None = None


class BuyerDisputeDetailResponse(BaseModel):
    """Complete buyer-facing dispute status and history."""

    id: str
    status: str
    reason: str
    amount: Money
    created_at: datetime
    seller_response_due_date: datetime | None = None
    messages: list[DisputeMessageResponse]
    offer: DisputeOfferResponse | None = None
    order_code: str
    transaction_id: str


class OrderDisputeStatusResponse(BaseModel):
    """Dispute availability status for a customer order."""

    order_code: str
    dispute_eligible: bool
    ineligibility_reason: str | None = None
    dispute_exists: bool
    dispute: BuyerDisputeDetailResponse | None = None


class CreateDisputeRequest(BaseModel):
    """Buyer dispute filing payload."""

    model_config = ConfigDict(extra="ignore")

    customer_email: str
    reason: SupportedDisputeReason
    amount: Money
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Dispute message cannot be empty")
        return trimmed

    @field_validator("customer_email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class SendBuyerMessageRequest(BaseModel):
    """Buyer reply message payload."""

    model_config = ConfigDict(extra="ignore")

    customer_email: str
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message cannot be empty")
        return trimmed

    @field_validator("customer_email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class OfferAction(StrEnum):
    """Allowed buyer actions on a merchant offer."""

    ACCEPT = "ACCEPT"
    DENY = "DENY"


class OfferResponseRequest(BaseModel):
    """Buyer offer acceptance or rejection payload."""

    customer_email: str
    action: OfferAction

    @field_validator("customer_email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


def _ensure_utc(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.now(UTC)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _parse_messages(raw_messages: list[Any]) -> list[DisputeMessageResponse]:
    parsed: list[DisputeMessageResponse] = []
    for msg in raw_messages:
        if not isinstance(msg, dict):
            continue
        posted_by = str(msg.get("posted_by", "UNKNOWN")).upper()
        content = html.escape(str(msg.get("content", "")))
        time_raw = msg.get("time_posted")
        if isinstance(time_raw, str):
            try:
                time_posted = datetime.fromisoformat(time_raw.replace("Z", "+00:00"))
            except Exception:
                time_posted = datetime.now(UTC)
        elif isinstance(time_raw, datetime):
            time_posted = time_raw
        else:
            time_posted = datetime.now(UTC)
        parsed.append(
            DisputeMessageResponse(
                posted_by=posted_by,
                time_posted=_ensure_utc(time_posted),
                content=content,
            )
        )
    return parsed


def _parse_offer(raw_offer: Any) -> DisputeOfferResponse | None:
    if not isinstance(raw_offer, dict) or not raw_offer:
        return None
    amount_dict = raw_offer.get("amount") or raw_offer.get("buyer_requested_amount")
    if not isinstance(amount_dict, dict):
        return None
    try:
        val = Decimal(str(amount_dict.get("value", "0.00")))
        curr = str(amount_dict.get("currency_code", "USD"))
    except Exception:
        return None
    return DisputeOfferResponse(
        offer_type=str(raw_offer.get("type", "REFUND")),
        amount=Money(value=val, currency_code=curr),
        note=raw_offer.get("note"),
        status=raw_offer.get("status", "OFFERED"),
    )


def _find_dispute_for_transaction(db: Session, transaction_id: str | None) -> Dispute | None:
    if not transaction_id:
        return None
    # 1. Direct query across disputes
    disputes = list(db.scalars(select(Dispute)).all())
    for d in disputes:
        txs = (d.snapshot or {}).get("disputed_transactions", [])
        for tx in txs:
            tid = tx.get("seller_transaction_id") or tx.get("buyer_transaction_id")
            if tid == transaction_id:
                return d
    return None


def _build_dispute_response(
    dispute: Dispute, order_code: str, transaction_id: str
) -> BuyerDisputeDetailResponse:
    snapshot = dispute.snapshot or {}
    messages = _parse_messages(snapshot.get("messages", []))
    offer = _parse_offer(snapshot.get("offer"))

    return BuyerDisputeDetailResponse(
        id=dispute.id,
        status=dispute.status,
        reason=dispute.reason,
        amount=Money(value=dispute.amount, currency_code=dispute.currency),
        created_at=_ensure_utc(dispute.created_at),
        seller_response_due_date=_ensure_utc(dispute.seller_response_due_date)
        if dispute.seller_response_due_date
        else None,
        messages=messages,
        offer=offer,
        order_code=order_code,
        transaction_id=transaction_id,
    )


def _check_buyer_eligibility(order: Order, linked_email: str) -> tuple[bool, str | None]:
    """Check if the order was placed by the linked sandbox buyer account."""
    is_alex = order.customer_email.strip().lower() == linked_email.strip().lower()

    if not is_alex:
        return (
            False,
            f"This order was paid with an account other than the linked sandbox buyer ({linked_email}). "
            "PayPal dispute creation via API assertion is only enabled for the linked sandbox account. "
            "Please use the demo order shortcut to test dispute creation.",
        )
    return (True, None)


@router.get("/orders/{order_code}/dispute", response_model=OrderDisputeStatusResponse)
def get_order_dispute_status(
    order_code: str,
    email: Annotated[str, Query(description="Customer email for verification")],
    db: Annotated[Session, Depends(get_db_session)],
) -> OrderDisputeStatusResponse:
    """Check dispute eligibility and retrieve any active dispute for an order."""
    normalized_email = email.strip().lower()
    order = db.scalar(select(Order).where(Order.order_code == order_code.strip()))

    if order is None or order.customer_email.strip().lower() != normalized_email:
        raise NotFoundError("Order not found with the provided order code and email")

    # Order must be paid to be eligible for dispute
    paid_statuses = (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value)
    if order.status not in paid_statuses or not order.paypal_transaction_id:
        return OrderDisputeStatusResponse(
            order_code=order.order_code,
            dispute_eligible=False,
            ineligibility_reason="Disputes can only be filed on paid and fulfilled orders.",
            dispute_exists=False,
            dispute=None,
        )

    # Check linked sandbox buyer
    eligible, reason = _check_buyer_eligibility(order, _linked_buyer_email())
    existing_dispute = _find_dispute_for_transaction(db, order.paypal_transaction_id)

    if existing_dispute is not None:
        detail = _build_dispute_response(
            existing_dispute, order.order_code, order.paypal_transaction_id or ""
        )
        return OrderDisputeStatusResponse(
            order_code=order.order_code,
            dispute_eligible=False,
            ineligibility_reason="A dispute has already been filed for this order.",
            dispute_exists=True,
            dispute=detail,
        )

    return OrderDisputeStatusResponse(
        order_code=order.order_code,
        dispute_eligible=eligible,
        ineligibility_reason=reason,
        dispute_exists=False,
        dispute=None,
    )


@router.post("/orders/{order_code}/dispute", response_model=BuyerDisputeDetailResponse, status_code=201)
async def create_buyer_dispute(
    order_code: str,
    req: CreateDisputeRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db_session)],
) -> BuyerDisputeDetailResponse:
    """Create a new PayPal dispute for a storefront order as the buyer."""
    settings = request.app.state.settings if hasattr(request.app.state, "settings") else Settings()

    order = db.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if order is None or order.customer_email.strip().lower() != req.customer_email:
        raise NotFoundError("Order not found with the provided order code and email")

    # Status check
    paid_statuses = (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value)
    if order.status not in paid_statuses or not order.paypal_transaction_id:
        raise AppError(
            code="ORDER_NOT_PAID",
            message="Disputes can only be filed for paid orders",
            status_code=400,
        )

    # Linked sandbox buyer check
    eligible, ineligibility_reason = _check_buyer_eligibility(order, _linked_buyer_email())
    if not eligible:
        raise AppError(
            code="BUYER_NOT_LINKED",
            message=ineligibility_reason or "Dispute disabled for unlinked accounts",
            status_code=403,
        )

    # Duplicate dispute check
    existing_dispute = _find_dispute_for_transaction(db, order.paypal_transaction_id)
    if existing_dispute is not None:
        raise AppError(
            code="DISPUTE_ALREADY_EXISTS",
            message=f"A dispute ({existing_dispute.id}) already exists for this transaction.",
            status_code=409,
        )

    # Amount validation
    if req.amount.currency_code.upper() != order.currency.upper():
        raise AppError(
            code="CURRENCY_MISMATCH",
            message=f"Dispute currency {req.amount.currency_code} must match order currency {order.currency}",
            status_code=422,
        )
    if req.amount.value <= Decimal("0.00"):
        raise AppError(
            code="INVALID_AMOUNT",
            message="Dispute amount must be greater than zero",
            status_code=422,
        )
    if req.amount.value > order.amount:
        raise AppError(
            code="AMOUNT_EXCEEDS_ORDER",
            message=f"Dispute amount {req.amount.value} exceeds order total {order.amount}",
            status_code=422,
        )
    exponent = req.amount.value.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise AppError(
            code="INVALID_DECIMALS",
            message="Dispute amount cannot have more than two decimal places",
            status_code=422,
        )

    # Execute PayPal dispute creation
    client = getattr(request.app.state, "buyer_client", None)
    owns_client = client is None
    if client is None:
        client = BuyerDisputeClient()

    buyer_payer_id = settings.paypal_buyer_payer_id or f"BUYER-{order.order_code}"
    try:
        paypal_dispute = await client.create_dispute(
            reason=req.reason.value,
            amount=req.amount.value,
            currency=req.amount.currency_code,
            seller_transaction_id=order.paypal_transaction_id,
            buyer_payer_id=buyer_payer_id,
            buyer_email=order.customer_email,
            message=req.message,
        )
    finally:
        if owns_client:
            await client.close()

    # Store dispute record in database
    status_str = getattr(paypal_dispute.status, "value", str(paypal_dispute.status))
    row = Dispute(
        id=paypal_dispute.dispute_id,
        state_fingerprint=str(compute_dispute_fingerprint(paypal_dispute)),
        status=status_str,
        reason=req.reason.value,
        amount=req.amount.value,
        currency=req.amount.currency_code,
        seller_response_due_date=paypal_dispute.seller_response_due_date,
        snapshot=paypal_dispute.model_dump(mode="json"),
        demo_session_id=order.demo_session_id,
    )
    db.add(row)
    db.commit()

    return _build_dispute_response(row, order.order_code, order.paypal_transaction_id or "")


@router.post("/orders/{order_code}/dispute/messages", response_model=BuyerDisputeDetailResponse)
async def send_buyer_dispute_message(
    order_code: str,
    req: SendBuyerMessageRequest,
    db: Annotated[Session, Depends(get_db_session)],
) -> BuyerDisputeDetailResponse:
    """Send a buyer reply message on an active dispute (Scenario D)."""
    order = db.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if order is None or order.customer_email.strip().lower() != req.customer_email:
        raise NotFoundError("Order not found with the provided order code and email")

    dispute = _find_dispute_for_transaction(db, order.paypal_transaction_id)
    if dispute is None:
        raise NotFoundError("No active dispute found for this order")

    # Append to dispute messages in snapshot (passed as data, escaped on response)
    snapshot = dict(dispute.snapshot or {})
    messages = list(snapshot.get("messages", []))
    now_iso = datetime.now(UTC).isoformat()
    messages.append({
        "posted_by": "BUYER",
        "time_posted": now_iso,
        "content": req.message,
    })
    snapshot["messages"] = messages
    dispute.snapshot = snapshot
    dispute.status = DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value
    db.commit()

    return _build_dispute_response(dispute, order.order_code, order.paypal_transaction_id or "")


@router.post("/orders/{order_code}/dispute/offer-response", response_model=BuyerDisputeDetailResponse)
def respond_to_merchant_offer(
    order_code: str,
    req: OfferResponseRequest,
    db: Annotated[Session, Depends(get_db_session)],
) -> BuyerDisputeDetailResponse:
    """Buyer accepts or declines a merchant settlement offer (Scenario C / S9)."""
    order = db.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if order is None or order.customer_email.strip().lower() != req.customer_email:
        raise NotFoundError("Order not found with the provided order code and email")

    dispute = _find_dispute_for_transaction(db, order.paypal_transaction_id)
    if dispute is None:
        raise NotFoundError("No active dispute found for this order")

    snapshot = dict(dispute.snapshot or {})
    offer = dict(snapshot.get("offer", {}))

    if req.action == OfferAction.ACCEPT:
        offer["status"] = "ACCEPTED"
        dispute.status = DisputeStatus.RESOLVED.value
    else:
        offer["status"] = "DENIED"
        dispute.status = DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value

    snapshot["offer"] = offer
    dispute.snapshot = snapshot
    db.commit()

    return _build_dispute_response(dispute, order.order_code, order.paypal_transaction_id or "")
