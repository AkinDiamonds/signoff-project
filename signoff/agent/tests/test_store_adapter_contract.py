"""Contract tests for StoreAdapter implementations (06-judge-flow.md Part B).

Every adapter must satisfy:
1. Unknown transaction returns None.
2. Known transaction returns the order with its shipments.
3. Network or upstream failure raises StoreUnavailable rather than returning None.
"""

from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.store.base import StoreAdapter, StoreUnavailable
from agent.app.store.http_adapter import HttpStoreAdapter
from agent.app.store.local_adapter import LocalStoreAdapter


@pytest.fixture
def db_session():
    """In-memory SQLite session with test tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded_db(db_session):
    """Seed a test order and tracking event."""
    order = Order(
        order_code="SIG-TEST-ADAPTER-1",
        merchant_id="merchant_test",
        customer_email="customer@example.test",
        paypal_transaction_id="TX-CONTRACT-KNOWN",
        amount=Decimal("50.00"),
        currency="USD",
        status=OrderStatus.DELIVERED.value,
        items=[{"sku": "ITEM-1", "name": "Item 1", "quantity": 1}],
        created_at=datetime(2026, 10, 20, 10, 0, 0, tzinfo=UTC),
    )
    db_session.add(order)
    db_session.flush()

    tracking = TrackingEvent(
        order_id=order.id,
        carrier="UPS",
        tracking_number="1Z9990001112223334",
        status=TrackingStatus.DELIVERED.value,
        event_time=datetime(2026, 10, 22, 14, 0, 0, tzinfo=UTC),
        payload={"city": "Austin", "state": "TX"},
    )
    db_session.add(tracking)
    db_session.commit()
    return order


def test_local_adapter_contract(db_session, seeded_db):
    """LocalStoreAdapter satisfies the StoreAdapter contract."""
    adapter = LocalStoreAdapter(db_session)
    assert isinstance(adapter, StoreAdapter)

    # 1. Unknown transaction returns None
    assert adapter.find_order("TX-UNKNOWN-000") is None

    # 2. Known transaction returns order with shipments
    order = adapter.find_order("TX-CONTRACT-KNOWN")
    assert order is not None
    assert order.order_code == "SIG-TEST-ADAPTER-1"
    assert order.customer_email == "customer@example.test"
    assert order.amount == Decimal("50.00")
    assert len(order.shipments) == 1
    assert order.shipments[0].carrier == "UPS"
    assert order.shipments[0].tracking_number == "1Z9990001112223334"
    assert order.shipments[0].status == TrackingStatus.DELIVERED

    # 3. Shipments method
    shipments = adapter.get_shipments("SIG-TEST-ADAPTER-1")
    assert len(shipments) == 1
    assert shipments[0].carrier == "UPS"

    # 4. Policies
    policies = adapter.get_policies()
    assert policies["return_window_days"] == 30


def test_http_adapter_contract():
    """HttpStoreAdapter satisfies the StoreAdapter contract with MockTransport."""
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.headers.get("X-Store-Key") != "valid-key":
            return httpx.Response(401, json={"error": "unauthorized"})

        if path == "/api/store/orders/by-transaction/TX-CONTRACT-KNOWN":
            return httpx.Response(
                200,
                json={
                    "order_code": "SIG-TEST-ADAPTER-1",
                    "customer_email": "customer@example.test",
                    "amount": "50.00",
                    "currency": "USD",
                    "status": "DELIVERED",
                    "created_at": "2026-10-20T10:00:00Z",
                    "items": [{"sku": "ITEM-1", "name": "Item 1", "quantity": 1}],
                },
            )
        if path == "/api/store/orders/by-transaction/TX-UNKNOWN-000":
            return httpx.Response(404, json={"error": "not found"})

        if path == "/api/store/orders/SIG-TEST-ADAPTER-1/shipments":
            return httpx.Response(
                200,
                json=[
                    {
                        "carrier": "UPS",
                        "tracking_number": "1Z9990001112223334",
                        "status": "DELIVERED",
                        "event_time": "2026-10-22T14:00:00Z",
                        "payload": {"city": "Austin", "state": "TX"},
                    }
                ],
            )
        if path == "/api/store/policies":
            return httpx.Response(200, json={"return_window_days": 30})

        return httpx.Response(404)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = HttpStoreAdapter(base_url="https://shop.example.test", api_key="valid-key", client=client)
    assert isinstance(adapter, StoreAdapter)

    # 1. Unknown transaction returns None
    assert adapter.find_order("TX-UNKNOWN-000") is None

    # 2. Known transaction returns order with shipments
    order = adapter.find_order("TX-CONTRACT-KNOWN")
    assert order is not None
    assert order.order_code == "SIG-TEST-ADAPTER-1"
    assert order.customer_email == "customer@example.test"
    assert order.amount == Decimal("50.00")
    assert len(order.shipments) == 1
    assert order.shipments[0].carrier == "UPS"
    assert order.shipments[0].tracking_number == "1Z9990001112223334"
    assert order.shipments[0].status == TrackingStatus.DELIVERED

    # 3. Policies
    policies = adapter.get_policies()
    assert policies["return_window_days"] == 30


def test_http_adapter_connection_failure_raises_store_unavailable():
    """Connection failure or upstream server error raises StoreUnavailable, never None."""
    def error_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused", request=request)

    client = httpx.Client(transport=httpx.MockTransport(error_handler))
    adapter = HttpStoreAdapter(base_url="https://shop.example.test", api_key="valid-key", client=client)

    with pytest.raises(StoreUnavailable):
        adapter.find_order("TX-CONTRACT-KNOWN")

    with pytest.raises(StoreUnavailable):
        adapter.get_shipments("SIG-TEST-ADAPTER-1")

    with pytest.raises(StoreUnavailable):
        adapter.get_policies()


def test_http_adapter_500_raises_store_unavailable():
    """HTTP 500 error raises StoreUnavailable rather than returning None."""
    def server_error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    client = httpx.Client(transport=httpx.MockTransport(server_error_handler))
    adapter = HttpStoreAdapter(base_url="https://shop.example.test", api_key="valid-key", client=client)

    with pytest.raises(StoreUnavailable):
        adapter.find_order("TX-CONTRACT-KNOWN")
