"""Comprehensive database schema, constraints, migrations, and trigger tests.

Validates all safety invariants defined in Step 03:
- Migration round-trip (upgrade -> downgrade -> upgrade).
- Append-only triggers rejecting raw SQL UPDATE and DELETE on decisions and ledger_events.
- Race conditions: concurrent insertions of identical webhook event ID (exactly one succeeds).
- Schema constraints:
  - Webhook event ID PK and unique transmission ID.
  - Executions decision_id uniqueness.
  - Exactly one pending job per dispute and kind.
  - Money as fixed-precision numeric (values with > 2 decimals rejected).
  - Timezone-aware timestamps on all datetime columns.
- Python enum to database CHECK constraint parity.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Engine,
    exc,
    select,
    text,
)
from sqlalchemy.orm import Session

from agent.app.db.base import Base
from agent.app.db.models import (
    AgentRun,
    Approval,
    Charter,
    Decision,
    DemoSession,
    Dispute,
    EvidenceFile,
    Execution,
    Job,
    LedgerEvent,
    Order,
    TrackingEvent,
    WebhookEvent,
)
from agent.app.db.session import get_engine, get_session_factory
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.enums import (
    ActionType,
    ApprovalResolution,
    DisputeReason,
    DisputeStatus,
    ExecutionStatus,
    JobKind,
    JobStatus,
    OrderStatus,
    TimelineEventKind,
    TrackingStatus,
    Verdict,
)


@pytest.fixture(scope="session")
def engine() -> Engine:
    """Return session-scoped database engine connected to Postgres or fallback."""
    eng = get_engine()
    install_append_only_triggers(eng)
    return eng


@pytest.fixture
def db_session(engine: Engine) -> Session:
    """Provide clean database session with cleanup after each test."""
    session_factory = get_session_factory(engine)
    session = session_factory()
    yield session
    session.rollback()
    session.close()


def test_migration_round_trip() -> None:
    """Validate Alembic migration up -> down -> up again works seamlessly."""
    root_dir = Path(__file__).resolve().parents[3]
    alembic_ini_path = root_dir / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini_path))

    # Downgrade to base, then upgrade to head
    command.downgrade(alembic_cfg, "base")
    command.upgrade(alembic_cfg, "head")

    # Repeat downgrade and upgrade to verify full idempotence
    command.downgrade(alembic_cfg, "base")
    command.upgrade(alembic_cfg, "head")


def test_decisions_trigger_rejects_raw_sql_update_and_delete(db_session: Session) -> None:
    """Raw SQL UPDATE or DELETE on decisions must be rejected by append-only trigger."""
    decision_id = uuid.uuid4()
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"

    # Insert a decision
    decision = Decision(
        id=decision_id,
        dispute_id=dispute_id,
        action_type=ActionType.PROVIDE_EVIDENCE.value,
        verdict=Verdict.ALLOW.value,
        rule_id="G7-01",
        reason="Automated evidence submission",
        action_hash="hash123",
        dispute_fingerprint="fp123",
        charter_version=1,
    )
    db_session.add(decision)
    db_session.commit()

    # Attempt raw SQL UPDATE
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("UPDATE decisions SET reason = 'tampered' WHERE id = :id"),
            {"id": decision_id},
        )
        db_session.commit()
    db_session.rollback()

    # Attempt raw SQL DELETE
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("DELETE FROM decisions WHERE id = :id"),
            {"id": decision_id},
        )
        db_session.commit()
    db_session.rollback()

    # Verify decision remains unchanged
    stored = db_session.execute(select(Decision).where(Decision.id == decision_id)).scalar_one()
    assert stored.reason == "Automated evidence submission"


def test_ledger_events_trigger_rejects_raw_sql_update_and_delete(db_session: Session) -> None:
    """Raw SQL UPDATE or DELETE on ledger_events must be rejected by append-only trigger."""
    event_id = uuid.uuid4()
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"

    ledger_event = LedgerEvent(
        id=event_id,
        dispute_id=dispute_id,
        sequence_number=1,
        event_kind=TimelineEventKind.WEBHOOK_RECEIVED.value,
        payload={"event": "test"},
    )
    db_session.add(ledger_event)
    db_session.commit()

    # Attempt raw SQL UPDATE
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("UPDATE ledger_events SET event_kind = 'MUTATED' WHERE id = :id"),
            {"id": event_id},
        )
        db_session.commit()
    db_session.rollback()

    # Attempt raw SQL DELETE
    with pytest.raises(exc.DBAPIError, match=r"(prohibited|append-only|ABORT)"):
        db_session.execute(
            text("DELETE FROM ledger_events WHERE id = :id"),
            {"id": event_id},
        )
        db_session.commit()
    db_session.rollback()

    # Verify ledger event remains intact
    stored = db_session.execute(select(LedgerEvent).where(LedgerEvent.id == event_id)).scalar_one()
    assert stored.event_kind == TimelineEventKind.WEBHOOK_RECEIVED.value


def test_ledger_event_sequence_number_positive_constraint(db_session: Session) -> None:
    """Ledger event sequence_number must be strictly >= 1."""
    event = LedgerEvent(
        id=uuid.uuid4(),
        dispute_id=f"PP-D-{uuid.uuid4().hex[:8]}",
        sequence_number=0,
        event_kind=TimelineEventKind.WEBHOOK_RECEIVED.value,
        payload={"test": 1},
    )
    db_session.add(event)
    with pytest.raises(exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_concurrent_webhook_duplicate_race(engine: Engine) -> None:
    """Two concurrent sessions inserting the same event id at once: exactly one succeeds."""
    event_id = f"WH-RACE-{uuid.uuid4().hex[:10]}"
    trans_id_1 = f"TRANS-{uuid.uuid4().hex[:8]}"
    trans_id_2 = f"TRANS-{uuid.uuid4().hex[:8]}"

    session_factory = get_session_factory(engine)
    results: list[bool] = []
    errors: list[Exception] = []

    def try_insert(trans_id: str) -> None:
        session = session_factory()
        try:
            event = WebhookEvent(
                id=event_id,
                transmission_id=trans_id,
                event_type="CUSTOMER.DISPUTE.CREATED",
                raw_payload={"test": 1},
                verified=True,
            )
            session.add(event)
            session.commit()
            results.append(True)
        except Exception as e:
            session.rollback()
            errors.append(e)
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(try_insert, trans_id_1),
            executor.submit(try_insert, trans_id_2),
        ]
        for f in futures:
            f.result()

    assert len(results) == 1, f"Expected exactly one successful insert, got {len(results)}"
    assert len(errors) == 1, f"Expected exactly one failure, got {len(errors)}"


def test_webhook_transmission_id_unique_constraint(db_session: Session) -> None:
    """Duplicate transmission_id must be rejected."""
    trans_id = f"TRANS-{uuid.uuid4().hex[:10]}"
    event1 = WebhookEvent(
        id=f"WH-1-{uuid.uuid4().hex[:6]}",
        transmission_id=trans_id,
        event_type="CUSTOMER.DISPUTE.CREATED",
        raw_payload={},
        verified=True,
    )
    event2 = WebhookEvent(
        id=f"WH-2-{uuid.uuid4().hex[:6]}",
        transmission_id=trans_id,
        event_type="CUSTOMER.DISPUTE.RESOLVED",
        raw_payload={},
        verified=True,
    )
    db_session.add(event1)
    db_session.commit()

    db_session.add(event2)
    with pytest.raises(exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_executions_decision_id_unique_constraint(db_session: Session) -> None:
    """decision_id on executions must be strictly unique."""
    decision_id = uuid.uuid4()
    decision = Decision(
        id=decision_id,
        dispute_id="PP-D-123",
        action_type=ActionType.PROVIDE_EVIDENCE.value,
        verdict=Verdict.ALLOW.value,
        rule_id="G7-01",
        reason="Auto ok",
        action_hash="h1",
        dispute_fingerprint="fp1",
        charter_version=1,
    )
    db_session.add(decision)
    db_session.commit()

    exec1 = Execution(
        decision_id=decision_id,
        dispute_id="PP-D-123",
        status=ExecutionStatus.INTENDED.value,
        request_hash="req1",
    )
    exec2 = Execution(
        decision_id=decision_id,
        dispute_id="PP-D-123",
        status=ExecutionStatus.INTENDED.value,
        request_hash="req2",
    )
    db_session.add(exec1)
    db_session.commit()

    db_session.add(exec2)
    with pytest.raises(exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_one_pending_job_per_dispute_and_kind(db_session: Session) -> None:
    """Safety rule: at most one pending job per dispute and kind."""
    dispute_id = f"PP-D-{uuid.uuid4().hex[:8]}"

    job1 = Job(
        dispute_id=dispute_id,
        kind=JobKind.SYNC_DISPUTE.value,
        status=JobStatus.PENDING.value,
    )
    db_session.add(job1)
    db_session.commit()

    # Second job with same dispute and kind but status PENDING must fail
    job2 = Job(
        dispute_id=dispute_id,
        kind=JobKind.SYNC_DISPUTE.value,
        status=JobStatus.PENDING.value,
    )
    db_session.add(job2)
    with pytest.raises(exc.IntegrityError):
        db_session.commit()
    db_session.rollback()

    # But a completed or running job with the same dispute and kind is permitted
    job3 = Job(
        dispute_id=dispute_id,
        kind=JobKind.SYNC_DISPUTE.value,
        status=JobStatus.COMPLETED.value,
    )
    db_session.add(job3)
    db_session.commit()


def test_money_fixed_precision_and_decimals_rule(db_session: Session) -> None:
    """Money must be 2 decimal places. Values with > 2 decimals are rejected, never silently floated."""
    dispute_valid = Dispute(
        id=f"PP-D-{uuid.uuid4().hex[:8]}",
        state_fingerprint="fp1",
        status=DisputeStatus.UNDER_REVIEW.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("150.25"),
        currency="USD",
        snapshot={"id": "test"},
    )
    db_session.add(dispute_valid)
    db_session.commit()

    # Values with > 2 decimal places are rejected by explicit rule
    with pytest.raises(ValueError, match="more than two decimals are rejected"):
        Dispute(
            id=f"PP-D-{uuid.uuid4().hex[:8]}",
            state_fingerprint="fp2",
            status=DisputeStatus.UNDER_REVIEW.value,
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
            amount=Decimal("150.255"),
            currency="USD",
            snapshot={"id": "test"},
        )

    # Floating point values are rejected (never silently floated)
    with pytest.raises(TypeError, match="Floating point values are strictly forbidden"):
        Dispute(
            id=f"PP-D-{uuid.uuid4().hex[:8]}",
            state_fingerprint="fp3",
            status=DisputeStatus.UNDER_REVIEW.value,
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
            amount=150.25,  # type: ignore
            currency="USD",
            snapshot={"id": "test"},
        )

    # None is rejected with a clear ValueError, not an InvalidOperation from Decimal
    with pytest.raises(ValueError, match="cannot be None"):
        Dispute(
            id=f"PP-D-{uuid.uuid4().hex[:8]}",
            state_fingerprint="fp4",
            status=DisputeStatus.UNDER_REVIEW.value,
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
            amount=None,  # type: ignore
            currency="USD",
            snapshot={"id": "test"},
        )

    # Non-numeric strings are rejected with a clear ValueError
    with pytest.raises(ValueError, match="Invalid decimal value"):
        Dispute(
            id=f"PP-D-{uuid.uuid4().hex[:8]}",
            state_fingerprint="fp5",
            status=DisputeStatus.UNDER_REVIEW.value,
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
            amount="not-a-number",  # type: ignore
            currency="USD",
            snapshot={"id": "test"},
        )

    # Non-finite decimals (Infinity, NaN) are rejected with a clear ValueError
    with pytest.raises(ValueError, match="Non-finite decimal values"):
        Dispute(
            id=f"PP-D-{uuid.uuid4().hex[:8]}",
            state_fingerprint="fp6",
            status=DisputeStatus.UNDER_REVIEW.value,
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
            amount=Decimal("NaN"),
            currency="USD",
            snapshot={"id": "test"},
        )

    with pytest.raises(ValueError, match="Non-finite decimal values"):
        Dispute(
            id=f"PP-D-{uuid.uuid4().hex[:8]}",
            state_fingerprint="fp7",
            status=DisputeStatus.UNDER_REVIEW.value,
            reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
            amount=Decimal("Infinity"),
            currency="USD",
            snapshot={"id": "test"},
        )

    with pytest.raises(ValueError, match="Non-finite decimal values"):
        Order(
            id=uuid.uuid4(),
            merchant_id="merchant_1",
            amount=Decimal("NaN"),
            currency="USD",
            status=OrderStatus.SHIPPED.value,
        )



def test_all_datetime_columns_are_timezone_aware() -> None:
    """Verify that every datetime column across all models has timezone=True."""
    all_models = [
        WebhookEvent,
        Job,
        Dispute,
        Charter,
        AgentRun,
        Decision,
        Execution,
        Approval,
        Order,
        TrackingEvent,
        EvidenceFile,
        LedgerEvent,
        DemoSession,
    ]

    for model in all_models:
        for column in model.__table__.columns:
            if isinstance(column.type, DateTime):
                assert column.type.timezone is True, (
                    f"Column {model.__tablename__}.{column.name} must have timezone=True"
                )


def test_enum_parity_between_python_enums_and_check_constraints() -> None:
    """Ensure database CHECK constraints strictly match Python enum definitions."""
    # Mapping of table -> column -> expected Enum class
    expected_enum_checks: dict[str, dict[str, type]] = {
        "decisions": {
            "action_type": ActionType,
            "verdict": Verdict,
        },
        "disputes": {
            "status": DisputeStatus,
            "reason": DisputeReason,
        },
        "jobs": {
            "kind": JobKind,
            "status": JobStatus,
        },
        "executions": {
            "status": ExecutionStatus,
        },
        "approvals": {
            "resolution": ApprovalResolution,
        },
        "orders": {
            "status": OrderStatus,
        },
        "tracking_events": {
            "status": TrackingStatus,
        },
        "ledger_events": {
            "event_kind": TimelineEventKind,
        },
    }

    metadata = Base.metadata

    for table_name, column_map in expected_enum_checks.items():
        table = metadata.tables[table_name]
        check_constraints = [c for c in table.constraints if isinstance(c, CheckConstraint)]

        for col_name, enum_cls in column_map.items():
            expected_values = {e.value for e in enum_cls}
            # Find the check constraint containing this column
            matching_constraint = None
            for ck in check_constraints:
                sql_text = str(ck.sqltext)
                if col_name in sql_text:
                    matching_constraint = ck
                    break

            assert matching_constraint is not None, f"Missing CHECK constraint for {table_name}.{col_name}"

            # Verify all expected values are present in the SQL text of constraint
            for val in expected_values:
                assert f"'{val}'" in str(matching_constraint.sqltext), (
                    f"Value '{val}' missing from {table_name}.{col_name} CHECK constraint"
                )
