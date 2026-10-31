"""Store read-only API endpoints for order evidence and policies.

Per 06-judge-flow.md Part A:
- GET /api/store/orders/by-transaction/{transaction_id}
- GET /api/store/orders/{order_code}/shipments
- GET /api/store/orders/{order_code}/messages
- GET /api/store/policies
Protected by X-Store-Key matching Settings.store_api_key. Read-only.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.db.session import get_db_session
from agent.app.errors import AppError, NotFoundError
from agent.app.settings import Settings
from agent.app.shop.disputes import _find_dispute_for_transaction
from agent.app.store.base import StoreAmbiguous
from agent.app.store_mock.repository import find_order_by_paypal_transaction_id


def _ensure_utc(dt: Any) -> datetime:
    if dt is None:
        return datetime.now(UTC)
    if isinstance(dt, str):
        try:
            return datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return datetime.now(UTC)
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    return datetime.now(UTC)


def verify_store_key(
    request: Request,
    x_store_key: Annotated[str | None, Header(alias="X-Store-Key")] = None,
) -> None:
    """Validate X-Store-Key matches configured STORE_API_KEY."""
    settings = getattr(request.app.state, "settings", None) or Settings()
    expected_key = getattr(settings, "store_api_key", "")
    if not expected_key or not x_store_key or x_store_key != expected_key:
        raise AppError(
            code="UNAUTHORIZED",
            message="Invalid or missing X-Store-Key header",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


router = APIRouter(prefix="/api/store", tags=["Store"], dependencies=[Depends(verify_store_key)])


class StoreOrderResponse(BaseModel):
    """Store customer order details."""

    model_config = ConfigDict(from_attributes=True)

    order_code: str
    customer_email: str
    amount: Decimal
    currency: str
    status: str
    created_at: datetime
    items: list[Any]


class ShipmentResponse(BaseModel):
    """Tracking and delivery milestone event."""

    model_config = ConfigDict(from_attributes=True)

    carrier: str
    tracking_number: str
    status: str
    event_time: datetime
    payload: dict[str, Any] | None = None


class StoreMessageResponse(BaseModel):
    """Buyer dispute message."""

    model_config = ConfigDict(from_attributes=True)

    posted_by: str
    time_posted: datetime
    content: str


class StorePoliciesResponse(BaseModel):
    """Static merchant store policies."""

    return_window_days: int = 30
    refund_window_days: int = 30
    shipping_policy: str = "Orders are shipped within 1-2 business days via standard tracked carriers."
    return_policy: str = "Items must be returned in original condition within 30 days of delivery."
    cancellation_policy: str = "Orders may be cancelled before shipment tracking is generated."


STATIC_POLICIES = StorePoliciesResponse()


@router.get("/orders/by-transaction/{transaction_id}", response_model=StoreOrderResponse)
def get_order_by_transaction(
    transaction_id: str,
    db: Annotated[Session, Depends(get_db_session)],
) -> StoreOrderResponse:
    """Retrieve an order by PayPal transaction ID."""
    try:
        order = find_order_by_paypal_transaction_id(db, transaction_id)
    except StoreAmbiguous:
        raise AppError("ORDER_AMBIGUOUS", "Multiple orders match this payment reference", status_code=409) from None
    if not order:
        raise NotFoundError(f"No order found for transaction ID '{transaction_id}'")
    return StoreOrderResponse(
        order_code=order.order_code,
        customer_email=order.customer_email,
        amount=order.amount,
        currency=order.currency,
        status=order.status,
        created_at=_ensure_utc(order.created_at),
        items=order.items or [],
    )


@router.get("/orders/{order_code}/shipments", response_model=list[ShipmentResponse])
def get_order_shipments(
    order_code: str,
    db: Annotated[Session, Depends(get_db_session)],
) -> list[ShipmentResponse]:
    """Retrieve shipment tracking events for an order ordered by event_time."""
    order = db.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if not order:
        raise NotFoundError(f"No order found for order code '{order_code}'")

    events = list(
        db.scalars(
            select(TrackingEvent)
            .where(TrackingEvent.order_id == order.id)
            .order_by(TrackingEvent.event_time.asc())
        ).all()
    )
    return [
        ShipmentResponse(
            carrier=ev.carrier,
            tracking_number=ev.tracking_number,
            status=ev.status,
            event_time=_ensure_utc(ev.event_time),
            payload=ev.payload,
        )
        for ev in events
    ]


@router.get("/orders/{order_code}/messages", response_model=list[StoreMessageResponse])
def get_order_messages(
    order_code: str,
    db: Annotated[Session, Depends(get_db_session)],
) -> list[StoreMessageResponse]:
    """Retrieve buyer messages for an order from dispute records, or empty list if none."""
    order = db.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if not order or not order.paypal_transaction_id:
        return []

    dispute = _find_dispute_for_transaction(db, order.paypal_transaction_id)
    if not dispute or not dispute.snapshot:
        return []

    raw_msgs = dispute.snapshot.get("messages", [])
    result: list[StoreMessageResponse] = []
    for m in raw_msgs:
        if not isinstance(m, dict):
            continue
        posted_by = str(m.get("posted_by", "BUYER")).upper()
        if posted_by == "BUYER":
            result.append(
                StoreMessageResponse(
                    posted_by=posted_by,
                    time_posted=_ensure_utc(m.get("time_posted")),
                    content=str(m.get("content", "")),
                )
            )
    return result


@router.get("/policies", response_model=StorePoliciesResponse)
def get_policies() -> StorePoliciesResponse:
    """Return static merchant policies."""
    return STATIC_POLICIES
