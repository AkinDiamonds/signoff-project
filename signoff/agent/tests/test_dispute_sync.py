"""Tests for Dispute Sync, Fingerprinting, and Reconciliation Poller.

Fulfills Step 09 requirements and edge cases:
1. Sync handler: fetch, parse, store snapshot, compute fingerprint, write ledger event on change.
2. Fingerprint change + status requiring seller response -> enqueues one RUN_AGENT job.
3. Unchanged fingerprint -> no agent run, no new ledger event.
4. Resolved disputes cancel pending RUN_AGENT runs.
5. Reconcile job: lists open disputes, compares fingerprints, enqueues syncs.
6. Exhaustive DisputeState mapping: unknown PayPal statuses map to UNKNOWN, never error, never trigger run.
7. UPDATED arrives before CREATED: converges to same end state.
8. Webhook and reconcile hit same dispute: jobs coalesce.
9. Dispute 404 after being known: marked unavailable, keeps history, cancels pending runs.
10. Huge open list: capped per cycle.
11. Real sandbox dispute fixture syncs into database cleanly.
"""

import inspect
import json
import time
from collections.abc import Generator
from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from agent.app.db.models import Base, Dispute, Job, LedgerEvent
from agent.app.domain.enums import DisputeReason, DisputeStatus, JobKind, JobStatus, TimelineEventKind
from agent.app.errors import NotFoundError
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.models import Dispute as PayPalDisputeModel
from agent.app.paypal.models import parse_dispute, parse_dispute_list
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.queue import HandlerRegistry
from agent.app.sync import (
    DisputeState,
    ReconcileResult,
    is_dispute_resolved,
    map_dispute_state_to_db_status,
    map_paypal_reason,
    map_paypal_status_to_dispute_state,
    reconcile_disputes,
    register_sync_handlers,
    requires_seller_response,
    sync_dispute,
)


def get_fixtures_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parents[2] / "fixtures" / "paypal",
        Path(__file__).resolve().parents[3] / "signoff" / "fixtures" / "paypal",
        Path("signoff/fixtures/paypal").resolve(),
        Path("fixtures/paypal").resolve(),
    ]
    for c in candidates:
        if c.is_dir():
            return c
    raise FileNotFoundError("Could not find fixtures/paypal directory")


FIXTURES_DIR = get_fixtures_dir()


