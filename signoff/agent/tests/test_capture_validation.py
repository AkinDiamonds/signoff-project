"""Payment proof must fail closed before either capture or recovery can ship."""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from agent.app.db.base import Base
from agent.app.db.models import Order, TrackingEvent
from agent.app.errors import AppError, UpstreamUnavailableError
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.orders_client import PayPalOrdersClient
from agent.app.shop.catalog import seed_catalog
from agent.app.shop.schemas import CaptureOrderRequest, CreateOrderRequest, OrderItemRequest
from agent.app.shop.service import capture_shop_order, create_shop_order, reconcile_order


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


@pytest.mark.asyncio
async def test_uncertain_capture_is_reconciled_after_session_restart(pending_order):
    session, order = pending_order
    code, identifier = order.order_code, order.id
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.side_effect = UpstreamUnavailableError("Uncertain result")
    client.get_order.return_value = payment()
    with pytest.raises(UpstreamUnavailableError):
        await capture_shop_order(session, code, None, client)
    session.rollback()
    with Session(session.get_bind()) as restarted:
        recovered = await capture_shop_order(restarted, code, None, client)
        stored = restarted.get(Order, identifier)
        assert recovered.status == "PAID" and stored.capture_attempted_at is not None
        assert stored.paypal_order_id == "ORDER-RECORDED"
        assert stored.paypal_capture_id == "CAPTURE-VERIFIED"
        assert len(restarted.scalars(select(TrackingEvent)).all()) == 1
    client.capture_order.assert_awaited_once()
    client.get_order.assert_awaited_once_with("ORDER-RECORDED")


@pytest.mark.asyncio
async def test_unconfirmed_retry_does_not_blindly_capture_again(pending_order):
    session, order = pending_order
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.side_effect = UpstreamUnavailableError("Uncertain result")
    client.get_order.return_value = payment(status="APPROVED")
    with pytest.raises(UpstreamUnavailableError):
        await capture_shop_order(session, order.order_code, None, client)
    with pytest.raises(AppError) as caught:
        await capture_shop_order(session, order.order_code, None, client)
    assert caught.value.code == "PAYMENT_RECONCILIATION_REQUIRED"
    client.capture_order.assert_awaited_once()
    assert session.scalar(select(TrackingEvent.id)) is None


