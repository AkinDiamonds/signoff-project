"""Tests for buyer portal dispute creation and communication (Step 32).

Validates:
- Uniform lookup errors on missing order or email mismatch
- Linked sandbox buyer eligibility check and unlinked account error
- Duplicate dispute blocking for the same transaction
- Validations on amount (bounds, precision, currency) and message (length, emptiness)
- Supported reasons type constraint
- Safe plain-text escaping for markup in buyer messages
- Buyer message replies (Scenario D)
- Offer acceptance and rejection responses (S9)
"""

from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from agent.app.db.base import Base
from agent.app.db.models import Dispute, Order
from agent.app.domain.enums import DisputeReason, DisputeStatus, OrderStatus
from agent.app.domain.money import Money
from agent.app.errors import AppError, NotFoundError
from agent.app.paypal.buyer_client import BuyerDisputeClient
from agent.app.shop.catalog import seed_catalog
from agent.app.shop.disputes import (
    CreateDisputeRequest,
    OfferAction,
    OfferResponseRequest,
    SendBuyerMessageRequest,
    SupportedDisputeReason,
    create_buyer_dispute,
    get_order_dispute_status,
    respond_to_merchant_offer,
    send_buyer_dispute_message,
)
from scripts.paypal_stub.app import create_stub_app


@pytest.fixture
def db_session():
    """In-memory SQLite session with tables created."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as session:
        seed_catalog(session)
        session.commit()
        yield session


@pytest.fixture
def stub_buyer_client(monkeypatch):
    """BuyerDisputeClient wired to the in-process PayPal stub."""
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
    client = BuyerDisputeClient(
        auth=auth,
        base_url="https://api-m.sandbox.paypal.com",
        http_client=http_client,
        client_id="stub_client_id",
        client_secret="stub_secret",
    )
    return client


class MockRequest:
    def __init__(self, buyer_client=None):
        from agent.app.settings import Settings

        class AppState:
            pass

        self.app = AppState()
        self.app.state = AppState()
        self.app.state.settings = Settings()
        self.app.state.buyer_client = buyer_client


def _create_test_order(
    db,
    order_code="SIG-TEST-001",
    email="alex.morgan@example.test",
    amount=Decimal("42.00"),
    status=OrderStatus.PAID.value,
    tx_id="TX-TEST-001",
    demo_session_id=None,
):
    order = Order(
        order_code=order_code,
        merchant_id="MOCK-MERCHANT-001",
        customer_email=email,
        amount=amount,
        currency="USD",
        status=status,
        paypal_transaction_id=tx_id,
        items=[{"sku": "CND-LAV-01", "name": "Lavender Candle", "quantity": 2, "unit_price": "21.00"}],
        demo_session_id=demo_session_id,
        created_at=datetime.now(UTC),
    )
    db.add(order)
    db.commit()
    return order


def test_order_dispute_status_uniform_error_on_mismatch(db_session):
    """Uniform 404 error if order doesn't exist or email mismatches."""
    _create_test_order(db_session, order_code="SIG-ORD-1", email="alex.morgan@example.test")

    # Mismatched email
    with pytest.raises(NotFoundError, match="Order not found with the provided order code and email"):
        get_order_dispute_status("SIG-ORD-1", email="wrong@example.com", db=db_session)

    # Missing order code
    with pytest.raises(NotFoundError, match="Order not found with the provided order code and email"):
        get_order_dispute_status("SIG-MISSING", email="alex.morgan@example.test", db=db_session)


def test_order_dispute_status_unpaid_order(db_session):
    """Unpaid order is ineligible for disputes."""
    _create_test_order(
        db_session,
        order_code="SIG-UNPAID",
        email="alex.morgan@example.test",
        status=OrderStatus.PENDING.value,
        tx_id=None,
    )
    res = get_order_dispute_status("SIG-UNPAID", email="alex.morgan@example.test", db=db_session)
    assert res.dispute_eligible is False
    assert "paid and fulfilled" in (res.ineligibility_reason or "")


def test_order_dispute_status_unlinked_account(db_session):
    """Order placed by account other than linked sandbox buyer has dispute disabled with explanation."""
    _create_test_order(
        db_session,
        order_code="SIG-OTHER-01",
        email="someone.else@example.com",
        status=OrderStatus.PAID.value,
    )
    res = get_order_dispute_status("SIG-OTHER-01", email="someone.else@example.com", db=db_session)
    assert res.dispute_eligible is False
    assert "account other than the linked sandbox buyer" in (res.ineligibility_reason or "")
    assert "demo order shortcut" in (res.ineligibility_reason or "")


