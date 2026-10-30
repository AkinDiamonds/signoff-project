"""Tests for judge flow: hold mode, claim endpoint, pool listing, and approval URL (Part D, F)."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.approvals.service import DEMO_APPROVAL_LINKS, create_approval, record_demo_approval_link
from agent.app.db.base import Base
from agent.app.db.models import Decision, DemoPool, Dispute, Job, LedgerEvent
from agent.app.db.session import get_db_session
from agent.app.domain.enums import DisputeReason, DisputeStatus, JobKind, JobStatus, TimelineEventKind, Verdict
from agent.app.domain.money import Money
from agent.app.main import create_app
from agent.app.paypal.models import AllowedResponseOptions, BuyerInfo, Dispute as PayPalDispute, DisputedTransaction, Money as PPMoney
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.sync.handler import sync_dispute


class DummyPayPalClient:
    def __init__(self, dispute: PayPalDispute) -> None:
        self.dispute = dispute

    async def get_dispute(self, dispute_id: str) -> PayPalDispute:
        return self.dispute


@pytest.fixture
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)()
    yield session
    session.close()


def _make_sample_dispute(dispute_id: str = "PP-D-HOLD-1") -> PayPalDispute:
    now = datetime.now(UTC)
    return PayPalDispute(
        dispute_id=dispute_id,
        create_time=now,
        update_time=now,
        dispute_amount=PPMoney(currency_code="USD", value=Decimal("42.00")),
        status="WAITING_FOR_SELLER_RESPONSE",
        reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        dispute_state="REQUIRED_ACTION",
        dispute_life_cycle_stage="INQUIRY",
        dispute_channel="INTERNAL",
        seller_response_due_date=now + timedelta(days=10),
        disputed_transactions=[
            DisputedTransaction(
                buyer_transaction_id="TX-BUYER-1",
                seller_transaction_id="TX-SELLER-1",
                buyer=BuyerInfo(payer_id="PAYER-1"),
            )
        ],
        allowed_response_options=AllowedResponseOptions(),
    )


@pytest.mark.asyncio
async def test_hold_mode_pools_new_dispute_without_enqueuing_agent(db_session: Session):
    dispute_id = "PP-D-HOLD-100"
    pp_dispute = _make_sample_dispute(dispute_id)
    client = DummyPayPalClient(pp_dispute)
    settings = Settings(demo_hold_disputes=True)

    result = await sync_dispute(dispute_id, db_session, client, settings=settings)

    assert result.agent_run_enqueued is False

    # Check DemoPool row
    pool_row = db_session.get(DemoPool, dispute_id)
    assert pool_row is not None
    assert pool_row.state == "pooled"
    assert pool_row.claimed_at is None

    # Check DISPUTE_POOLED ledger event
    ledger_events = db_session.execute(
        select(LedgerEvent).where(LedgerEvent.dispute_id == dispute_id).order_by(LedgerEvent.sequence_number)
    ).scalars().all()
    event_kinds = [e.event_kind for e in ledger_events]
    assert TimelineEventKind.DISPUTE_POOLED.value in event_kinds

    # Verify no RUN_AGENT job enqueued
    jobs = db_session.execute(
        select(Job).where(Job.dispute_id == dispute_id, Job.kind == JobKind.RUN_AGENT.value)
    ).scalars().all()
    assert len(jobs) == 0


def test_claim_endpoint_empty_or_invalid_token_returns_404(db_session: Session):
    settings = Settings(demo_claim_token="secret-claim-token")
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session

    client = TestClient(app)

    # Empty token setting test
    no_token_app = create_app(Settings(demo_claim_token=""))
    no_token_app.dependency_overrides[get_db_session] = lambda: db_session
    no_token_client = TestClient(no_token_app)
    resp = no_token_client.post("/api/demo/claim/PP-123", headers={"X-Demo-Token": "secret-claim-token"})
    assert resp.status_code == 404

    # Missing header
    resp = client.post("/api/demo/claim/PP-123")
    assert resp.status_code == 404

    # Wrong header
    resp = client.post("/api/demo/claim/PP-123", headers={"X-Demo-Token": "wrong-token"})
    assert resp.status_code == 404


def test_claim_endpoint_unknown_dispute_returns_404(db_session: Session):
    settings = Settings(demo_claim_token="secret-claim-token")
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session
    client = TestClient(app)

    resp = client.post("/api/demo/claim/PP-UNKNOWN", headers={"X-Demo-Token": "secret-claim-token"})
    assert resp.status_code == 404


def test_claim_endpoint_success_and_double_claim_409(db_session: Session):
    dispute_id = "PP-CLAIM-TEST-1"
    now = datetime.now(UTC)

    # Seed Dispute and DemoPool row
    dispute = Dispute(
        id=dispute_id,
        status=DisputeStatus.UNDER_REVIEW.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("42.00"),
        currency="USD",
        state_fingerprint="fp-test-123",
        snapshot={},
    )
    pool_row = DemoPool(
        dispute_id=dispute_id,
        state="pooled",
        scenario_label="Delivered with tracking — the agent fights this one",
    )
    db_session.add_all([dispute, pool_row])
    db_session.commit()

    settings = Settings(demo_claim_token="secret-claim-token")
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session
    client = TestClient(app)

    # First claim: succeeds
    resp1 = client.post(
        f"/api/demo/claim/{dispute_id}",
        headers={"X-Demo-Token": "secret-claim-token"},
    )
    assert resp1.status_code == 200
    body1 = resp1.json()
    assert body1["dispute_id"] == dispute_id
    assert body1["status"] == "claimed"

    # Verify pool state is claimed and job enqueued
    db_session.refresh(pool_row)
    assert pool_row.state == "claimed"
    assert pool_row.claimed_at is not None

    job = db_session.execute(
        select(Job).where(Job.dispute_id == dispute_id, Job.kind == JobKind.RUN_AGENT.value)
    ).scalar_one_or_none()
    assert job is not None
    assert job.status == JobStatus.PENDING.value

    # Second claim: returns 409 ALREADY_CLAIMED
    resp2 = client.post(
        f"/api/demo/claim/{dispute_id}",
        headers={"X-Demo-Token": "secret-claim-token"},
    )
    assert resp2.status_code == 409
    body2 = resp2.json()
    assert body2.get("code") == "ALREADY_CLAIMED" or body2.get("error", {}).get("code") == "ALREADY_CLAIMED"


def test_get_demo_pool_listing(db_session: Session):
    dispute_id = "PP-POOL-LIST-1"
    now = datetime.now(UTC)
    dispute = Dispute(
        id=dispute_id,
        status=DisputeStatus.UNDER_REVIEW.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("99.50"),
        currency="USD",
        state_fingerprint="fp-list-123",
        seller_response_due_date=now + timedelta(days=5),
        snapshot={"disputed_transactions": []},
    )
    pool_row = DemoPool(
        dispute_id=dispute_id,
        state="pooled",
        scenario_label="Larger than your limit — needs your approval",
        created_at=now,
    )
    db_session.add_all([dispute, pool_row])
    db_session.commit()

    settings = Settings(demo_hold_disputes=True)
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session
    client = TestClient(app)

    resp = client.get("/api/demo/pool")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    target = next((item for item in items if item["dispute_id"] == dispute_id), None)
    assert target is not None
    assert target["state"] == "pooled"
    assert target["scenario_label"] == "Larger than your limit — needs your approval"
    assert target["amount"]["value"] == "99.50"
    assert target["amount"]["currency_code"] == "USD"
    assert target["reason"] == "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
    # Buyer notes and tokens must not leak
    assert "token" not in target
    assert "notes" not in target
    assert "buyer_messages" not in target


def test_dispute_detail_approval_url(db_session: Session):
    dispute_id = "PP-APPROVAL-URL-1"
    now = datetime.now(UTC)
    dispute = Dispute(
        id=dispute_id,
        status=DisputeStatus.UNDER_REVIEW.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("150.00"),
        currency="USD",
        state_fingerprint="fp-approval-123",
        snapshot={},
    )
    db_session.add(dispute)
    db_session.commit()

    # Case 1: demo_show_approval_links is False -> approval_url is None
    settings_off = Settings(demo_show_approval_links=False, web_base_url="https://signoff.test")
    app_off = create_app(settings_off)
    app_off.dependency_overrides[get_db_session] = lambda: db_session
    client_off = TestClient(app_off)

    resp = client_off.get(f"/api/disputes/{dispute_id}")
    assert resp.status_code == 200
    assert resp.json().get("approval_url") is None

    # Case 2: demo_show_approval_links is True but no token recorded -> approval_url is None
    settings_on = Settings(demo_show_approval_links=True, web_base_url="https://signoff.test")
    app_on = create_app(settings_on)
    app_on.dependency_overrides[get_db_session] = lambda: db_session
    client_on = TestClient(app_on)

    resp = client_on.get(f"/api/disputes/{dispute_id}")
    assert resp.status_code == 200
    assert resp.json().get("approval_url") is None

    # Case 3: demo_show_approval_links is True and token recorded -> approval_url is populated
    record_demo_approval_link(dispute_id, "mock-raw-approval-token-xyz")
    resp = client_on.get(f"/api/disputes/{dispute_id}")
    assert resp.status_code == 200
    assert resp.json().get("approval_url") == "https://signoff.test/approve/mock-raw-approval-token-xyz"

    # Case 4: List endpoint never populates approval_url
    list_resp = client_on.get("/api/disputes")
    assert list_resp.status_code == 200
    for item in list_resp.json()["items"]:
        assert "approval_url" not in item or item["approval_url"] is None

