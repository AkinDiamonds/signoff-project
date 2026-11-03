"""Persistent, generic notification events and owner-only inbox access."""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import Dispute, Notification, NotificationOutbox
from agent.app.domain.enums import TimelineEventKind
from agent.app.ledger.service import record_ledger_event
from agent.app.settings import Settings


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(
            Dispute(
                id="PP-NOTIFY",
                state_fingerprint="fp",
                status="WAITING_FOR_SELLER_RESPONSE",
                reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                amount=Decimal("24.00"),
                currency="USD",
                snapshot={},
            )
        )
        session.commit()
        yield session
    engine.dispose()


def test_notifications_are_transactional_generic_and_deduplicated(db):
    record_ledger_event(
        db,
        "PP-NOTIFY",
        TimelineEventKind.APPROVAL_REQUESTED,
        {"approval_id": "fictional-id", "buyer_message": "PRIVATE-TEXT"},
    )
    db.rollback()
    assert db.scalars(select(Notification)).all() == []
    for _ in range(2):
        record_ledger_event(
            db,
            "PP-NOTIFY",
            TimelineEventKind.APPROVAL_REQUESTED,
            {"approval_id": "fictional-id", "buyer_message": "PRIVATE-TEXT"},
        )
    db.commit()
    rows = db.scalars(select(Notification)).all()
    assert len(rows) == 1 and "PRIVATE-TEXT" not in rows[0].message
    assert len(db.scalars(select(NotificationOutbox)).all()) == 1


def test_repeated_dispute_sync_creates_only_one_new_dispute_notification(db):
    for _ in range(2):
        record_ledger_event(db, 'PP-NOTIFY', TimelineEventKind.DISPUTE_SYNCED,
                            {'status': 'WAITING_FOR_SELLER_RESPONSE'})
    db.commit()
    rows = db.scalars(select(Notification)).all()
    assert len(rows) == 1 and rows[0].kind == 'new_dispute'
    assert len(db.scalars(select(NotificationOutbox)).all()) == 1


def test_repeated_approval_for_same_decision_does_not_duplicate_notification(db):
    for approval_id in ('approval-1', 'approval-2'):
        record_ledger_event(db, 'PP-NOTIFY', TimelineEventKind.APPROVAL_REQUESTED,
                            {'approval_id': approval_id, 'decision_id': 'same-decision'})
    db.commit()
    assert len(db.scalars(select(Notification)).all()) == 1


def test_injection_warning_is_generic_and_contains_no_buyer_message(db):
    record_ledger_event(db, 'PP-NOTIFY', TimelineEventKind.INJECTION_FLAGGED,
                        {'message': 'PRIVATE BUYER CONTENT'})
    db.commit()
    item = db.scalars(select(Notification)).one()
    assert item.kind == 'review_needed' and item.message == 'A dispute needs your review.'


def test_postgres_deduplication_and_outbox_rollback_are_atomic():
    engine = create_engine(Settings().database_url)
    dispute_id = f'PP-NOTIFY-{uuid.uuid4().hex}'
    try:
        with Session(engine) as session:
            session.add(Dispute(id=dispute_id, state_fingerprint='fp', status='WAITING_FOR_SELLER_RESPONSE',
                                reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('24.00'),
                                currency='USD', snapshot={}))
            session.flush()
            for approval_id in ('approval-1', 'approval-2'):
                record_ledger_event(session, dispute_id, TimelineEventKind.APPROVAL_REQUESTED,
                                    {'approval_id': approval_id, 'decision_id': 'same-decision'})
            session.flush()
            rows = session.scalars(select(Notification).where(Notification.dispute_id == dispute_id)).all()
            assert len(rows) == 1 and session.get(NotificationOutbox, rows[0].id) is not None
            session.rollback()
        with Session(engine) as session:
            assert session.scalars(select(Notification).where(Notification.dispute_id == dispute_id)).all() == []
    finally:
        engine.dispose()


def test_unread_filter_paginates_unread_records_without_changing_total(db):
    from datetime import UTC, datetime

    from agent.app.api.notifications import list_notifications

    for index in range(4):
        db.add(Notification(dispute_id='PP-NOTIFY', kind='review_needed', dedupe_key=f'filter-{index}',
                            message='Update', read_at=datetime.now(UTC) if index == 0 else None))
    db.commit()
    page = list_notifications(db, limit=2, offset=0, unread_only=True)
    assert len(page.items) == 2
    assert all(item.read_at is None for item in page.items)
    assert page.unread_count == 3 and page.next_offset == 2
    last = list_notifications(db, limit=2, offset=2, unread_only=True)
    assert len(last.items) == 1 and last.next_offset is None
