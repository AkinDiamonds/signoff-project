"""Step 23 tests: pool, scenario creation, session scoping, quotas, reset."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import DemoSession, Dispute, LedgerEvent, Order
from agent.app.db.session import get_db_session
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.enums import TimelineEventKind
from agent.app.domain.money import Money
from agent.app.errors import UpstreamUnavailableError
from agent.app.ledger.service import record_ledger_event
from agent.app.main import create_app
from agent.app.paypal.models import (
    AllowedResponseOptions,
    BuyerInfo,
    DisputedTransaction,
)
from agent.app.paypal.models import (
    Dispute as PayPalDispute,
)
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.simulator import service
from agent.app.simulator.quotas import DemoQuotas
from scripts.seed_sandbox import seed_pool


class FakeBuyerClient:
    """Records calls and returns a parseable dispute without any network."""

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[dict] = []

    async def create_dispute(self, **kwargs) -> PayPalDispute:
        self.calls.append(kwargs)
        if self.fail:
            raise UpstreamUnavailableError("create-dispute failed")
        number = len(self.calls)
        return PayPalDispute(
            dispute_id=f"PP-DEMO-{number:04d}",
            create_time=datetime.now(UTC),
            update_time=datetime.now(UTC),
            dispute_amount=Money(currency_code="USD", value=Decimal(str(kwargs["amount"]))),
            status="WAITING_FOR_SELLER_RESPONSE",
            reason=kwargs["reason"],
            dispute_state="REQUIRED_ACTION",
            dispute_life_cycle_stage="INQUIRY",
            dispute_channel="INTERNAL",
            seller_response_due_date=datetime.now(UTC) + timedelta(days=10),
            disputed_transactions=[
                DisputedTransaction(
                    buyer_transaction_id="TX-BUYER",
                    seller_transaction_id=kwargs["seller_transaction_id"],
                    buyer=BuyerInfo(payer_id=kwargs["buyer_payer_id"]),
                )
            ],
            allowed_response_options=AllowedResponseOptions(),
        )

    async def close(self) -> None:
        return None


@pytest.fixture
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    install_append_only_triggers(engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)()
    seed_pool(session, copies=2)
    session.commit()
    yield session
    session.close()


def build_app(db: Session, *, frozen: bool = False, buyer_client=None):
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        approval_token_secret="test_approval_token_secret_32_bytes_minimum",
        demo_frozen=frozen,
    )
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db
    app.state.buyer_client = buyer_client or FakeBuyerClient()
    return app


def client_for(app) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")


# --- Pool and creation ---


@pytest.mark.asyncio
async def test_pool_endpoint_reports_availability(db_session: Session):
    app = build_app(db_session)
    async with client_for(app) as client:
        resp = await client.get("/api/demo/pool")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 10  # five scenarios x two copies
    assert body["available"] == 10
    assert body["by_scenario"]["E"]["available"] == 2


@pytest.mark.asyncio
async def test_create_scenario_claims_transaction_and_tags_session(db_session: Session):
    app = build_app(db_session)
    async with client_for(app) as client:
        resp = await client.post("/api/demo/scenarios/A")

    assert resp.status_code == 201
    body = resp.json()
    assert body["scenario_id"] == "A"
    assert body["reason"] == "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
    assert resp.headers["X-Demo-Session"] == body["session_id"]

    dispute = db_session.get(Dispute, body["dispute_id"])
    assert dispute is not None
    assert dispute.demo_session_id == body["session_id"]
    claimed = db_session.scalar(
        select(Order).where(Order.paypal_transaction_id == body["transaction_id"])
    )
    assert claimed is not None
    assert claimed.demo_session_id == body["session_id"]


def test_two_claims_never_return_the_same_transaction(db_session: Session):
    first = service.new_session(db_session, now=datetime.now(UTC), ttl_hours=1)
    second = service.new_session(db_session, now=datetime.now(UTC), ttl_hours=1)

    one = service.claim_order(db_session, "A", first.id)
    two = service.claim_order(db_session, "A", second.id)

    assert one is not None and two is not None
    assert one.id != two.id


@pytest.mark.asyncio
async def test_empty_pool_returns_conflict(db_session: Session):
    app = build_app(db_session)
    async with client_for(app) as client:
        assert (await client.post("/api/demo/scenarios/A")).status_code == 201
        assert (await client.post("/api/demo/scenarios/A")).status_code == 201
        empty = await client.post("/api/demo/scenarios/A")

    assert empty.status_code == 409
    assert empty.json()["error"]["code"] == "POOL_EMPTY"


# --- Quotas and kill switch ---


@pytest.mark.asyncio
async def test_quota_rejects_with_reset_time(db_session: Session):
    app = build_app(db_session)
    app.state.demo_quotas = DemoQuotas(per_session_per_day=1, per_ip_per_day=100)

    async with client_for(app) as client:
        first = await client.post("/api/demo/scenarios/A")
        limited = await client.post(
            "/api/demo/scenarios/A",
            headers={"X-Demo-Session": first.json()["session_id"]},
        )

    assert limited.status_code == 429
    assert "Resets at" in limited.json()["error"]["message"]


@pytest.mark.asyncio
async def test_frozen_demo_returns_503(db_session: Session):
    app = build_app(db_session, frozen=True)
    async with client_for(app) as client:
        resp = await client.post("/api/demo/scenarios/A")

    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "FROZEN"


# --- Sessions, idempotency, failures ---


@pytest.mark.asyncio
async def test_spoofed_session_is_replaced(db_session: Session):
    app = build_app(db_session)
    async with client_for(app) as client:
        resp = await client.post(
            "/api/demo/scenarios/A", headers={"X-Demo-Session": "not-a-real-session"}
        )

    assert resp.status_code == 201
    issued = resp.json()["session_id"]
    assert issued != "not-a-real-session"
    assert db_session.get(DemoSession, issued) is not None


@pytest.mark.asyncio
async def test_idempotency_key_prevents_duplicate_claim(db_session: Session):
    buyer = FakeBuyerClient()
    app = build_app(db_session, buyer_client=buyer)
    headers = {"Idempotency-Key": "double-click-1"}

    async with client_for(app) as client:
        first = await client.post("/api/demo/scenarios/A", headers=headers)
        second = await client.post(
            "/api/demo/scenarios/A",
            headers={**headers, "X-Demo-Session": first.json()["session_id"]},
        )

    assert first.status_code == second.status_code == 201
    assert first.json()["dispute_id"] == second.json()["dispute_id"]
    assert len(buyer.calls) == 1


@pytest.mark.asyncio
async def test_create_failure_releases_the_claim(db_session: Session):
    app = build_app(db_session, buyer_client=FakeBuyerClient(fail=True))

    async with client_for(app) as client:
        resp = await client.post("/api/demo/scenarios/A")

    assert resp.status_code == 503
    assert resp.json()["error"]["correlation_id"]
    orders = db_session.scalars(select(Order).where(Order.order_code.like("SIG-A-%"))).all()
    assert all(order.demo_session_id is None for order in orders)


@pytest.mark.asyncio
async def test_reset_hides_disputes_without_deleting_ledger(db_session: Session):
    app = build_app(db_session)
    async with client_for(app) as client:
        created = (await client.post("/api/demo/scenarios/A")).json()
        record_ledger_event(
            db_session,
            created["dispute_id"],
            TimelineEventKind.RUN_STARTED,
            {"test": True},
        )
        db_session.commit()
        ledger_before = db_session.scalar(select(LedgerEvent).where(
            LedgerEvent.dispute_id == created["dispute_id"]
        ))
        assert ledger_before is not None

        reset = await client.post("/api/demo/reset", headers={"X-Demo-Session": created["session_id"]})

    assert reset.status_code == 200
    body = reset.json()
    assert body["hidden_disputes"] == 1
    assert body["session_id"] != created["session_id"]
    old_session = db_session.get(DemoSession, created["session_id"])
    assert old_session is not None
    assert old_session.is_active is False
    assert db_session.get(Dispute, created["dispute_id"]) is not None
    assert db_session.scalar(
        select(LedgerEvent).where(LedgerEvent.dispute_id == created["dispute_id"])
    ) is not None


@pytest.mark.asyncio
async def test_scenario_a_created_from_endpoint_against_stub(db_session: Session, monkeypatch):
    """Full path: endpoint -> buyer assertion client -> PayPal stub -> stored dispute."""
    from agent.app.paypal.auth import PayPalAuth
    from agent.app.paypal.buyer_client import BuyerDisputeClient
    from scripts.paypal_stub.app import create_stub_app

    monkeypatch.setenv("PAYPAL_ENV", "stub")
    monkeypatch.setenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "client-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "secret")

    stub = create_stub_app()
    stub_http = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=stub),
        base_url="https://api-m.sandbox.paypal.com",
    )
    auth = PayPalAuth(
        client_id="client-id",
        client_secret="secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=stub_http,
    )
    auth._access_token = "stub-token"
    auth._expires_at = 9999999999.0
    buyer = BuyerDisputeClient(
        auth=auth,
        base_url="https://api-m.sandbox.paypal.com",
        http_client=stub_http,
        client_id="client-id",
        client_secret="secret",
    )
    app = build_app(db_session, buyer_client=buyer)

    async with client_for(app) as client:
        resp = await client.post("/api/demo/scenarios/A")

    assert resp.status_code == 201
    created = resp.json()
    stored = stub.state.stub.get_dispute(created["dispute_id"])
    assert stored is not None
    assert stored["disputed_transactions"][0]["seller_transaction_id"] == created["transaction_id"]
    assert db_session.get(Dispute, created["dispute_id"]) is not None
    await stub_http.aclose()


@pytest.mark.asyncio
async def test_scenario_d_carries_injection_message(db_session: Session):
    buyer = FakeBuyerClient()
    app = build_app(db_session, buyer_client=buyer)
    async with client_for(app) as client:
        resp = await client.post("/api/demo/scenarios/D")

    assert resp.status_code == 201
    assert "Ignore previous instructions" in buyer.calls[0]["message"]