def load_fixture_json(filename: str) -> dict[str, Any]:
    with open(FIXTURES_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """In-memory SQLite database session fixture."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def mock_paypal_client() -> PayPalReadClient:
    """Mocked PayPalReadClient for deterministic unit tests."""
    auth = PayPalAuth(client_id="test-client-id", client_secret="test-client-secret")
    auth._access_token = "test-token"
    auth._expires_at = time.time() + 3600.0
    client = PayPalReadClient(auth=auth, base_url="https://api-m.sandbox.paypal.com")
    return client


# ---------------------------------------------------------------------------
# 1. Exhaustive DisputeState Mapping Tests
# ---------------------------------------------------------------------------


def test_dispute_state_mapping_known_statuses() -> None:
    """Verifies that all known PayPal status strings map to expected DisputeState."""
    assert (
        map_paypal_status_to_dispute_state("WAITING_FOR_SELLER_RESPONSE")
        == DisputeState.WAITING_FOR_SELLER_RESPONSE
    )
    assert (
        map_paypal_status_to_dispute_state("WAITING_FOR_BUYER_RESPONSE")
        == DisputeState.WAITING_FOR_BUYER_RESPONSE
    )
    assert map_paypal_status_to_dispute_state("UNDER_REVIEW") == DisputeState.UNDER_REVIEW
    assert map_paypal_status_to_dispute_state("UNDER_PAYPAL_REVIEW") == DisputeState.UNDER_REVIEW
    assert map_paypal_status_to_dispute_state("RESOLVED") == DisputeState.RESOLVED
    assert map_paypal_status_to_dispute_state("CLOSED") == DisputeState.RESOLVED
    assert map_paypal_status_to_dispute_state("OPEN") == DisputeState.OPEN
    assert map_paypal_status_to_dispute_state("INQUIRY") == DisputeState.OPEN


def test_dispute_state_mapping_unknown_statuses_never_error() -> None:
    """Unknown or future PayPal statuses map safely to UNKNOWN without raising errors."""
    assert map_paypal_status_to_dispute_state("SOMETHING_NEW_FROM_PAYPAL") == DisputeState.UNKNOWN
    assert map_paypal_status_to_dispute_state("ARBITRATION_PENDING") == DisputeState.UNKNOWN
    assert map_paypal_status_to_dispute_state(None) == DisputeState.UNKNOWN
    assert map_paypal_status_to_dispute_state("") == DisputeState.UNKNOWN


def test_dispute_state_seller_response_predicates() -> None:
    """Only WAITING_FOR_SELLER_RESPONSE triggers an agent run; UNKNOWN/others do not."""
    assert requires_seller_response(DisputeState.WAITING_FOR_SELLER_RESPONSE) is True
    assert requires_seller_response("WAITING_FOR_SELLER_RESPONSE") is True

    assert requires_seller_response(DisputeState.UNKNOWN) is False
    assert requires_seller_response("SOMETHING_UNKNOWN") is False
    assert requires_seller_response(DisputeState.WAITING_FOR_BUYER_RESPONSE) is False
    assert requires_seller_response(DisputeState.UNDER_REVIEW) is False
    assert requires_seller_response(DisputeState.RESOLVED) is False
    assert requires_seller_response(DisputeState.OPEN) is False
    assert requires_seller_response(DisputeState.UNAVAILABLE) is False
    assert requires_seller_response(None) is False


def test_dispute_resolved_predicate() -> None:
    """Predicate correctly identifies resolved/closed disputes."""
    assert is_dispute_resolved(DisputeState.RESOLVED) is True
    assert is_dispute_resolved("RESOLVED") is True
    assert is_dispute_resolved("CLOSED") is True
    assert is_dispute_resolved(DisputeState.WAITING_FOR_SELLER_RESPONSE) is False
    assert is_dispute_resolved(DisputeState.UNKNOWN) is False


def test_state_to_db_status_mapping() -> None:
    """All DisputeState values map to valid database DisputeStatus values."""
    for state in DisputeState:
        db_status = map_dispute_state_to_db_status(state)
        assert isinstance(db_status, DisputeStatus)
        assert db_status.value in [s.value for s in DisputeStatus]


def test_reason_mapping_fallback() -> None:
    """Known reasons map directly; unknown reasons fall back to DisputeReason.OTHER."""
    assert map_paypal_reason("MERCHANDISE_OR_SERVICE_NOT_RECEIVED") == DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED
    assert map_paypal_reason("SOME_WEIRD_REASON") == DisputeReason.OTHER
    assert map_paypal_reason(None) == DisputeReason.OTHER


# ---------------------------------------------------------------------------
# 2. Sync Handler Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sync_new_dispute_from_sandbox_fixture(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Syncs real sandbox dispute fixture into database, creating record, fingerprint, ledger event, and agent run."""
    fixture_data = load_fixture_json("s5-get-dispute.json")
    dispute_id = fixture_data["dispute_id"]

    async def mock_get_dispute(did: str) -> PayPalDisputeModel:
        assert did == dispute_id
        return parse_dispute(fixture_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_dispute)

    result = await sync_dispute(
        dispute_id=dispute_id,
        session=db_session,
        paypal_client=mock_paypal_client,
        event_id="WH-TEST-001",
        event_type="CUSTOMER.DISPUTE.CREATED",
    )

    assert result.dispute_id == dispute_id
    assert result.fingerprint_changed is True
    assert result.agent_run_enqueued is True
    assert result.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value

    # Verify DB record
    db_dispute = db_session.get(Dispute, dispute_id)
    assert db_dispute is not None
    assert db_dispute.amount == Decimal("10.00")
    assert db_dispute.currency == "USD"
    assert db_dispute.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value
    assert db_dispute.reason == DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value
    assert db_dispute.state_fingerprint == result.fingerprint

    # Verify Ledger Event
    ledger_events = (
        db_session.execute(select(LedgerEvent).where(LedgerEvent.dispute_id == dispute_id))
        .scalars()
        .all()
    )
    assert len(ledger_events) == 1
    assert ledger_events[0].sequence_number == 1
    assert ledger_events[0].event_kind == TimelineEventKind.DISPUTE_SYNCED.value
    assert ledger_events[0].payload["fingerprint"] == result.fingerprint
    assert ledger_events[0].payload["event_id"] == "WH-TEST-001"

    # Verify RUN_AGENT Job enqueued
    run_jobs = (
        db_session.execute(
            select(Job).where(
                Job.dispute_id == dispute_id,
                Job.kind == JobKind.RUN_AGENT.value,
            )
        )
        .scalars()
        .all()
    )
    assert len(run_jobs) == 1
    assert run_jobs[0].status == JobStatus.PENDING.value
    assert run_jobs[0].payload is not None
    assert run_jobs[0].payload["fingerprint"] == result.fingerprint


@pytest.mark.asyncio
async def test_sync_unchanged_fingerprint_no_agent_run(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Subsequent sync with identical fingerprint does not write ledger event or enqueue extra agent run."""
    fixture_data = load_fixture_json("s5-get-dispute.json")
    dispute_id = fixture_data["dispute_id"]

    async def mock_get_dispute(did: str) -> PayPalDisputeModel:
        return parse_dispute(fixture_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_dispute)

    # First sync
    res1 = await sync_dispute(dispute_id, db_session, mock_paypal_client)
    assert res1.fingerprint_changed is True
    assert res1.agent_run_enqueued is True

    # Mark first job completed
    job = db_session.execute(select(Job).where(Job.dispute_id == dispute_id)).scalar_one()
    job.status = JobStatus.COMPLETED.value
    db_session.flush()

    # Second sync with identical data
    res2 = await sync_dispute(dispute_id, db_session, mock_paypal_client)
    assert res2.fingerprint_changed is False
    assert res2.agent_run_enqueued is False

    # Check ledger events count is still 1
    events = (
        db_session.execute(select(LedgerEvent).where(LedgerEvent.dispute_id == dispute_id))
        .scalars()
        .all()
    )
    assert len(events) == 1

    # Check no second job created
    jobs = (
        db_session.execute(select(Job).where(Job.dispute_id == dispute_id))
        .scalars()
        .all()
    )
    assert len(jobs) == 1


@pytest.mark.asyncio
async def test_sync_resolved_dispute_cancels_pending_runs(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When dispute transitions to RESOLVED, any pending RUN_AGENT runs are cancelled."""
    open_data = load_fixture_json("s5-get-dispute.json")
    dispute_id = open_data["dispute_id"]

    # Initial sync in WAITING_FOR_SELLER_RESPONSE state
    async def mock_get_open(did: str) -> PayPalDisputeModel:
        return parse_dispute(open_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_open)
    res_open = await sync_dispute(dispute_id, db_session, mock_paypal_client)
    assert res_open.agent_run_enqueued is True

    # Verify pending job exists
    pending_job = db_session.execute(
        select(Job).where(
            Job.dispute_id == dispute_id,
            Job.kind == JobKind.RUN_AGENT.value,
            Job.status == JobStatus.PENDING.value,
        )
    ).scalar_one_or_none()
    assert pending_job is not None

    # Now dispute is resolved on PayPal
    resolved_data = deepcopy(open_data)
    resolved_data["status"] = "RESOLVED"
    resolved_data["dispute_state"] = "RESOLVED"

    async def mock_get_resolved(did: str) -> PayPalDisputeModel:
        return parse_dispute(resolved_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_resolved)
    res_resolved = await sync_dispute(dispute_id, db_session, mock_paypal_client)

    assert res_resolved.status == DisputeStatus.RESOLVED.value
    assert res_resolved.pending_runs_canceled == 1

    # Check pending job is no longer PENDING
    db_session.refresh(pending_job)
    assert pending_job.status == JobStatus.DEAD_LETTER.value
    assert "canceled" in (pending_job.last_error or "").lower()

    # Verify 2 ledger events in sequence
    events = (
        db_session.execute(
            select(LedgerEvent)
            .where(LedgerEvent.dispute_id == dispute_id)
            .order_by(LedgerEvent.sequence_number.asc())
        )
        .scalars()
        .all()
    )
    assert len(events) == 2
    assert events[0].sequence_number == 1
    assert events[1].sequence_number == 2
    assert events[1].payload is not None
    assert events[1].payload["status"] == DisputeStatus.RESOLVED.value


@pytest.mark.asyncio
async def test_dispute_disappears_404_marks_unavailable(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When an existing dispute returns 404 from PayPal, mark it unavailable, cancel runs, keep history."""
    open_data = load_fixture_json("s5-get-dispute.json")
    dispute_id = open_data["dispute_id"]

    async def mock_get_open(did: str) -> PayPalDisputeModel:
        return parse_dispute(open_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_open)
    await sync_dispute(dispute_id, db_session, mock_paypal_client)

    # Simulate dispute disappearing (404)
    async def mock_get_404(did: str) -> PayPalDisputeModel:
        raise NotFoundError("PayPal resource not found")

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_404)
    res_404 = await sync_dispute(dispute_id, db_session, mock_paypal_client)

    assert res_404.is_unavailable is True
    assert res_404.pending_runs_canceled == 1

    # Verify dispute in DB still exists and has unavailable snapshot flag
    db_dispute = db_session.get(Dispute, dispute_id)
    assert db_dispute is not None
    assert db_dispute.snapshot.get("unavailable") is True

    # Check pending job canceled
    job = db_session.execute(select(Job).where(Job.dispute_id == dispute_id)).scalar_one()
    assert job.status == JobStatus.DEAD_LETTER.value


# ---------------------------------------------------------------------------
# 3. Reconciliation Poller Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reconciler_enqueues_missing_disputes(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reconciler catches dropped webhooks by comparing fingerprints and enqueuing sync jobs."""
    list_fixture = load_fixture_json("s5-list-disputes.json")

    async def mock_list(
        page_size: int = 10,
        start_time: datetime | None = None,
        dispute_state: str | None = None,
        status: str | None = None,
        next_page_token: str | None = None,
    ) -> Any:
        return parse_dispute_list(list_fixture)

    monkeypatch.setattr(mock_paypal_client, "list_disputes", mock_list)

    result: ReconcileResult = await reconcile_disputes(
        session=db_session,
        paypal_client=mock_paypal_client,
    )

    # List fixture has 1 dispute summary
    assert result.checked_count == 1
    assert result.enqueued_count == 1
    assert "PP-R-MBX-REDACTED" in result.disputes_enqueued

    # Check SYNC_DISPUTE job created
    sync_job = db_session.execute(
        select(Job).where(
            Job.dispute_id == "PP-R-MBX-REDACTED",
            Job.kind == JobKind.SYNC_DISPUTE.value,
        )
    ).scalar_one_or_none()

    assert sync_job is not None
    assert sync_job.status == JobStatus.PENDING.value
    assert sync_job.payload is not None
    assert sync_job.payload["event_type"] == "RECONCILE"


@pytest.mark.asyncio
async def test_reconciler_coalesces_with_existing_pending_job(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If a sync job is already pending, reconciler does not create duplicate."""
    list_fixture = load_fixture_json("s5-list-disputes.json")
    dispute_id = list_fixture["items"][0]["dispute_id"]

    # Pre-existing pending sync job from webhook
    pre_job = Job(
        kind=JobKind.SYNC_DISPUTE.value,
        dispute_id=dispute_id,
        status=JobStatus.PENDING.value,
        payload={"dispute_id": dispute_id, "event_type": "WEBHOOK"},
    )
    db_session.add(pre_job)
    db_session.flush()

    async def mock_list(*args: Any, **kwargs: Any) -> Any:
        return parse_dispute_list(list_fixture)

    monkeypatch.setattr(mock_paypal_client, "list_disputes", mock_list)

    result = await reconcile_disputes(db_session, mock_paypal_client)
    assert result.checked_count == 1
    assert result.enqueued_count == 0

    # Still exactly one job
    jobs = db_session.execute(select(Job).where(Job.dispute_id == dispute_id)).scalars().all()
    assert len(jobs) == 1


@pytest.mark.asyncio
async def test_reconciler_caps_disputes_per_cycle(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Huge list of open disputes is capped at max_items per reconcile cycle."""
    list_fixture = load_fixture_json("s5-list-disputes.json")
    base_item = list_fixture["items"][0]

    # Create 10 items in list fixture
    items = []
    for i in range(10):
        item = deepcopy(base_item)
        item["dispute_id"] = f"PP-DISPUTE-{i:03d}"
        items.append(item)

    huge_list_data = {"items": items, "links": []}

    async def mock_list(*args: Any, **kwargs: Any) -> Any:
        return parse_dispute_list(huge_list_data)

    monkeypatch.setattr(mock_paypal_client, "list_disputes", mock_list)

    # Cap at 4
    result = await reconcile_disputes(db_session, mock_paypal_client, max_items=4)
    assert result.checked_count == 4
    assert result.enqueued_count == 4


# ---------------------------------------------------------------------------
# 4. Out-of-Order Webhook Event Sequence Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_updated_event_before_created_event_converges(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """UPDATED arriving before CREATED produces the exact same end state."""
    fixture_data = load_fixture_json("s5-get-dispute.json")
    dispute_id = fixture_data["dispute_id"]

    async def mock_get_dispute(did: str) -> PayPalDisputeModel:
        return parse_dispute(fixture_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_dispute)

    # First event received: UPDATED
    res_updated = await sync_dispute(
        dispute_id,
        db_session,
        mock_paypal_client,
        event_id="WH-UPDATED",
        event_type="CUSTOMER.DISPUTE.UPDATED",
    )
    assert res_updated.fingerprint_changed is True
    assert res_updated.agent_run_enqueued is True

    # Second event received late: CREATED
    res_created = await sync_dispute(
        dispute_id,
        db_session,
        mock_paypal_client,
        event_id="WH-CREATED",
        event_type="CUSTOMER.DISPUTE.CREATED",
    )
    assert res_created.fingerprint_changed is False
    assert res_created.agent_run_enqueued is False

    # State is perfectly consistent
    db_dispute = db_session.get(Dispute, dispute_id)
    assert db_dispute is not None
    assert db_dispute.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value


# ---------------------------------------------------------------------------
# 5. Handler Registry Integration Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_sync_handlers_integration(
    db_session: Session,
    mock_paypal_client: PayPalReadClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifies that register_sync_handlers integrates smoothly with HandlerRegistry."""
    fixture_data = load_fixture_json("s5-get-dispute.json")
    dispute_id = fixture_data["dispute_id"]

    async def mock_get_dispute(did: str) -> PayPalDisputeModel:
        return parse_dispute(fixture_data)

    monkeypatch.setattr(mock_paypal_client, "get_dispute", mock_get_dispute)

    registry = HandlerRegistry()
    register_sync_handlers(registry, paypal_client=mock_paypal_client)

    sync_handler = registry.get(JobKind.SYNC_DISPUTE)
    assert sync_handler is not None
    assert callable(sync_handler)

    job = Job(
        kind=JobKind.SYNC_DISPUTE.value,
        dispute_id=dispute_id,
        status=JobStatus.RUNNING.value,
        payload={"dispute_id": dispute_id},
    )
    db_session.add(job)
    db_session.flush()

    res = sync_handler(job, db_session)
    if inspect.isawaitable(res):
        await res

    db_dispute = db_session.get(Dispute, dispute_id)
    assert db_dispute is not None
    assert db_dispute.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value
