"""Tests for Step 21: End-to-end walking path for scenarios A and B, KPIs, and disputes API.

Validates:
1. Scenario A and Scenario B run end-to-end through stub (webhook, sync, run, gate, execute, confirm, ledger).
2. KPI endpoint calculation and edge cases:
   - No closed disputes: ratios and hours saved are null, never NaN or divide error.
   - Non-USD currencies excluded from USD sums and counted separately.
   - Dispute resolved outside agent is not counted as auto-resolved.
   - Dispute resolved with human approval is not auto-resolved.
   - Dispute resolved without human approval is auto-resolved.
   - Hours-saved assumption value included in payload.
3. Disputes endpoints:
   - List with filters (status, reason, due-before), cursor pagination.
   - Invalid filters return 422.
   - Page size bounds (1-100) enforced.
   - Due-date sorting puts nulls last.
   - Detail endpoint returns snapshot and 404 on missing.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import Approval, Decision, Dispute
from agent.app.db.session import get_db_session
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.enums import (
    ActionType,
    ApprovalResolution,
    DisputeReason,
    DisputeStatus,
    ExecutionStatus,
    TimelineEventKind,
    Verdict,
)
from agent.app.main import create_app
from agent.app.policy.charter import get_or_seed_charter
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.store_mock.seed import seed_scenarios
from scripts.run_scenario import run_scenario


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    install_append_only_triggers(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = session_factory()
    seed_scenarios(session)
    get_or_seed_charter(session)
    session.commit()
    yield session
    session.close()


@pytest.fixture
def client(db_session: Session) -> httpx.AsyncClient:
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        paypal_merchant_id="MOCK-MERCHANT-001",
        approval_token_secret="test_approval_token_secret_32_bytes_minimum",
    )
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    )


# --- 1. Scenario End-to-End Walking Path Tests ---


@pytest.mark.asyncio
async def test_scenario_a_end_to_end_walking_path(db_session: Session):
    """Scenario A: delivered tracking, G7-01 ALLOW, provide-evidence executed, confirmed, full ledger chain."""
    result = await run_scenario("A", db_session=db_session)
    assert result.success
    assert result.scenario_id == "A"
    assert result.dispute_id == "PP-SCENARIO-A"
    assert result.verdict == Verdict.ALLOW.value
    assert result.rule_id == "G7-01"
    assert result.execution_status == ExecutionStatus.CONFIRMED.value

    # Verify complete 9-event ledger chain
    assert result.timeline_event_kinds == [
        TimelineEventKind.WEBHOOK_RECEIVED.value,
        TimelineEventKind.DISPUTE_SYNCED.value,
        TimelineEventKind.RUN_STARTED.value,
        TimelineEventKind.EVIDENCE_BUILT.value,
        TimelineEventKind.PLAN_PROPOSED.value,
        # The scenario plan proposes evidence + message; the runner executes the
        # evidence action, so two gate decisions are recorded.
        TimelineEventKind.GATE_DECIDED.value,
        TimelineEventKind.GATE_DECIDED.value,
        TimelineEventKind.EXECUTION_INTENDED.value,
        TimelineEventKind.EXECUTION_SENT.value,
        TimelineEventKind.EXECUTION_CONFIRMED.value,
    ]


@pytest.mark.asyncio
async def test_scenario_b_end_to_end_walking_path(db_session: Session):
    """Scenario B: $38 not-received inside charter limits, auto-handled, confirmed, full ledger chain."""
    result = await run_scenario("B", db_session=db_session)
    assert result.success
    assert result.scenario_id == "B"
    assert result.dispute_id == "PP-SCENARIO-B"
    assert result.verdict == Verdict.ALLOW.value
    assert result.execution_status == ExecutionStatus.CONFIRMED.value
    assert TimelineEventKind.EXECUTION_CONFIRMED.value in result.timeline_event_kinds


# --- 2. KPI Calculation & Edge Case Tests ---


@pytest.mark.asyncio
async def test_kpis_empty_db(client: httpx.AsyncClient):
    """No closed disputes: ratios and hours saved are null, never NaN or 0 division."""
    resp = await client.get("/api/kpis")
    assert resp.status_code == 200
    data = resp.json()
    assert data["open_disputes"] == 0
    assert data["dollars_at_risk"] == "0.00"
    assert data["recovered"] == "0.00"
    assert data["conceded"] == "0.00"
    assert data["closed_disputes"] == 0
    assert data["auto_resolved_disputes"] == 0
    assert data["share_auto_resolved"] is None
    assert data["estimated_hours_saved"] is None
    assert data["assumed_minutes_per_dispute"] == 20


@pytest.mark.asyncio
async def test_kpis_currency_isolation(client: httpx.AsyncClient, db_session: Session):
    """Disputes in other currencies are excluded from sums and counted separately."""
    now = datetime.now(UTC)
    usd_dispute = Dispute(
        id="PP-USD-1",
        state_fingerprint="fp1",
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("100.00"),
        currency="USD",
        snapshot={},
        created_at=now,
    )
    eur_dispute = Dispute(
        id="PP-EUR-1",
        state_fingerprint="fp2",
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("50.00"),
        currency="EUR",
        snapshot={},
        created_at=now,
    )
    db_session.add_all([usd_dispute, eur_dispute])
    db_session.commit()

    resp = await client.get("/api/kpis")
    assert resp.status_code == 200
    data = resp.json()

    assert data["open_disputes"] == 2
    assert data["dollars_at_risk"] == "100.00"  # EUR excluded from USD dollars at risk
    assert data["non_usd_open_disputes"] == 1
    assert data["other_currency_open_disputes"] == {"EUR": 1}


@pytest.mark.asyncio
async def test_kpis_auto_resolved_and_outside_agent_logic(client: httpx.AsyncClient, db_session: Session):
    """Dispute resolved outside agent is not counted as auto-resolved. Human approvals negate auto-resolved."""
    now = datetime.now(UTC)

    # 1. Closed dispute resolved outside the agent (no decisions)
    outside_dispute = Dispute(
        id="PP-OUTSIDE",
        state_fingerprint="fp-out",
        status=DisputeStatus.RESOLVED.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("20.00"),
        currency="USD",
        snapshot={"dispute_outcome": {"outcome_code": "RESOLVED_SELLER_FAVOUR"}},
        created_at=now,
    )

    # 2. Closed dispute auto-resolved by agent (has ALLOW decision, no human approval)
    auto_dispute = Dispute(
        id="PP-AUTO",
        state_fingerprint="fp-auto",
        status=DisputeStatus.RESOLVED.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("30.00"),
        currency="USD",
        snapshot={"dispute_outcome": {"outcome_code": "RESOLVED_SELLER_FAVOUR"}},
        created_at=now,
    )
    auto_decision = Decision(
        dispute_id="PP-AUTO",
        action_type=ActionType.PROVIDE_EVIDENCE.value,
        verdict=Verdict.ALLOW.value,
        rule_id="G7-01",
        reason="Tracking confirmed",
        action_hash="hash1",
        dispute_fingerprint="fp-auto",
        charter_version=1,
    )

    # 3. Closed dispute resolved with human approval (had APPROVE)
    human_dispute = Dispute(
        id="PP-HUMAN",
        state_fingerprint="fp-hum",
        status=DisputeStatus.RESOLVED.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("50.00"),
        currency="USD",
        snapshot={"refund_details": {"allowed_refund_amount": {"value": "50.00"}}},
        created_at=now,
    )
    human_decision = Decision(
        dispute_id="PP-HUMAN",
        action_type=ActionType.ACCEPT_CLAIM.value,
        verdict=Verdict.NEEDS_APPROVAL.value,
        rule_id="G3-01",
        reason="Over limit",
        action_hash="hash2",
        dispute_fingerprint="fp-hum",
        charter_version=1,
    )
    db_session.add_all([outside_dispute, auto_dispute, auto_decision, human_dispute, human_decision])
    db_session.flush()

    human_approval = Approval(
        decision_id=human_decision.id,
        dispute_id="PP-HUMAN",
        token_hash="tokenhash123",
        payload_hash="payloadhash123",
        expires_at=now + timedelta(days=1),
        resolution=ApprovalResolution.APPROVE.value,
    )
    db_session.add(human_approval)
    db_session.commit()

    resp = await client.get("/api/kpis")
    assert resp.status_code == 200
    data = resp.json()

    assert data["closed_disputes"] == 3
    assert data["auto_resolved_disputes"] == 1  # Only PP-AUTO
    assert data["share_auto_resolved"] == round(1 / 3, 4)
    assert data["recovered"] == "50.00"  # 20.00 (outside) + 30.00 (auto)
    assert data["conceded"] == "50.00"   # human dispute was refunded
    assert data["estimated_hours_saved"] == round((3 * 20) / 60.0, 2)


# --- 3. Disputes Endpoint & Filter Tests ---


@pytest.mark.asyncio
async def test_list_disputes_filters_and_validation(client: httpx.AsyncClient, db_session: Session):
    """Filters, due-date nulls-last sorting, and 422 validations."""
    now = datetime.now(UTC)
    d1 = Dispute(
        id="PP-D1",
        state_fingerprint="fp1",
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("15.00"),
        currency="USD",
        seller_response_due_date=now + timedelta(days=5),
        snapshot={},
        created_at=now,
    )
    d2 = Dispute(
        id="PP-D2",
        state_fingerprint="fp2",
        status=DisputeStatus.RESOLVED.value,
        reason=DisputeReason.UNAUTHORISED.value,
        amount=Decimal("75.00"),
        currency="USD",
        seller_response_due_date=None,  # Null due date
        snapshot={},
        created_at=now + timedelta(hours=1),
    )
    d3 = Dispute(
        id="PP-D3",
        state_fingerprint="fp3",
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("45.00"),
        currency="USD",
        seller_response_due_date=now + timedelta(days=2),
        snapshot={},
        created_at=now + timedelta(hours=2),
    )
    db_session.add_all([d1, d2, d3])
    db_session.commit()

    # 1. Default due_date asc sort puts nulls last: D3 (2 days), D1 (5 days), D2 (null)
    resp = await client.get("/api/disputes?sort_by=due_date&sort_direction=asc")
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert ids == ["PP-D3", "PP-D1", "PP-D2"]

    # 2. Filter by status
    resp = await client.get("/api/disputes?status=WAITING_FOR_SELLER_RESPONSE")
    assert resp.status_code == 200
    filtered_ids = [item["id"] for item in resp.json()["items"]]
    assert filtered_ids == ["PP-D3", "PP-D1"]

    # 3. Filter by reason
    resp = await client.get("/api/disputes?reason=UNAUTHORISED")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1
    assert resp.json()["items"][0]["id"] == "PP-D2"

    # 4. Filter by due-before
    cutoff = (now + timedelta(days=3)).isoformat()
    resp = await client.get(f"/api/disputes?due-before={cutoff}")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1
    assert resp.json()["items"][0]["id"] == "PP-D3"

    # 5. Invalid filter produces 422
    resp = await client.get("/api/disputes?status=INVALID_STATUS")
    assert resp.status_code == 422

    # 6. Page size bounds enforced (limit=0 -> 422, limit=101 -> 422)
    resp = await client.get("/api/disputes?limit=0")
    assert resp.status_code == 422

    resp = await client.get("/api/disputes?limit=101")
    assert resp.status_code == 422

    # 7. Invalid cursor produces 422
    resp = await client.get("/api/disputes?cursor=not-valid-base64")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_dispute_by_id(client: httpx.AsyncClient, db_session: Session):
    """GET /api/disputes/{id} returns 200 with snapshot or 404."""
    now = datetime.now(UTC)
    dispute = Dispute(
        id="PP-DETAIL-1",
        state_fingerprint="fp-det",
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("42.00"),
        currency="USD",
        seller_response_due_date=now + timedelta(days=5),
        snapshot={"dispute_id": "PP-DETAIL-1", "mock_field": "test_value"},
        created_at=now,
    )
    db_session.add(dispute)
    db_session.commit()

    resp = await client.get("/api/disputes/PP-DETAIL-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "PP-DETAIL-1"
    assert data["amount"] == {"currency_code": "USD", "value": "42.00"}
    assert data["snapshot"]["mock_field"] == "test_value"

    # 404 for nonexistent dispute
    resp_404 = await client.get("/api/disputes/NONEXISTENT")
    assert resp_404.status_code == 404
