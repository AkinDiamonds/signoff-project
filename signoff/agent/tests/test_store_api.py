"""Tests for store read-only API (06-judge-flow.md Part A).

Validates:
- Missing X-Store-Key header returns 401 in standard error envelope.
- Wrong X-Store-Key header returns 401.
- Unknown transaction ID returns 404 in standard error envelope.
- Known order returns 200 with items, amounts, and tracking shipments.
- Order messages endpoint returns buyer messages or empty list if none.
- Merchant policies returns static policy data.
- Every store endpoint is GET only (POST/PUT/DELETE return 405).
"""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import Dispute, Order, TrackingEvent
from agent.app.db.session import get_db_session
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.main import create_app
from agent.app.settings import AppEnv, PayPalEnv, Settings

TEST_STORE_KEY = "test-store-api-key-12345"


@pytest.fixture
def db_session():
    """In-memory SQLite session with tables created."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """Test client with test settings and DB session override."""
    settings = Settings(
        app_env=AppEnv.local,
        paypal_env=PayPalEnv.stub,
        store_api_key=TEST_STORE_KEY,
    )
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_order(db_session):
    """Seed a known test order with tracking and a dispute message."""
    order = Order(
        order_code="SIG-TEST-ORDER-1",
        merchant_id="merchant_test",
        customer_email="buyer@example.test",
        paypal_transaction_id="TX-KNOWN-123",
        amount=Decimal("85.00"),
        currency="USD",
        status=OrderStatus.DELIVERED.value,
        items=[{"name": "Mechanical Keyboard", "quantity": 1, "price": "85.00"}],
        created_at=datetime(2026, 10, 25, 10, 0, 0, tzinfo=UTC),
    )
    db_session.add(order)
    db_session.flush()

    tracking = TrackingEvent(
        order_id=order.id,
        carrier="UPS",
        tracking_number="1Z9999999999999999",
        status=TrackingStatus.DELIVERED.value,
        event_time=datetime(2026, 10, 26, 15, 30, 0, tzinfo=UTC),
        payload={"city": "San Francisco", "state": "CA"},
    )
    db_session.add(tracking)

    dispute = Dispute(
        id="DP-STORE-TEST-1",
        state_fingerprint="fp123",
        status="WAITING_FOR_SELLER_RESPONSE",
        reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        amount=Decimal("85.00"),
        currency="USD",
        snapshot={
            "disputed_transactions": [{"seller_transaction_id": "TX-KNOWN-123"}],
            "messages": [
                {
                    "posted_by": "BUYER",
                    "time_posted": "2026-10-27T12:00:00Z",
                    "content": "Where is my keyboard?",
                },
                {
                    "posted_by": "SELLER",
                    "time_posted": "2026-10-27T13:00:00Z",
                    "content": "Checking with UPS.",
                },
            ],
        },
    )
    db_session.add(dispute)
    db_session.commit()
    return order


def test_missing_store_key_returns_401(client):
    """Calls without X-Store-Key header fail with 401 in standard envelope."""
    resp = client.get("/api/store/policies")
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "X-Store-Key" in data["error"]["message"]


def test_wrong_store_key_returns_401(client):
    """Calls with incorrect X-Store-Key header fail with 401."""
    resp = client.get("/api/store/policies", headers={"X-Store-Key": "wrong-key"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


def test_unknown_transaction_returns_404(client):
    """Querying an unknown transaction ID returns 404 in standard envelope."""
    resp = client.get(
        "/api/store/orders/by-transaction/TX-NONEXISTENT",
        headers={"X-Store-Key": TEST_STORE_KEY},
    )
    assert resp.status_code == 404
    data = resp.json()
    assert data["error"]["code"] == "NOT_FOUND"


def test_known_order_and_shipments_return_200(client, seeded_order):
    """Known order is returned with details, and shipments endpoint lists tracking events."""
    # 1. Order by transaction ID
    resp = client.get(
        f"/api/store/orders/by-transaction/{seeded_order.paypal_transaction_id}",
        headers={"X-Store-Key": TEST_STORE_KEY},
    )
    assert resp.status_code == 200
    order_data = resp.json()
    assert order_data["order_code"] == seeded_order.order_code
    assert order_data["customer_email"] == "buyer@example.test"
    assert Decimal(str(order_data["amount"])) == Decimal("85.00")
    assert order_data["currency"] == "USD"
    assert order_data["status"] == OrderStatus.DELIVERED.value
    assert len(order_data["items"]) == 1
    assert order_data["items"][0]["name"] == "Mechanical Keyboard"

    # 2. Shipments by order code
    resp_ship = client.get(
        f"/api/store/orders/{seeded_order.order_code}/shipments",
        headers={"X-Store-Key": TEST_STORE_KEY},
    )
    assert resp_ship.status_code == 200
    shipments = resp_ship.json()
    assert len(shipments) == 1
    assert shipments[0]["carrier"] == "UPS"
    assert shipments[0]["tracking_number"] == "1Z9999999999999999"
    assert shipments[0]["status"] == "DELIVERED"
    assert shipments[0]["payload"] == {"city": "San Francisco", "state": "CA"}


def test_order_messages_returns_buyer_messages(client, seeded_order):
    """Messages endpoint returns buyer messages from linked dispute, empty list if none."""
    resp = client.get(
        f"/api/store/orders/{seeded_order.order_code}/messages",
        headers={"X-Store-Key": TEST_STORE_KEY},
    )
    assert resp.status_code == 200
    messages = resp.json()
    assert len(messages) == 1
    assert messages[0]["posted_by"] == "BUYER"
    assert messages[0]["content"] == "Where is my keyboard?"

    # Empty list for order with no dispute
    resp_empty = client.get(
        "/api/store/orders/NONEXISTENT-CODE/messages",
        headers={"X-Store-Key": TEST_STORE_KEY},
    )
    assert resp_empty.status_code == 200
    assert resp_empty.json() == []


def test_policies_returns_200(client):
    """Policies endpoint returns static merchant policies."""
    resp = client.get("/api/store/policies", headers={"X-Store-Key": TEST_STORE_KEY})
    assert resp.status_code == 200
    policies = resp.json()
    assert policies["return_window_days"] == 30
    assert policies["refund_window_days"] == 30
    assert "shipping_policy" in policies
    assert "return_policy" in policies


def test_all_routes_are_get_only(client, seeded_order):
    """Store endpoints only allow GET; POST, PUT, DELETE return 405 Method Not Allowed."""
    endpoints = [
        f"/api/store/orders/by-transaction/{seeded_order.paypal_transaction_id}",
        f"/api/store/orders/{seeded_order.order_code}/shipments",
        f"/api/store/orders/{seeded_order.order_code}/messages",
        "/api/store/policies",
    ]
    headers = {"X-Store-Key": TEST_STORE_KEY}

    for endpoint in endpoints:
        post_resp = client.post(endpoint, headers=headers, json={"some": "payload"})
        assert post_resp.status_code == 405, f"Expected 405 for POST {endpoint}, got {post_resp.status_code}"

        put_resp = client.put(endpoint, headers=headers, json={"some": "payload"})
        assert put_resp.status_code == 405, f"Expected 405 for PUT {endpoint}, got {put_resp.status_code}"

        delete_resp = client.delete(endpoint, headers=headers)
        assert delete_resp.status_code == 405, f"Expected 405 for DELETE {endpoint}, got {delete_resp.status_code}"
