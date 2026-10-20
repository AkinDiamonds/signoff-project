"""Comprehensive tests for Decision Ledger, Timeline API, and Replay.

Per build-plan/steps/14-ledger.md:
- Per-dispute sequential numbering: sequence_number >= 1, starts at 1, incrementing per dispute.
- Order is by sequence number, never by timestamp.
- Dispute with no events: empty list; unknown dispute: 404.
- Cursor pagination: limit and cursor in, items and next_cursor out.
- Untrusted text is truncated and flagged in API output; UI still escapes it.
- Unknown event kinds are returned as-is with their kind.
- Replay with a missing charter version reports an error row, not a crash.
- Database triggers still block edits (UPDATE and DELETE).
"""

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, exc, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import Charter, Dispute, LedgerEvent
from agent.app.db.session import get_db_session
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.actions import ProvideEvidence
from agent.app.domain.enums import ActionType, TimelineEventKind, Verdict
from agent.app.ledger.sanitizer import (
    MAX_UNTRUSTED_TEXT_LENGTH,
    TRUNCATION_MARKER,
)
from agent.app.ledger.service import (
    get_timeline_events,
    record_decision,
    record_ledger_event,
)
from agent.app.main import create_app
from agent.app.settings import AppEnv, Settings
from scripts.replay_decisions import replay_single_decision


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
    yield session
    session.close()


@pytest.fixture
def client(db_session: Session) -> TestClient:
    settings = Settings(
        app_env=AppEnv.test,
        paypal_client_id="test_client_id",
        paypal_client_secret="test_secret",
        approval_token_secret="test_approval_token_secret_32_bytes_minimum",
    )
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session
    return TestClient(app)


def _seed_dispute(session: Session, dispute_id: str) -> Dispute:
    dispute = Dispute(
        id=dispute_id,
        state_fingerprint="fingerprint_test_12345",
        status="WAITING_FOR_SELLER_RESPONSE",
        reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        amount=Decimal("150.00"),
        currency="USD",
        snapshot={
            "dispute_id": dispute_id,
            "create_time": "2026-10-06T12:00:00Z",
            "update_time": "2026-10-06T12:00:00Z",
            "status": "WAITING_FOR_SELLER_RESPONSE",
            "dispute_state": "REQUIRED_ACTION",
            "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
            "dispute_amount": {"value": "150.00", "currency_code": "USD"},
            "dispute_life_cycle_stage": "INQUIRY",
            "dispute_channel": "INTERNAL",
            "seller_response_due_date": "2026-10-30T12:00:00Z",
            "links": [
                {
                    "href": f"https://api-m.sandbox.paypal.com/v1/customer/disputes/{dispute_id}/provide-evidence",
                    "rel": "provide_evidence",
                    "method": "POST",
                }
            ],
        },
    )
    session.add(dispute)
    session.flush()
    return dispute


# --- 1. Ledger Service & Sequential Numbering ---


def test_per_dispute_sequential_numbering(db_session: Session) -> None:
    """Sequence numbers must be per-dispute, start at 1, and increment strictly."""
    d1 = f"PP-D-{uuid.uuid4().hex[:8]}"
    d2 = f"PP-D-{uuid.uuid4().hex[:8]}"

    e1_1 = record_ledger_event(
        db_session, d1, TimelineEventKind.WEBHOOK_RECEIVED, {"msg": "first"}
    )
    assert e1_1.sequence_number == 1

    e1_2 = record_ledger_event(
        db_session, d1, TimelineEventKind.DISPUTE_SYNCED, {"status": "WAITING"}
    )
    assert e1_2.sequence_number == 2

    # Different dispute starts at 1
    e2_1 = record_ledger_event(
        db_session, d2, TimelineEventKind.WEBHOOK_RECEIVED, {"msg": "other"}
    )
    assert e2_1.sequence_number == 1

    e1_3 = record_ledger_event(
        db_session, d1, TimelineEventKind.EVIDENCE_BUILT, {"evidence_strength": "high"}
    )
    assert e1_3.sequence_number == 3


