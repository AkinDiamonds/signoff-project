"""Shop domain service: order creation, server-side pricing, capture, tracking, and reconciliation."""

import secrets
import string
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.domain.money import Money
from agent.app.errors import AppError, NotFoundError
from agent.app.paypal.orders_client import PayPalOrdersClient
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.shop.catalog import get_product
from agent.app.shop.payments import verified_capture_id
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


def _recorded_paypal_order_id(order: Order) -> str:
    """Read the server's recorded link; a callback cannot create or replace it."""
    identifiers = {
        item["paypal_order_id"]
        for item in (order.items or [])
        if isinstance(item, dict)
        and isinstance(item.get("paypal_order_id"), str)
        and item["paypal_order_id"].strip()
    }
    if order.paypal_order_id:
        identifiers.add(order.paypal_order_id)
    if not identifiers:
        raise AppError("MISSING_PAYPAL_ORDER_ID", "This order has no verified PayPal order link", status_code=422)
    if len(identifiers) != 1:
        raise AppError("PAYPAL_ORDER_MISMATCH", "This order has conflicting PayPal order links", status_code=422)
    return str(next(iter(identifiers)))


def _capture_response(session: Session, order: Order) -> CaptureOrderResponse:
    tracking = session.scalar(select(TrackingEvent).where(TrackingEvent.order_id == order.id))
    return CaptureOrderResponse(
        order_code=order.order_code,
        paypal_transaction_id=order.paypal_capture_id or order.paypal_transaction_id or "",
        status=order.status,
        carrier=tracking.carrier if tracking else None,
        tracking_number=tracking.tracking_number if tracking else None,
    )


def _record_payment(session: Session, order: Order, paypal_order_id: str, capture_id: str) -> None:
    """One transactional winner records payment and its initial simulated shipment."""
    claimed = session.scalar(
        update(Order)
        .where(
            Order.id == order.id,
            Order.paypal_capture_id.is_(None),
            Order.status.in_([OrderStatus.PENDING.value, OrderStatus.CANCELLED.value]),
        )
        .values(
            paypal_order_id=paypal_order_id, paypal_capture_id=capture_id,
            paypal_transaction_id=capture_id, status=OrderStatus.PAID.value,
        )
        .returning(Order.id)
    )
    if claimed is None:
        session.refresh(order)
        if order.paypal_capture_id != capture_id:
            raise AppError("PAYMENT_CONFLICT", "Payment requires merchant review", status_code=409)
        return
    existing_tracking = session.scalar(select(TrackingEvent.id).where(TrackingEvent.order_id == order.id))
    if existing_tracking is None:
        session.add(TrackingEvent(
            order_id=order.id, carrier="UPS", tracking_number=f"1Z999AA10{order.order_code}",
            status=TrackingStatus.IN_TRANSIT.value, event_time=datetime.now(UTC),
            payload={"source": "simulated", "note": "Simulated package received at origin facility."},
        ))
    session.commit()
    session.refresh(order)


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

    settings = Settings()
    merchant_id = settings.paypal_merchant_id
    if not merchant_id:
        if settings.paypal_env != PayPalEnv.stub:
            raise AppError("CHECKOUT_UNAVAILABLE", "Merchant checkout configuration is incomplete", status_code=503)
        merchant_id = MOCK_MERCHANT_ID

    # 2. Persist local intent before a remote operation can succeed ambiguously.
    order = Order(
        order_code=order_code,
        merchant_id=merchant_id,
        customer_email=normalized_email,
        amount=total_amount,
        currency="USD",
        status=OrderStatus.PENDING.value,
        items=order_items_payload,
        # Ordinary deployed checkout cannot assign itself to another demo scope.
        demo_session_id=req.demo_session_id if settings.app_env != AppEnv.prod else None,
        created_at=datetime.now(UTC),
    )
    session.add(order)
    session.commit()

    # 3. Call PayPal to create order
    try:
        paypal_order = await orders_client.create_order(
            amount=total_amount,
            currency="USD",
            reference_id=order_code,
            description="Signoff Candle Order",
        )
    except Exception:
        session.rollback()  # intent remains durable; never discard an uncertain remote success
        raise

    paypal_order_id = paypal_order.get("id", "")
    if not isinstance(paypal_order_id, str) or not paypal_order_id.strip() or len(paypal_order_id) > 100:
        raise AppError("PAYMENT_CREATION_UNCONFIRMED", "PayPal order creation could not be confirmed", status_code=502)
    order.paypal_order_id = paypal_order_id
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
    order = session.scalar(
        select(Order).where(Order.order_code == order_code.strip()).execution_options(populate_existing=True)
    )
    if order is None:
        raise NotFoundError(f"Order '{order_code}' not found")

    paypal_order_id = _recorded_paypal_order_id(order)
    if req and req.paypal_order_id is not None and req.paypal_order_id != paypal_order_id:
        raise AppError("PAYPAL_ORDER_MISMATCH", "PayPal order does not match this checkout", status_code=422)

    # Idempotent return on double capture
    if order.status in (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value):
        return _capture_response(session, order)

    if order.status == OrderStatus.CANCELLED.value:
        raise AppError("ORDER_CANCELLED", "Cannot capture an expired or cancelled order", status_code=409)

    # Atomically persist one capture attempt before I/O. A concurrent callback or
    # process restart can only GET/reconcile; it cannot blindly capture again.
    claimed = session.scalar(
        update(Order)
        .where(Order.id == order.id, Order.capture_attempted_at.is_(None), Order.status == OrderStatus.PENDING.value)
        .values(capture_attempted_at=datetime.now(UTC), paypal_order_id=paypal_order_id)
        .returning(Order.id)
    )
    session.commit()
    if claimed is None:
        order = await reconcile_order(session, order_code, orders_client)
        if order.status in (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value):
            return _capture_response(session, order)
        raise AppError(
            "PAYMENT_RECONCILIATION_REQUIRED", "Payment confirmation is pending. Check your order status.",
            status_code=409,
        )

    # Call PayPal capture
    paypal_data = await orders_client.capture_order(paypal_order_id)
    capture_id = verified_capture_id(
        paypal_data, order_id=paypal_order_id, amount=order.amount, currency=order.currency,
        merchant_id=order.merchant_id,
    )

    _record_payment(session, order, paypal_order_id, capture_id)
    return _capture_response(session, order)


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
        paypal_order_id=order.paypal_order_id,
        paypal_capture_id=order.paypal_capture_id,
    )


async def reconcile_order(
    session: Session,
    order_code: str,
    orders_client: PayPalOrdersClient,
) -> Order:
    """Recover local state if PayPal capture succeeded but local write failed."""
    order = session.scalar(
        select(Order).where(Order.order_code == order_code.strip()).execution_options(populate_existing=True)
    )
    if order is None:
        raise NotFoundError(f"Order '{order_code}' not found")

    resolved_statuses = (OrderStatus.PAID.value, OrderStatus.DELIVERED.value, OrderStatus.SHIPPED.value)
    if order.status in resolved_statuses and order.paypal_transaction_id:
        return order

    try:
        paypal_order_id = _recorded_paypal_order_id(order)
    except AppError:
        return order

    try:
        paypal_order = await orders_client.get_order(paypal_order_id)
    except Exception:
        return order

    try:
        capture_id = verified_capture_id(
            paypal_order, order_id=paypal_order_id, amount=order.amount, currency=order.currency,
            merchant_id=order.merchant_id,
        )
    except AppError:
        return order
    _record_payment(session, order, paypal_order_id, capture_id)

    return order