def test_order_dispute_status_eligible(db_session):
    """Paid order for linked sandbox buyer is eligible for dispute."""
    _create_test_order(db_session, order_code="SIG-ELIGIBLE", email="alex.morgan@example.test")
    res = get_order_dispute_status("SIG-ELIGIBLE", email="alex.morgan@example.test", db=db_session)
    assert res.dispute_eligible is True
    assert res.dispute_exists is False
    assert res.ineligibility_reason is None


@pytest.mark.asyncio
async def test_create_dispute_unlinked_account_rejected(db_session, stub_buyer_client):
    """Create dispute fails with 403 when buyer is unlinked."""
    _create_test_order(db_session, order_code="SIG-UNLINKED", email="unlinked@example.com")
    req = CreateDisputeRequest(
        customer_email="unlinked@example.com",
        reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        amount=Money(value=Decimal("42.00"), currency_code="USD"),
        message="Did not arrive",
    )
    request = MockRequest(buyer_client=stub_buyer_client)
    with pytest.raises(AppError) as exc_info:
        await create_buyer_dispute("SIG-UNLINKED", req, request, db=db_session)
    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "BUYER_NOT_LINKED"


@pytest.mark.asyncio
async def test_create_dispute_amount_validations(db_session, stub_buyer_client):
    """Amount exceeding order total or zero/negative is rejected."""
    _create_test_order(
        db_session, order_code="SIG-VAL-AMT", email="alex.morgan@example.test", amount=Decimal("30.00")
    )
    request = MockRequest(buyer_client=stub_buyer_client)

    # Exceeds total
    req_high = CreateDisputeRequest(
        customer_email="alex.morgan@example.test",
        reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        amount=Money(value=Decimal("35.00"), currency_code="USD"),
        message="Too high",
    )
    with pytest.raises(AppError) as exc_info:
        await create_buyer_dispute("SIG-VAL-AMT", req_high, request, db=db_session)
    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "AMOUNT_EXCEEDS_ORDER"

    # Currency mismatch
    req_curr = CreateDisputeRequest(
        customer_email="alex.morgan@example.test",
        reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        amount=Money(value=Decimal("20.00"), currency_code="EUR"),
        message="Wrong currency",
    )
    with pytest.raises(AppError) as exc_info:
        await create_buyer_dispute("SIG-VAL-AMT", req_curr, request, db=db_session)
    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "CURRENCY_MISMATCH"


def test_create_dispute_empty_message_validation():
    """Empty or whitespace-only message fails schema validation."""
    with pytest.raises(ValidationError):
        CreateDisputeRequest(
            customer_email="alex.morgan@example.test",
            reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
            amount=Money(value=Decimal("10.00"), currency_code="USD"),
            message="   ",
        )


def test_supported_reasons_rejects_unsupported():
    """Schema rejects unsupported dispute reasons."""
    with pytest.raises(ValidationError):
        CreateDisputeRequest(
            customer_email="alex.morgan@example.test",
            reason="UNAUTHORISED",  # type: ignore[arg-type]
            amount=Money(value=Decimal("10.00"), currency_code="USD"),
            message="Item missing",
        )


@pytest.mark.asyncio
async def test_create_dispute_success_and_markup_escaping(db_session, stub_buyer_client):
    """Successful dispute creation with HTML markup escaping."""
    _create_test_order(
        db_session,
        order_code="SIG-CREATE-OK",
        email="alex.morgan@example.test",
        amount=Decimal("42.00"),
        tx_id="TX-CREATE-001",
    )
    request = MockRequest(buyer_client=stub_buyer_client)
    req = CreateDisputeRequest(
        customer_email="alex.morgan@example.test",
        reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        amount=Money(value=Decimal("42.00"), currency_code="USD"),
        message='Package never arrived! <script>alert("hacked")</script>',
    )

    detail = await create_buyer_dispute("SIG-CREATE-OK", req, request, db=db_session)
    assert detail.id.startswith("PP-")
    assert detail.order_code == "SIG-CREATE-OK"
    assert detail.amount.value == Decimal("42.00")
    assert len(detail.messages) >= 1
    # Check that markup was safely escaped
    assert "<script>" not in detail.messages[0].content
    assert "&lt;script&gt;" in detail.messages[0].content
    assert detail.messages[0].posted_by == "BUYER"

    # Status check now reports dispute_exists=True
    status_res = get_order_dispute_status("SIG-CREATE-OK", email="alex.morgan@example.test", db=db_session)
    assert status_res.dispute_exists is True
    assert status_res.dispute_eligible is False
    assert status_res.dispute is not None
    assert status_res.dispute.id == detail.id


