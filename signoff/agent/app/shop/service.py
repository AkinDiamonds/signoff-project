"""Shop domain service: order creation, server-side pricing, capture, tracking, and reconciliation."""

import secrets
import string
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.domain.money import Money
from agent.app.errors import AppError, NotFoundError
from agent.app.paypal.orders_client import PayPalOrdersClient
from agent.app.shop.catalog import get_product
from agent.app.shop.schemas import (
    CaptureOrderRequest,
    CaptureOrderResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    OrderDetailResponse,
    OrderItemResponse,
    TrackingEventResponse,
)
from agent.app.store_mock.scenarios import MOCK_MERCHANT_ID

PENDING_EXPIRY_SECONDS = 1800  # 30 minutes


def _generate_order_code() -> str:
    """Generate deterministic-length 10-character uppercase alphanumeric order code."""
    alphabet = string.ascii_uppercase + string.digits
    # Exclude ambiguous characters
    safe_alphabet = [c for c in alphabet if c not in ("O", "0", "I", "1")]
    suffix = "".join(secrets.choice(safe_alphabet) for _ in range(7))
    return f"SIG{suffix}"


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


async def create_shop_order(
    session: Session,
    req: CreateOrderRequest,
    orders_client: PayPalOrdersClient,
) -> CreateOrderResponse:
    """Create a new shop order with server-computed prices and record intent before calling PayPal."""
    normalized_email = req.customer_email.strip().lower()

    # 1. Server-side total calculation: ignore client-sent prices, reject unknown products
    total_amount = Decimal("0.00")
    order_items_payload = []

    for item in req.items:
        product = get_product(session, item.sku)
        if product is None:
            raise NotFoundError(f"Product with SKU '{item.sku}' not found in catalog")
        line_total = product.price * Decimal(item.quantity)
        total_amount += line_total
        order_items_payload.append(
            {
                "sku": product.sku,
                "name": product.name,
                "quantity": item.quantity,
                "unit_price": f"{product.price:.2f}",
            }
        )

    order_code = _generate_order_code()

    # 2. Record intent in DB before calling PayPal (flush only, do not commit yet)
    order = Order(
        order_code=order_code,
        merchant_id=MOCK_MERCHANT_ID,
        customer_email=normalized_email,
        amount=total_amount,
        currency="USD",
        status=OrderStatus.PENDING.value,
        items=order_items_payload,
        demo_session_id=req.demo_session_id,
        created_at=datetime.now(UTC),
    )
    session.add(order)
    session.flush()  # assigns PK without committing; allows rollback if PayPal fails

    # 3. Call PayPal to create order
    try:
        paypal_order = await orders_client.create_order(
            amount=total_amount,
            currency="USD",
            reference_id=order_code,
            description="Signoff Candle Order",
        )
    except Exception:
        session.rollback()  # discards the flushed-but-uncommitted intent row
        raise

    paypal_order_id = paypal_order.get("id", "")
    # Record PayPal order ID in items payload for reconciliation. Reassign a new list:
    # SQLAlchemy does not track in-place mutation of an already-flushed JSON value.
    order.items = [{**order_items_payload[0], "paypal_order_id": paypal_order_id}, *order_items_payload[1:]]
    session.commit()

    return CreateOrderResponse(
        order_code=order_code,
        paypal_order_id=paypal_order_id,
        amount=Money(value=total_amount, currency_code="USD"),
        status=OrderStatus.PENDING.value,
    )


async def capture_shop_order(
    session: Session,
    order_code: str,
    req: CaptureOrderRequest | None,
    orders_client: PayPalOrdersClient,
) -> CaptureOrderResponse:
    """Capture payment for an approved order. Idempotent on double capture."""
    order = session.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if order is None:
        raise NotFoundError(f"Order '{order_code}' not found")

    # Idempotent return on double capture
    if order.status in (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value):
        tracking = session.scalar(select(TrackingEvent).where(TrackingEvent.order_id == order.id))
        return CaptureOrderResponse(
            order_code=order.order_code,
            paypal_transaction_id=order.paypal_transaction_id or "",
            status=order.status,
            carrier=tracking.carrier if tracking else None,
            tracking_number=tracking.tracking_number if tracking else None,
        )

    if order.status == OrderStatus.CANCELLED.value:
        raise AppError("ORDER_CANCELLED", "Cannot capture an expired or cancelled order", status_code=409)

    # Determine PayPal order ID
    paypal_order_id: str | None = None
    if req and req.paypal_order_id:
        paypal_order_id = req.paypal_order_id
    elif order.items and isinstance(order.items, list) and len(order.items) > 0 and isinstance(order.items[0], dict):
        raw_id = order.items[0].get("paypal_order_id")
        if isinstance(raw_id, str):
            paypal_order_id = raw_id

    if not paypal_order_id:
        raise AppError(
            "MISSING_PAYPAL_ORDER_ID",
            "PayPal order ID could not be determined for capture",
            status_code=422,
        )

    # Call PayPal capture
    paypal_data = await orders_client.capture_order(paypal_order_id)

    # Verify captured amount against expected total
    purchase_units = paypal_data.get("purchase_units", [])
    captures = purchase_units[0].get("payments", {}).get("captures", []) if purchase_units else []
    if captures:
        captured_str = captures[0].get("amount", {}).get("value", "0.00")
        captured_val = Decimal(captured_str)
        capture_id = captures[0].get("id", f"STUB-CAPTURE-{order_code}")
    else:
        captured_val = order.amount
        capture_id = f"STUB-CAPTURE-{order_code}"

    if captured_val != order.amount:
        # Amount differs from expected: flag order, nothing shipped
        order.status = OrderStatus.PENDING.value
        if order.items and isinstance(order.items[0], dict):
            order.items = [{**order.items[0], "amount_mismatch_flag": True}, *order.items[1:]]
        session.commit()
        raise AppError(
            "AMOUNT_MISMATCH",
            f"Captured amount {captured_val} differs from expected order amount {order.amount}",
            status_code=422,
        )

    # Mark as PAID and schedule mock tracking according to scenario rules
    order.paypal_transaction_id = capture_id
    order.status = OrderStatus.PAID.value

    carrier = "UPS"
    tracking_number = f"1Z999AA10{order.order_code}"
    event = TrackingEvent(
        order_id=order.id,
        carrier=carrier,
        tracking_number=tracking_number,
        status=TrackingStatus.IN_TRANSIT.value,
        event_time=datetime.now(UTC),
        payload={"note": "Package received at origin facility; scheduled for ground transport."},
    )
    session.add(event)
    session.commit()

    return CaptureOrderResponse(
        order_code=order.order_code,
        paypal_transaction_id=capture_id,
        status=order.status,
        carrier=carrier,
        tracking_number=tracking_number,
    )