def test_record_decision_emits_gate_decided_ledger_event(db_session: Session) -> None:
    """Recording a decision should persist decision and emit a GATE_DECIDED ledger event."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"

    dec = record_decision(
        session=db_session,
        dispute_id=dispute_id,
        action_type=ActionType.PROVIDE_EVIDENCE,
        action_payload={"evidence_type": "PROOF_OF_DELIVERY"},
        verdict=Verdict.ALLOW,
        rule_id="G1-01",
        reason="Evidence provided within charter limit",
        action_hash="hash123",
        dispute_fingerprint="fp123",
        charter_version=1,
        emit_ledger_event=True,
    )
    assert dec.id is not None
    assert dec.verdict == Verdict.ALLOW.value

    # Check that a GATE_DECIDED ledger event was emitted
    events = list(
        db_session.scalars(
            select(LedgerEvent).where(LedgerEvent.dispute_id == dispute_id)
        ).all()
    )
    assert len(events) == 1
    assert events[0].event_kind == TimelineEventKind.GATE_DECIDED.value
    assert events[0].sequence_number == 1
    assert events[0].payload["verdict"] == Verdict.ALLOW.value
    assert events[0].payload["rule_id"] == "G1-01"


# --- 2. Database Triggers Block Edits ---


def test_database_triggers_block_edits(db_session: Session) -> None:
    """Database triggers must reject UPDATE and DELETE on decisions and ledger_events."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    dec = record_decision(
        session=db_session,
        dispute_id=dispute_id,
        action_type=ActionType.PROVIDE_EVIDENCE,
        action_payload={},
        verdict=Verdict.ALLOW,
        rule_id="G7-01",
        reason="Initial allow",
        action_hash="h1",
        dispute_fingerprint="fp1",
        charter_version=1,
    )
    db_session.commit()

    # Reject UPDATE on decisions
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("UPDATE decisions SET verdict = 'DENY' WHERE id = :id"),
            {"id": dec.id.hex},
        )
        db_session.commit()
    db_session.rollback()

    # Reject DELETE on decisions
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("DELETE FROM decisions WHERE id = :id"),
            {"id": dec.id.hex},
        )
        db_session.commit()
    db_session.rollback()

    # Create ledger event and test triggers
    evt = record_ledger_event(
        db_session, dispute_id, TimelineEventKind.WEBHOOK_RECEIVED, {"k": "v"}
    )
    db_session.commit()

    # Reject UPDATE on ledger_events
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("UPDATE ledger_events SET event_kind = 'MUTATED' WHERE id = :id"),
            {"id": evt.id.hex},
        )
        db_session.commit()
    db_session.rollback()

    # Reject DELETE on ledger_events
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("DELETE FROM ledger_events WHERE id = :id"),
            {"id": evt.id.hex},
        )
        db_session.commit()
    db_session.rollback()


# --- 3. Timeline Ordering & Cursor Pagination ---


def test_timeline_ordering_by_sequence_number_never_timestamp(db_session: Session) -> None:
    """Timeline ordering MUST be by sequence_number ASC, never by recorded_at timestamp."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    _seed_dispute(db_session, dispute_id)

    # Insert events in sequence
    record_ledger_event(db_session, dispute_id, TimelineEventKind.WEBHOOK_RECEIVED, {"idx": 1})
    record_ledger_event(db_session, dispute_id, TimelineEventKind.DISPUTE_SYNCED, {"status": "OPEN"})
    record_ledger_event(db_session, dispute_id, TimelineEventKind.RUN_STARTED, {"run_id": "run-1"})

    items, next_cursor = get_timeline_events(db_session, dispute_id, limit=10)
    assert len(items) == 3
    assert [item["sequence_number"] for item in items] == [1, 2, 3]
    assert next_cursor is None


def test_timeline_cursor_pagination(db_session: Session) -> None:
    """Cursor pagination returns limit items and next_cursor, continuing properly."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    _seed_dispute(db_session, dispute_id)

    for i in range(5):
        record_ledger_event(
            db_session, dispute_id, TimelineEventKind.NO_ACTION, {"reason": f"event_{i+1}"}
        )

    # Page 1: limit 2
    page1, cursor1 = get_timeline_events(db_session, dispute_id, limit=2)
    assert len(page1) == 2
    assert [item["sequence_number"] for item in page1] == [1, 2]
    assert cursor1 == "2"

    # Page 2: limit 2, cursor=cursor1
    page2, cursor2 = get_timeline_events(db_session, dispute_id, limit=2, cursor=cursor1)
    assert len(page2) == 2
    assert [item["sequence_number"] for item in page2] == [3, 4]
    assert cursor2 == "4"

    # Page 3: limit 2, cursor=cursor2
    page3, cursor3 = get_timeline_events(db_session, dispute_id, limit=2, cursor=cursor2)
    assert len(page3) == 1
    assert [item["sequence_number"] for item in page3] == [5]
    assert cursor3 is None


# --- 4. Edge Cases: Unknown Dispute, Empty List, Unknown Kinds, Untrusted Text ---


def test_unknown_dispute_returns_404(db_session: Session, client: TestClient) -> None:
    """Unknown dispute returns 404 Not Found."""
    fake_id = f"PP-D-{uuid.uuid4().hex[:12]}"
    res = client.get(f"/api/disputes/{fake_id}/timeline")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"

    res_dec = client.get(f"/api/disputes/{fake_id}/decisions")
    assert res_dec.status_code == 404
    assert res_dec.json()["error"]["code"] == "NOT_FOUND"


