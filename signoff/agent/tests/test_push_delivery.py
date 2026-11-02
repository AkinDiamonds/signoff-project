"""Synthetic push delivery checks; no provider, payment, or real device is contacted."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import sessionmaker

from agent.app.db.base import Base
from agent.app.db.models import Dispute, Notification, NotificationOutbox, PushDelivery, PushSubscription
from agent.app.notifications.delivery import claim_delivery, deadline_reminders, deliver_one, expand_outbox
from agent.app.notifications.push import validate_endpoint
from agent.app.settings import Settings


@pytest.fixture
def push_db():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as session:
        session.add(Dispute(id='PP-PUSH', state_fingerprint='fp', status='WAITING_FOR_SELLER_RESPONSE',
                            reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('24.00'),
                            snapshot={}, seller_response_due_date=datetime.now(UTC) + timedelta(hours=12)))
        session.add(PushSubscription(id=uuid.uuid4(), endpoint_hash='test', endpoint='PRIVATE_ENDPOINT',
                                    p256dh='PRIVATE_KEY', auth='PRIVATE_AUTH', vapid_key='public-fixture',
                                    created_at=datetime.now(UTC) - timedelta(days=1), active=True))
        session.commit()
    yield factory
    engine.dispose()


def push_settings():
    return Settings(WEB_PUSH_VAPID_PUBLIC_KEY='public-fixture', WEB_PUSH_VAPID_PRIVATE_KEY='private-fixture',
                    WEB_PUSH_VAPID_SUBJECT='mailto:fictional@example.test')


@pytest.mark.parametrize('endpoint', [
    'http://fcm.googleapis.com/fcm/send/x', 'https://127.0.0.1/fcm/send/x',
    'https://fcm.googleapis.com.evil.test/fcm/send/x', 'https://user@fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:444/fcm/send/x', 'https://fcm.googleapis.com/fcm/send/x#secret',
    'https://localhost/wpush/v2/x', 'https://fcm.googleapis.com/unverified/path',
])
def test_push_destination_fails_closed(endpoint):
    with pytest.raises(ValueError, match='Unsupported push service'):
        validate_endpoint(endpoint)


def test_deadlines_deduplicate_and_exclude_resolved_demo_and_overdue(push_db):
    now = datetime.now(UTC)
    with push_db() as session:
        assert deadline_reminders(session, now) == 1
        assert deadline_reminders(session, now) == 0
        session.commit()
        dispute = session.get(Dispute, 'PP-PUSH')
        dispute.seller_response_due_date = now + timedelta(minutes=30)
        assert deadline_reminders(session, now) == 1
        dispute.status = 'RESOLVED'
        dispute.seller_response_due_date = now + timedelta(minutes=20)
        assert deadline_reminders(session, now) == 0
        dispute.status = 'WAITING_FOR_SELLER_RESPONSE'
        dispute.demo_session_id = 'foreign-demo'
        assert deadline_reminders(session, now) == 0
        dispute.demo_session_id = None
        dispute.seller_response_due_date = now - timedelta(seconds=1)
        assert deadline_reminders(session, now) == 0


def prepare_delivery(factory):
    with factory() as session:
        deadline_reminders(session, datetime.now(UTC))
        expand_outbox(session, push_settings())
        session.commit()


@pytest.mark.parametrize(('code', 'state'), [(201, 'delivered'), (429, 'pending'), (503, 'pending'),
                                            (400, 'failed'), (410, 'expired'), (404, 'expired')])
def test_delivery_outcomes_persist_without_leaking_destination(push_db, code, state):
    prepare_delivery(push_db)
    calls = []

    def sender(*args):
        calls.append(args)
        return code

    assert deliver_one(push_db, push_settings(), sender=sender)
    with push_db() as session:
        row = session.scalars(select(PushDelivery)).one()
        assert row.state == state and row.attempts == 1
        assert 'PRIVATE' not in (row.last_error or '')
        subscription = session.scalars(select(PushSubscription)).one()
        if state == 'expired':
            assert not subscription.active and subscription.endpoint == ''
    assert not deliver_one(push_db, push_settings(), sender=sender)
    assert len(calls) == 1


def test_restart_recovers_expired_lease_and_caps_retry_attempts(push_db):
    prepare_delivery(push_db)
    with push_db() as session:
        claimed = claim_delivery(session, datetime.now(UTC))
        assert claimed is not None
        row = session.get(PushDelivery, claimed[0])
        row.lease_until = datetime.now(UTC) - timedelta(minutes=1)
        session.commit()
    # The first process is gone. A different session recovers the expired lease.
    def sender(*args):
        raise RuntimeError('PRIVATE_ENDPOINT PRIVATE_KEY')

    assert deliver_one(push_db, push_settings(), sender=sender)
    with push_db() as session:
        row = session.scalars(select(PushDelivery)).one()
        assert row.attempts == 2 and row.state == 'pending'
        assert row.last_error == 'push_transport_error'
        row.attempts = 4
        row.next_attempt_at = datetime.now(UTC) - timedelta(minutes=1)
        session.commit()
    assert deliver_one(push_db, push_settings(), sender=sender)
    with push_db() as session:
        row = session.scalars(select(PushDelivery)).one()
        assert row.state == 'failed' and row.attempts == 5


def test_opt_out_prevents_pending_delivery_and_demo_never_fans_out(push_db):
    prepare_delivery(push_db)
    with push_db() as session:
        subscription = session.scalars(select(PushSubscription)).one()
        subscription.active = False
        session.commit()
    assert deliver_one(push_db, push_settings(), sender=lambda *args: pytest.fail('Opted-out send'))
    with push_db() as session:
        assert session.scalars(select(PushDelivery)).one().state == 'cancelled'
        item = Notification(id=uuid.uuid4(), dispute_id='PP-PUSH', demo_session_id='other-demo',
                            kind='review_needed', dedupe_key='demo-only', message='Generic')
        session.add(item)
        session.flush()
        session.add(NotificationOutbox(notification_id=item.id, state='pending', attempts=0))
        session.flush()
        expand_outbox(session, push_settings())
        session.commit()
        assert session.get(NotificationOutbox, item.id).state == 'excluded'
        assert len(list(session.scalars(select(PushDelivery)))) == 1


def test_push_transport_rejects_private_dns_and_never_follows_redirects(monkeypatch):
    from requests import Response
    from requests import Session as HttpSession

    from agent.app.notifications.push import RestrictedPushSession

    monkeypatch.setattr('socket.getaddrinfo', lambda *args, **kwargs: [(2, 1, 6, '', ('10.0.0.1', 443))])
    with RestrictedPushSession() as transport:
        with pytest.raises(ValueError, match='not public'):
            transport.post('https://fcm.googleapis.com/fcm/send/test', timeout=10)
        monkeypatch.setattr('socket.getaddrinfo', lambda *args, **kwargs: [(2, 1, 6, '', ('8.8.8.8', 443))])
        calls = []

        def post(self, url, **kwargs):
            calls.append(kwargs)
            response = Response()
            response.status_code = 303
            return response

        monkeypatch.setattr(HttpSession, 'post', post)
        assert transport.post('https://fcm.googleapis.com/fcm/send/test', timeout=10).status_code == 303
        assert calls == [{'timeout': 10, 'allow_redirects': False}]


def test_postgres_push_lease_skips_locked_destination():
    engine = create_engine(Settings().database_url)
    delivery_id, notification_id, subscription_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    factory = sessionmaker(engine)
    try:
        with factory() as session:
            session.add(Notification(id=notification_id, dispute_id='PP-LEASE', kind='review_needed',
                                     dedupe_key=uuid.uuid4().hex, message='Generic review'))
            session.add(PushSubscription(id=subscription_id, endpoint_hash=uuid.uuid4().hex,
                                         endpoint='fixture', p256dh='fixture', auth='fixture',
                                         vapid_key='fixture', active=True))
            session.flush()
            session.add(PushDelivery(id=delivery_id, notification_id=notification_id,
                                     subscription_id=subscription_id, state='pending', attempts=0))
            session.commit()
        with factory() as first, factory() as second:
            first.scalar(select(PushDelivery).where(PushDelivery.id == delivery_id).with_for_update())
            assert claim_delivery(second, datetime.now(UTC)) is None
            first.rollback()
            assert claim_delivery(second, datetime.now(UTC))[0] == delivery_id
        with factory() as third:
            assert claim_delivery(third, datetime.now(UTC)) is None
    finally:
        with factory() as session:
            session.execute(delete(PushDelivery).where(PushDelivery.id == delivery_id))
            session.execute(delete(PushSubscription).where(PushSubscription.id == subscription_id))
            session.execute(delete(Notification).where(Notification.id == notification_id))
            session.commit()
        engine.dispose()
