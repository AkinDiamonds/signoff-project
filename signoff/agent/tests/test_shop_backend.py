import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from agent.app.db.base import Base
from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.errors import AppError, NotFoundError
from agent.app.paypal.orders_client import PayPalOrdersClient
from agent.app.shop.catalog import get_catalog, get_product, seed_catalog
from agent.app.shop.schemas import (
    CreateOrderRequest,
    OrderItemRequest,
)
from agent.app.shop.service import (
    capture_shop_order,
    create_shop_order,
    get_buyer_order,
    reconcile_order,
)
from scripts.paypal_stub.app import create_stub_app


@pytest.fixture
def db_session():
    """In-memory SQLite session with products and orders tables created."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as session:
        seed_catalog(session)
        session.commit()
        yield session


@pytest.fixture
def stub_orders_client(monkeypatch):
    """PayPalOrdersClient wired to the in-process PayPal stub app."""
    monkeypatch.setenv("PAYPAL_ENV", "stub")
    monkeypatch.setenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "stub_client_id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "stub_secret")

    stub_app = create_stub_app()
    transport = httpx.ASGITransport(app=stub_app)
    http_client = httpx.AsyncClient(transport=transport, base_url="https://api-m.sandbox.paypal.com")

    from agent.app.paypal.auth import PayPalAuth

    auth = PayPalAuth(
        client_id="stub_client_id",
        client_secret="stub_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=http_client,
    )
    auth._access_token = "stub-token"
    auth._expires_at = 9999999999.0

    return PayPalOrdersClient(
        auth=auth,
        base_url="https://api-m.sandbox.paypal.com",
        http_client=http_client,
        client_id="stub_client_id",
        client_secret="stub_secret",
    )



# --- 1. Catalog Tests ---


def test_catalog_has_all_five_candles(db_session: Session):
    products = get_catalog(db_session)
    assert len(products) == 5
    skus = {p.sku for p in products}
    assert skus == {"CND-LAV-01", "CND-VAN-02", "GIFT-SET-01", "CND-CED-03", "CND-ROSE-04"}

    lavender = get_product(db_session, "CND-LAV-01")
    assert lavender is not None
    assert lavender.price == Decimal("21.00")
    assert lavender.currency == "USD"


def test_seed_catalog_is_idempotent(db_session: Session):
    added = seed_catalog(db_session)
    assert added == 0  # Already seeded by fixture


# --- 2. Type & Schema Tests ---


def test_create_order_request_type_has_no_price_field():
    """Edge cases: types: The create-order request type has no price field; quantity bounded."""
    assert "price" not in OrderItemRequest.model_fields
    assert "unit_price" not in OrderItemRequest.model_fields
    assert "amount" not in OrderItemRequest.model_fields

    # Valid quantity
    item = OrderItemRequest(sku="CND-LAV-01", quantity=3)
    assert item.quantity == 3

    # Quantity bounds: 1 to 5
    with pytest.raises(ValidationError):
        OrderItemRequest.model_validate({"sku": "CND-LAV-01", "quantity": 0})

    with pytest.raises(ValidationError):
        OrderItemRequest.model_validate({"sku": "CND-LAV-01", "quantity": 6})



# --- 3. Order Creation & Server Pricing ---


@pytest.mark.asyncio
async def test_create_order_computes_total_on_server(db_session: Session, stub_orders_client: PayPalOrdersClient):
    """Client cannot supply price; server calculates 2 * $21.00 = $42.00."""
    req = CreateOrderRequest(
        customer_email="buyer@example.test",
        items=[OrderItemRequest(sku="CND-LAV-01", quantity=2)],
    )

    resp = await create_shop_order(db_session, req, stub_orders_client)
    assert resp.order_code.startswith("SIG")
    assert len(resp.order_code) == 10
    assert resp.amount.value == Decimal("42.00")
    assert resp.status == "PENDING"
    assert resp.paypal_order_id != ""

    # Verify order was saved in DB with PENDING status
    order = db_session.scalar(select(Order).where(Order.order_code == resp.order_code))
    assert order is not None
    assert order.amount == Decimal("42.00")
    assert order.customer_email == "buyer@example.test"
    assert order.status == OrderStatus.PENDING.value


@pytest.mark.asyncio
async def test_create_order_rejects_unknown_product(db_session: Session, stub_orders_client: PayPalOrdersClient):
    req = CreateOrderRequest(
        customer_email="buyer@example.test",
        items=[OrderItemRequest(sku="CND-UNKNOWN-99", quantity=1)],
    )
    with pytest.raises(NotFoundError):
        await create_shop_order(db_session, req, stub_orders_client)


# --- 4. Order Capture, Idempotency & Edge Cases ---


@pytest.mark.asyncio
async def test_capture_order_success_schedules_mock_tracking(
    db_session: Session, stub_orders_client: PayPalOrdersClient
):
    req = CreateOrderRequest(
        customer_email="buyer@example.test",
        items=[OrderItemRequest(sku="CND-VAN-02", quantity=1)],
    )
    created = await create_shop_order(db_session, req, stub_orders_client)

    capture_resp = await capture_shop_order(db_session, created.order_code, None, stub_orders_client)
    assert capture_resp.status == OrderStatus.PAID.value
    assert capture_resp.carrier == "UPS"
    assert capture_resp.tracking_number is not None
    assert capture_resp.paypal_transaction_id.startswith("STUB-CAPTURE-")

    # Verify DB state
    order = db_session.scalar(select(Order).where(Order.order_code == created.order_code))
    assert order is not None
    assert order.status == OrderStatus.PAID.value
    assert order.paypal_transaction_id == capture_resp.paypal_transaction_id

    # Verify mock tracking event created
    events = list(db_session.scalars(select(TrackingEvent).where(TrackingEvent.order_id == order.id)).all())
    assert len(events) == 1
    assert events[0].carrier == "UPS"
    assert events[0].status == TrackingStatus.PRE_TRANSIT.value


@pytest.mark.asyncio
async def test_capture_order_is_idempotent_on_double_capture(
    db_session: Session, stub_orders_client: PayPalOrdersClient
):
    req = CreateOrderRequest(
        customer_email="buyer@example.test",
        items=[OrderItemRequest(sku="CND-VAN-02", quantity=1)],
    )
    created = await create_shop_order(db_session, req, stub_orders_client)

    first_capture = await capture_shop_order(db_session, created.order_code, None, stub_orders_client)
    second_capture = await capture_shop_order(db_session, created.order_code, None, stub_orders_client)

    assert first_capture.paypal_transaction_id == second_capture.paypal_transaction_id
    assert second_capture.status == OrderStatus.PAID.value


@pytest.mark.asyncio
async def test_capture_amount_mismatch_flags_order_and_prevents_shipment(db_session: Session):
    """When captured amount differs from expected, order is flagged and no tracking scheduled."""
    order = Order(
        order_code="SIGTESTMIS1",
        merchant_id="MOCK-MERCHANT-001",
        customer_email="buyer@example.test",
        amount=Decimal("100.00"),  # Expected: $100.00
        currency="USD",
        status=OrderStatus.PENDING.value,
        items=[{"sku": "CND-LAV-01", "quantity": 1, "paypal_order_id": "ORD-MISMATCH"}],
        created_at=datetime.now(UTC),
    )
    db_session.add(order)
    db_session.commit()

    # Mock orders client returning $50.00 instead of $100.00
    class MismatchClient:
        async def capture_order(self, order_id: str):
            return {
                "id": order_id,
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "captures": [
                                {
                                    "id": "CAP-MISMATCH",
                                    "status": "COMPLETED",
                                    "amount": {"value": "50.00", "currency_code": "USD"},
                                }
                            ]
                        }
                    }
                ],
            }

    with pytest.raises(AppError) as exc_info:
        await capture_shop_order(db_session, "SIGTESTMIS1", None, MismatchClient())  # type: ignore

    assert exc_info.value.code == "AMOUNT_MISMATCH"

    # Invariant: order not marked PAID and no tracking scheduled
    db_session.refresh(order)
    assert order.status != OrderStatus.PAID.value
    events = list(db_session.scalars(select(TrackingEvent).where(TrackingEvent.order_id == order.id)).all())
    assert len(events) == 0


# --- 5. Order Lookup, Uniform Errors & Expiry ---


def test_get_order_normalizes_email_case_and_requires_both(db_session: Session):
    order = Order(
        order_code="SIGLOOKUP01",
        merchant_id="MOCK-MERCHANT-001",
        customer_email="buyer.testing@example.test",
        amount=Decimal("42.00"),
        currency="USD",
        status=OrderStatus.PAID.value,
        items=[{"sku": "CND-LAV-01", "name": "Lavender Candle", "quantity": 2, "unit_price": "21.00"}],
        created_at=datetime.now(UTC),
    )
    db_session.add(order)
    db_session.commit()

    # Upper/mixed case email lookup works because it is normalized
    res = get_buyer_order(db_session, "SIGLOOKUP01", "BUYER.TESTING@EXAMPLE.TEST")
    assert res.order_code == "SIGLOOKUP01"
    assert res.customer_email == "buyer.testing@example.test"


def test_get_order_uniform_error_for_nonexistent_or_mismatched_email(db_session: Session):
    """Uniform 404 error regardless of whether order is missing or email mismatches."""
    order = Order(
        order_code="SIGSECRET01",
        merchant_id="MOCK-MERCHANT-001",
        customer_email="secret@example.test",
        amount=Decimal("21.00"),
        currency="USD",
        status=OrderStatus.PAID.value,
        items=[],
        created_at=datetime.now(UTC),
    )
    db_session.add(order)
    db_session.commit()

    # 1. Wrong email
    with pytest.raises(NotFoundError) as err1:
        get_buyer_order(db_session, "SIGSECRET01", "wrong@example.test")

    # 2. Unknown order code
    with pytest.raises(NotFoundError) as err2:
        get_buyer_order(db_session, "SIGNOTFOUND", "secret@example.test")

    # Verify messages are identical to avoid information leakage
    assert str(err1.value) == str(err2.value)


def test_pending_orders_expire(db_session: Session):
    """Pending orders older than expiry threshold expire to CANCELLED."""
    old_time = datetime.now(UTC) - timedelta(minutes=45)
    order = Order(
        order_code="SIGEXPIRE01",
        merchant_id="MOCK-MERCHANT-001",
        customer_email="buyer@example.test",
        amount=Decimal("21.00"),
        currency="USD",
        status=OrderStatus.PENDING.value,
        items=[],
        created_at=old_time,
    )
    db_session.add(order)
    db_session.commit()

    res = get_buyer_order(db_session, "SIGEXPIRE01", "buyer@example.test")
    assert res.status == OrderStatus.CANCELLED.value


# --- 6. Reconcile ---


@pytest.mark.asyncio
async def test_reconcile_recovers_when_paypal_captured_but_local_write_failed(db_session: Session):
    order = Order(
        order_code="SIGRECON001",
        merchant_id="MOCK-MERCHANT-001",
        customer_email="buyer@example.test",
        amount=Decimal("38.00"),
        currency="USD",
        status=OrderStatus.PENDING.value,
        items=[{"sku": "CND-VAN-02", "paypal_order_id": "ORD-RECON-1"}],
        created_at=datetime.now(UTC),
    )
    db_session.add(order)
    db_session.commit()

    class MockPayPalGetClient:
        async def get_order(self, order_id: str):
            return {
                "id": order_id,
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "captures": [
                                {
                                    "id": "CAP-RECON-SUCCESS",
                                    "status": "COMPLETED",
                                    "amount": {"value": "38.00", "currency_code": "USD"},
                                }
                            ]
                        }
                    }
                ],
            }

    recovered = await reconcile_order(db_session, "SIGRECON001", MockPayPalGetClient())  # type: ignore
    assert recovered.status == OrderStatus.PAID.value
    assert recovered.paypal_transaction_id == "CAP-RECON-SUCCESS"

    # Tracking scheduled on recovery
    events = list(db_session.scalars(select(TrackingEvent).where(TrackingEvent.order_id == recovered.id)).all())
    assert len(events) == 1
    assert events[0].status == TrackingStatus.PRE_TRANSIT.value


# --- 7. Concurrent Capture ---


@pytest.mark.asyncio
async def test_concurrent_capture(db_session: Session, stub_orders_client: PayPalOrdersClient):
    req = CreateOrderRequest(
        customer_email="concurrent@example.test",
        items=[OrderItemRequest(sku="GIFT-SET-01", quantity=1)],
    )
    created = await create_shop_order(db_session, req, stub_orders_client)

    # Launch two concurrent capture calls
    t1 = capture_shop_order(db_session, created.order_code, None, stub_orders_client)
    t2 = capture_shop_order(db_session, created.order_code, None, stub_orders_client)

    results = await asyncio.gather(t1, t2)
    assert results[0].status == OrderStatus.PAID.value
    assert results[1].status == OrderStatus.PAID.value
    assert results[0].paypal_transaction_id == results[1].paypal_transaction_id