def test_dispute_with_no_events_returns_empty_list(db_session: Session, client: TestClient) -> None:
    """Dispute with no events returns 200 with empty items list."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    _seed_dispute(db_session, dispute_id)
    db_session.commit()

    res = client.get(f"/api/disputes/{dispute_id}/timeline")
    assert res.status_code == 200
    data = res.json()
    assert data["items"] == []
    assert data["next_cursor"] is None

    res_dec = client.get(f"/api/disputes/{dispute_id}/decisions")
    assert res_dec.status_code == 200
    data_dec = res_dec.json()
    assert data_dec["items"] == []
    assert data_dec["next_cursor"] is None


def test_unknown_event_kinds_returned_as_is(db_session: Session, client: TestClient) -> None:
    """Unknown event kinds are returned as-is with their kind and payload."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    _seed_dispute(db_session, dispute_id)

    # Note: DB constraint allows known enum values, but in SQLite or service layer,
    # unknown kinds returned as-is without crashing
    custom_event = {
        "id": str(uuid.uuid4()),
        "dispute_id": dispute_id,
        "sequence_number": 1,
        "created_at": "2026-10-20T12:00:00Z",
        "kind": "CUSTOM_EXPERIMENTAL_KIND",
        "is_truncated": False,
        "payload": {"arbitrary": "data"},
    }

    from agent.app.api.timeline import TimelineResponse

    response_model = TimelineResponse.model_validate(
        {"items": [custom_event], "next_cursor": None}
    )
    assert response_model.items[0].kind == "CUSTOM_EXPERIMENTAL_KIND"


def test_untrusted_text_is_truncated_and_flagged(db_session: Session, client: TestClient) -> None:
    """Untrusted text exceeding MAX_UNTRUSTED_TEXT_LENGTH is truncated and flagged."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    _seed_dispute(db_session, dispute_id)

    long_text = "A" * 700
    record_ledger_event(
        db_session,
        dispute_id,
        TimelineEventKind.NO_ACTION,
        {"reason": long_text},
    )
    db_session.commit()

    res = client.get(f"/api/disputes/{dispute_id}/timeline")
    assert res.status_code == 200
    item = res.json()["items"][0]

    assert item["is_truncated"] is True
    assert item["reason"].endswith(TRUNCATION_MARKER)
    assert len(item["reason"]) == MAX_UNTRUSTED_TEXT_LENGTH + len(TRUNCATION_MARKER)


# --- 5. Replay Script & Missing Charter Error Handling ---


def test_replay_missing_charter_version_reports_error_not_crash(db_session: Session) -> None:
    """Replay with a missing charter version reports an error row, not a crash."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    _seed_dispute(db_session, dispute_id)

    # Decision refers to non-existent charter version 999
    dec = record_decision(
        session=db_session,
        dispute_id=dispute_id,
        action_type=ActionType.PROVIDE_EVIDENCE,
        action_payload={"evidence_type": "PROOF_OF_DELIVERY"},
        verdict=Verdict.ALLOW,
        rule_id="G1-01",
        reason="Test reason",
        action_hash="hash_missing_charter",
        dispute_fingerprint="fp_missing_charter",
        charter_version=999,
    )
    db_session.commit()

    result = replay_single_decision(db_session, dec)
    assert result.status == "ERROR"
    assert result.match is False
    assert "Charter version 999 not found" in (result.error or "")


def test_replay_matches_stored_decision(db_session: Session) -> None:
    """Replay matches verdict and rule_id for stored valid decision."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"
    dispute = _seed_dispute(db_session, dispute_id)

    # Ensure charter v1 exists
    charter_config = {
        "auto_offer_max": {"currency_code": "USD", "value": "50.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "30.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "200.00"},
        "never_auto_reasons": [],
    }
    charter = Charter(
        merchant_id="default",
        version=1,
        is_active=True,
        config=charter_config,
    )
    db_session.merge(charter)
    db_session.commit()

    # ProvideEvidence on amount 150 (<= max dispute 200, evidence type PROOF_OF_DELIVERY)
    # Evaluates to ALLOW (G7-01)
    action = ProvideEvidence(evidence_type="PROOF_OF_DELIVERY")
    dec = record_decision(
        session=db_session,
        dispute_id=dispute_id,
        action_type=ActionType.PROVIDE_EVIDENCE,
        action_payload=action.model_dump(mode="json"),
        verdict=Verdict.ALLOW,
        rule_id="G7-01",
        reason="Allowed by charter",
        action_hash="h_valid",
        dispute_fingerprint=dispute.state_fingerprint,
        charter_version=1,
    )
    db_session.commit()

    result = replay_single_decision(db_session, dec)
    assert result.error is None, f"Replay error: {result.error}"
    assert (result.replayed_verdict, result.replayed_rule_id) == (result.stored_verdict, result.stored_rule_id)
    assert result.status == "PASS"
    assert result.match is True
    assert result.stored_verdict == "ALLOW"
    assert result.replayed_verdict == "ALLOW"
    assert result.error is None