@pytest.mark.asyncio
async def test_duplicate_dispute_blocked(db_session, stub_buyer_client):
    """Filing a second dispute for the same transaction is blocked with 409 conflict."""
    _create_test_order(
        db_session,
        order_code="SIG-DUP-TEST",
        email="alex.morgan@example.test",
        amount=Decimal("42.00"),
        tx_id="TX-DUP-001",
    )
    request = MockRequest(buyer_client=stub_buyer_client)
    req = CreateDisputeRequest(
        customer_email="alex.morgan@example.test",
        reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        amount=Money(value=Decimal("42.00"), currency_code="USD"),
        message="First report",
    )

    # First attempt succeeds
    await create_buyer_dispute("SIG-DUP-TEST", req, request, db=db_session)

    # Second attempt fails with 409
    with pytest.raises(AppError) as exc_info:
        await create_buyer_dispute("SIG-DUP-TEST", req, request, db=db_session)
    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "DISPUTE_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_send_buyer_message_scenario_d(db_session, stub_buyer_client):
    """Buyer can reply with a message (Scenario D) and markup is escaped."""
    _create_test_order(
        db_session,
        order_code="SIG-MSG-TEST",
        email="alex.morgan@example.test",
        amount=Decimal("42.00"),
        tx_id="TX-MSG-001",
    )
    request = MockRequest(buyer_client=stub_buyer_client)
    req = CreateDisputeRequest(
        customer_email="alex.morgan@example.test",
        reason=SupportedDisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        amount=Money(value=Decimal("42.00"), currency_code="USD"),
        message="Initial problem",
    )
    await create_buyer_dispute("SIG-MSG-TEST", req, request, db=db_session)

    # Buyer sends reply
    reply_req = SendBuyerMessageRequest(
        customer_email="alex.morgan@example.test",
        message='Hostile response: <img src=x onerror=alert(1)> give refund immediately!',
    )
    updated = await send_buyer_dispute_message("SIG-MSG-TEST", reply_req, db=db_session)

    assert len(updated.messages) >= 2
    last_msg = updated.messages[-1]
    assert last_msg.posted_by == "BUYER"
    assert "<img" not in last_msg.content
    assert "&lt;img" in last_msg.content
    assert updated.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value


def test_offer_response_accept_and_deny(db_session):
    """Buyer responds to an offer (Scenario C / S9)."""
    _create_test_order(
        db_session,
        order_code="SIG-OFFER-TEST",
        email="alex.morgan@example.test",
        amount=Decimal("50.00"),
        tx_id="TX-OFFER-001",
    )
    dispute = Dispute(
        id="PP-TEST-OFFER-1",
        state_fingerprint="fp123",
        status=DisputeStatus.WAITING_FOR_BUYER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("50.00"),
        currency="USD",
        snapshot={
            "dispute_id": "PP-TEST-OFFER-1",
            "disputed_transactions": [{"seller_transaction_id": "TX-OFFER-001"}],
            "offer": {
                "type": "REFUND",
                "amount": {"value": "25.00", "currency_code": "USD"},
                "note": "Partial refund offered by merchant",
                "status": "OFFERED",
            },
            "messages": [],
        },
        created_at=datetime.now(UTC),
    )
    db_session.add(dispute)
    db_session.commit()

    # Deny offer
    deny_req = OfferResponseRequest(customer_email="alex.morgan@example.test", action=OfferAction.DENY)
    denied = respond_to_merchant_offer("SIG-OFFER-TEST", deny_req, db=db_session)
    assert denied.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value
    assert denied.offer is not None
    assert denied.offer.status == "DENIED"

    # Accept offer
    accept_req = OfferResponseRequest(customer_email="alex.morgan@example.test", action=OfferAction.ACCEPT)
    accepted = respond_to_merchant_offer("SIG-OFFER-TEST", accept_req, db=db_session)
    assert accepted.status == DisputeStatus.RESOLVED.value
    assert accepted.offer is not None
    assert accepted.offer.status == "ACCEPTED"
