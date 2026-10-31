"""Payment proof must fail closed before either capture or recovery can ship."""

from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from agent.app.db.base import Base
from agent.app.db.models import Order, TrackingEvent
from agent.app.errors import AppError
from agent.app.paypal.orders_client import PayPalOrdersClient
from agent.app.shop.schemas import CaptureOrderRequest
from agent.app.shop.service import capture_shop_order, reconcile_order


def payment(**changes):
    capture = {
        "id": "CAPTURE-VERIFIED", "status": "COMPLETED",
        "amount": {"currency_code": "USD", "value": "21.00"},
    }
    result = {
        "id": "ORDER-RECORDED", "status": "COMPLETED",
        "purchase_units": [{"payments": {"captures": [capture]}}],
    }
    for key, value in changes.items():
        if key == "capture_status":
            capture["status"] = value
        elif key == "capture_id":
            capture["id"] = value
        elif key in {"value", "currency_code"}:
            capture["amount"][key] = value
        else:
            result[key] = value
    return result


INVALID_PAYMENTS = [
    pytest.param({}, "CAPTURE_UNVERIFIED", id="empty-response"),
    pytest.param(payment(purchase_units=[]), "CAPTURE_UNVERIFIED", id="no-capture"),
    pytest.param(payment(purchase_units=[{"payments": {"captures": []}}]), "CAPTURE_UNVERIFIED", id="empty-captures"),
    pytest.param(payment(status="APPROVED"), "CAPTURE_UNVERIFIED", id="order-not-completed"),
    pytest.param(payment(capture_status="PENDING"), "CAPTURE_UNVERIFIED", id="capture-pending"),
    pytest.param(payment(capture_status="DECLINED"), "CAPTURE_UNVERIFIED", id="capture-declined"),
    pytest.param(payment(capture_status=None), "CAPTURE_UNVERIFIED", id="capture-status-missing"),
    pytest.param(payment(capture_id=""), "CAPTURE_UNVERIFIED", id="capture-id-missing"),
    pytest.param(payment(id="ORDER-UNRELATED"), "PAYPAL_ORDER_MISMATCH", id="unrelated-order"),
    pytest.param(payment(currency_code="EUR"), "CURRENCY_MISMATCH", id="currency"),
    pytest.param(payment(value="20.00"), "AMOUNT_MISMATCH", id="amount"),
    pytest.param(payment(value=21.0), "CAPTURE_UNVERIFIED", id="json-float"),
    pytest.param(payment(value="NaN"), "CAPTURE_UNVERIFIED", id="nonfinite"),
    pytest.param(payment(value="21.001"), "CAPTURE_UNVERIFIED", id="excess-precision"),
    pytest.param(payment(value="-21.00"), "CAPTURE_UNVERIFIED", id="negative"),
    pytest.param(payment(value="2.1e1"), "CAPTURE_UNVERIFIED", id="exponent"),
    pytest.param(payment(purchase_units=[{}, {}]), "CAPTURE_UNVERIFIED", id="multiple-units"),
    pytest.param(payment(purchase_units=[{"payments": {"captures": [
        {"id": "A", "status": "COMPLETED", "amount": {"value": "21.00", "currency_code": "USD"}},
        {"id": "B", "status": "COMPLETED", "amount": {"value": "21.00", "currency_code": "USD"}},
    ]}}]), "CAPTURE_UNVERIFIED", id="multiple-captures"),
]


@pytest.fixture
def pending_order():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        order = Order(
            order_code="SIGVALIDATE", merchant_id="MOCK-MERCHANT-001",
            customer_email="buyer@example.test", amount=Decimal("21.00"), currency="USD",
            status="PENDING", items=[{"paypal_order_id": "ORDER-RECORDED"}],
            created_at=datetime.now(UTC),
        )
        session.add(order)
        session.commit()
        yield session, order
    engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("payload,error", INVALID_PAYMENTS)
async def test_capture_rejects_unverified_payment(pending_order, payload, error):
    session, order = pending_order
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.return_value = deepcopy(payload)
    with pytest.raises(AppError) as caught:
        await capture_shop_order(session, order.order_code, None, client)
    assert caught.value.code == error
    session.refresh(order)
    assert order.status == "PENDING" and order.paypal_transaction_id is None
    assert session.scalar(select(TrackingEvent.id)) is None


@pytest.mark.asyncio
@pytest.mark.parametrize("payload,_error", INVALID_PAYMENTS)
async def test_reconciliation_never_promotes_invalid_payment(pending_order, payload, _error):
    session, order = pending_order
    client = AsyncMock(spec=PayPalOrdersClient)
    client.get_order.return_value = deepcopy(payload)
    recovered = await reconcile_order(session, order.order_code, client)
    assert recovered.status == "PENDING" and recovered.paypal_transaction_id is None
    assert session.scalar(select(TrackingEvent.id)) is None
    client.capture_order.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("already_paid", [False, True])
async def test_caller_cannot_substitute_paypal_order(pending_order, already_paid):
    session, order = pending_order
    if already_paid:
        order.status = "PAID"
        order.paypal_transaction_id = "EXISTING-CAPTURE"
        session.commit()
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.return_value = payment()
    with pytest.raises(AppError) as caught:
        await capture_shop_order(session, order.order_code, CaptureOrderRequest(paypal_order_id="OTHER"), client)
    assert caught.value.code == "PAYPAL_ORDER_MISMATCH"
    client.capture_order.assert_not_called()


@pytest.mark.asyncio
async def test_caller_cannot_supply_missing_server_link(pending_order):
    session, order = pending_order
    order.items = [{"sku": "CANDLE"}]
    session.commit()
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.return_value = payment()
    with pytest.raises(AppError) as caught:
        await capture_shop_order(
            session, order.order_code, CaptureOrderRequest(paypal_order_id="ORDER-RECORDED"), client
        )
    assert caught.value.code == "MISSING_PAYPAL_ORDER_ID"
    client.capture_order.assert_not_called()


@pytest.mark.asyncio
async def test_verified_capture_and_recovery_are_idempotent(pending_order):
    session, order = pending_order
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.return_value = payment()
    first = await capture_shop_order(session, order.order_code, None, client)
    second = await capture_shop_order(session, order.order_code, None, client)
    await reconcile_order(session, order.order_code, client)
    assert first.paypal_transaction_id == second.paypal_transaction_id == "CAPTURE-VERIFIED"
    assert len(session.scalars(select(TrackingEvent)).all()) == 1
    client.capture_order.assert_awaited_once_with("ORDER-RECORDED")