@pytest.mark.asyncio
async def test_separate_sessions_cannot_capture_concurrently(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'capture.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as first, Session(engine) as second:
        first.add(Order(
            order_code="SIGCONCURRENT", merchant_id="MOCK-MERCHANT-001", customer_email="buyer@example.test",
            amount=Decimal("21.00"), currency="USD", status="PENDING", items=[],
            paypal_order_id="ORDER-RECORDED", created_at=datetime.now(UTC),
        ))
        first.commit()
        entered, release = asyncio.Event(), asyncio.Event()

        async def capture(_):
            entered.set()
            await release.wait()
            return payment()

        client = AsyncMock(spec=PayPalOrdersClient)
        client.capture_order.side_effect = capture
        client.get_order.return_value = payment(status="APPROVED")
        task = asyncio.create_task(capture_shop_order(first, "SIGCONCURRENT", None, client))
        await entered.wait()
        try:
            with pytest.raises(AppError) as caught:
                await capture_shop_order(second, "SIGCONCURRENT", None, client)
            assert caught.value.code == "PAYMENT_RECONCILIATION_REQUIRED"
        finally:
            release.set()
            await task
        client.capture_order.assert_awaited_once()
        assert len(first.scalars(select(TrackingEvent)).all()) == 1
    engine.dispose()


@pytest.mark.asyncio
async def test_paypal_request_ids_are_stable_and_separate_by_operation():
    seen = []

    def respond(request):
        seen.append(request.headers['PayPal-Request-Id'])
        return httpx.Response(201, json=payment())

    http = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    auth = AsyncMock(spec=PayPalAuth)
    auth.get_access_token.return_value = "fictional-token"
    client = PayPalOrdersClient(auth=auth, http_client=http)
    await client.create_order(amount=Decimal("21.00"), reference_id="SIGREFERENCE")
    await client.create_order(amount=Decimal("21.00"), reference_id="SIGREFERENCE")
    await client.capture_order("ORDER-RECORDED")
    await client.capture_order("ORDER-RECORDED")
    assert seen[0] == seen[1] and seen[2] == seen[3] and seen[0] != seen[2]
    assert all(0 < len(value) <= 108 for value in seen)
    await http.aclose()


@pytest.mark.asyncio
async def test_capture_rejects_wrong_merchant_when_payee_is_present(pending_order):
    session, order = pending_order
    response = payment()
    response['purchase_units'][0]['payee'] = {'merchant_id': 'UNRELATED-MERCHANT'}
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.return_value = response
    with pytest.raises(AppError) as caught:
        await capture_shop_order(session, order.order_code, None, client)
    assert caught.value.code == 'MERCHANT_MISMATCH'
    assert session.scalar(select(TrackingEvent.id)) is None


@pytest.mark.asyncio
async def test_creation_intent_survives_uncertain_paypal_response(pending_order, monkeypatch):
    session, _ = pending_order
    monkeypatch.setenv('PAYPAL_MERCHANT_ID', 'CONFIGURED-MERCHANT')
    seed_catalog(session)
    session.commit()
    client = AsyncMock(spec=PayPalOrdersClient)
    client.create_order.side_effect = UpstreamUnavailableError('Uncertain create response')
    request = CreateOrderRequest(
        customer_email='new@example.test', items=[OrderItemRequest(sku='CND-LAV-01', quantity=1)]
    )
    with pytest.raises(UpstreamUnavailableError):
        await create_shop_order(session, request, client)
    session.rollback()
    with Session(session.get_bind()) as restarted:
        intent = restarted.scalar(select(Order).where(Order.customer_email == 'new@example.test'))
        assert intent is not None and intent.status == 'PENDING'
        assert intent.merchant_id == 'CONFIGURED-MERCHANT'
        assert intent.paypal_order_id is None and intent.paypal_capture_id is None


@pytest.mark.asyncio
async def test_recovery_checks_merchant_and_accepts_matching_merchant(pending_order):
    session, order = pending_order
    response = payment()
    response['purchase_units'][0]['payee'] = {'merchant_id': 'WRONG'}
    client = AsyncMock(spec=PayPalOrdersClient)
    client.get_order.return_value = response
    assert (await reconcile_order(session, order.order_code, client)).status == 'PENDING'
    response['purchase_units'][0]['payee'] = {'merchant_id': order.merchant_id}
    assert (await reconcile_order(session, order.order_code, client)).status == 'PAID'
    assert len(session.scalars(select(TrackingEvent)).all()) == 1


@pytest.mark.asyncio
async def test_local_commit_failure_after_capture_is_recovered_without_recapture(pending_order, monkeypatch):
    session, order = pending_order
    code, identifier = order.order_code, order.id
    original_commit = session.commit
    calls = 0

    def fail_paid_commit():
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError('Simulated local write failure after remote success')
        original_commit()

    monkeypatch.setattr(session, 'commit', fail_paid_commit)
    client = AsyncMock(spec=PayPalOrdersClient)
    client.capture_order.return_value = payment()
    client.get_order.return_value = payment()
    with pytest.raises(RuntimeError, match='Simulated local write failure'):
        await capture_shop_order(session, code, None, client)
    session.rollback()
    with Session(session.get_bind()) as restarted:
        recovered = await capture_shop_order(restarted, code, None, client)
        assert recovered.status == 'PAID'
        assert restarted.get(Order, identifier).paypal_capture_id == 'CAPTURE-VERIFIED'
        assert len(restarted.scalars(select(TrackingEvent)).all()) == 1
    client.capture_order.assert_awaited_once()


def test_concurrent_recovery_creates_only_one_tracking_event(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'recover.db'}")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Order(
            order_code="SIGRECOVER", merchant_id="MOCK-MERCHANT-001", customer_email="buyer@example.test",
            amount=Decimal('21.00'), currency='USD', status='PENDING', items=[],
            paypal_order_id='ORDER-RECORDED', capture_attempted_at=datetime.now(UTC), created_at=datetime.now(UTC),
        ))
        session.commit()
    barrier = threading.Barrier(2)

    def recover():
        async def get_order(_):
            barrier.wait(timeout=5)
            return payment()

        with Session(engine) as session:
            client = AsyncMock(spec=PayPalOrdersClient)
            client.get_order.side_effect = get_order
            result = asyncio.run(reconcile_order(session, 'SIGRECOVER', client))
            client.capture_order.assert_not_called()
            return result.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [pool.submit(recover) for _ in range(2)]
        assert [result.result(timeout=10) for result in results] == ['PAID', 'PAID']
    with Session(engine) as session:
        assert len(session.scalars(select(TrackingEvent)).all()) == 1
    engine.dispose()