def get_buyer_order(
    session: Session,
    order_code: str,
    email: str,
) -> OrderDetailResponse:
    """Retrieve order details for a buyer.
    
    Uniform failure error on both missing order and email mismatch to prevent enumeration.
    Pending orders older than 30 minutes expire automatically.
    """
    normalized_email = email.strip().lower()
    order = session.scalar(select(Order).where(Order.order_code == order_code.strip()))

    # Uniform error response
    if order is None or order.customer_email.strip().lower() != normalized_email:
        raise NotFoundError("Order not found with the provided order code and email")

    # Expire old pending orders
    now = datetime.now(UTC)
    created = _ensure_utc(order.created_at)
    if order.status == OrderStatus.PENDING.value and (now - created).total_seconds() > PENDING_EXPIRY_SECONDS:
        order.status = OrderStatus.CANCELLED.value
        session.commit()

    events = list(
        session.scalars(
            select(TrackingEvent).where(TrackingEvent.order_id == order.id).order_by(TrackingEvent.event_time)
        ).all()
    )

    items_response = [
        OrderItemResponse(
            sku=str(item.get("sku", "")),
            name=str(item.get("name", "")),
            quantity=int(item.get("quantity", 1)),
            unit_price=str(item.get("unit_price", "0.00")),
        )
        for item in (order.items or [])
        if isinstance(item, dict)
    ]

    tracking_response = [
        TrackingEventResponse(
            carrier=ev.carrier,
            tracking_number=ev.tracking_number,
            status=ev.status,
            event_time=_ensure_utc(ev.event_time),
        )
        for ev in events
    ]

    return OrderDetailResponse(
        order_code=order.order_code,
        status=order.status,
        customer_email=order.customer_email,
        amount=Money(value=order.amount, currency_code=order.currency),
        items=items_response,
        tracking_events=tracking_response,
        created_at=created,
    )


async def reconcile_order(
    session: Session,
    order_code: str,
    orders_client: PayPalOrdersClient,
) -> Order:
    """Recover local state if PayPal capture succeeded but local write failed."""
    order = session.scalar(select(Order).where(Order.order_code == order_code.strip()))
    if order is None:
        raise NotFoundError(f"Order '{order_code}' not found")

    resolved_statuses = (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value)
    if order.status in resolved_statuses and order.paypal_transaction_id:
        return order

    paypal_order_id: str | None = None
    if order.items and isinstance(order.items, list) and len(order.items) > 0 and isinstance(order.items[0], dict):
        raw_id = order.items[0].get("paypal_order_id")
        if isinstance(raw_id, str):
            paypal_order_id = raw_id

    if not paypal_order_id:
        return order

    try:
        paypal_order = await orders_client.get_order(paypal_order_id)
    except Exception:
        return order

    if paypal_order.get("status") == "COMPLETED":
        purchase_units = paypal_order.get("purchase_units", [])
        captures = purchase_units[0].get("payments", {}).get("captures", []) if purchase_units else []
        if captures:
            captured_val = Decimal(captures[0]["amount"]["value"])
            capture_id = captures[0]["id"]
            if captured_val == order.amount:
                order.paypal_transaction_id = capture_id
                order.status = OrderStatus.PAID.value

                existing_tracking = session.scalar(
                    select(TrackingEvent.id).where(TrackingEvent.order_id == order.id)
                )
                if not existing_tracking:
                    session.add(
                        TrackingEvent(
                            order_id=order.id,
                            carrier="UPS",
                            tracking_number=f"1Z999AA10{order.order_code}",
                            status=TrackingStatus.IN_TRANSIT.value,
                            event_time=datetime.now(UTC),
                        )
                    )
                session.commit()

    return order
