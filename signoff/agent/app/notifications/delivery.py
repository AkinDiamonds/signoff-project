"""Durable owner-only fanout, leased push attempts and deduplicated deadline reminders."""

import hashlib
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session, sessionmaker

from agent.app.db.models import Dispute, Notification, NotificationOutbox, PushDelivery, PushSubscription
from agent.app.notifications.push import configured, send_push
from agent.app.settings import Settings

MAX_ATTEMPTS = 5


def deadline_key(dispute_id: str, due: datetime, now: datetime) -> str:
    window = '1h' if due <= now + timedelta(hours=1) else '24h'
    return hashlib.sha256(f'owner:{dispute_id}:deadline:{due.isoformat()}:{window}'.encode()).hexdigest()


def obsolete_deadline(session: Session, notification: Notification, now: datetime) -> bool:
    if notification.kind != 'deadline_reminder':
        return False
    dispute = session.get(Dispute, notification.dispute_id)
    if dispute is None or dispute.status == 'RESOLVED' or dispute.seller_response_due_date is None:
        return True
    due = dispute.seller_response_due_date
    due = due.replace(tzinfo=UTC) if due.tzinfo is None else due
    return (due <= now or due > now + timedelta(hours=24)
            or deadline_key(dispute.id, due, now) != notification.dedupe_key)


def insert_for(session: Session):  # type: ignore[no-untyped-def]
    return sqlite_insert if session.get_bind().dialect.name == 'sqlite' else pg_insert


def deadline_reminders(session: Session, now: datetime) -> int:
    """At most one reminder per deadline/window. No overdue/resolved/demo alerts."""
    rows = session.scalars(select(Dispute).where(
        Dispute.demo_session_id.is_(None), Dispute.status != 'RESOLVED',
        Dispute.seller_response_due_date > now,
        Dispute.seller_response_due_date <= now + timedelta(hours=24),
    )).all()
    created = 0
    for dispute in rows:
        due = dispute.seller_response_due_date
        if due is None:
            continue
        due = due.replace(tzinfo=UTC) if due.tzinfo is None else due
        key = deadline_key(dispute.id, due, now)
        identifier = uuid.uuid4()
        added = session.scalar(insert_for(session)(Notification).values(
            id=identifier, dispute_id=dispute.id, kind='deadline_reminder', dedupe_key=key,
            message='A dispute response deadline is approaching.', source_event_id=None,
        ).on_conflict_do_nothing(index_elements=['dedupe_key']).returning(Notification.id))
        if added is not None:
            session.add(NotificationOutbox(notification_id=identifier, state='pending', attempts=0))
            created += 1
    session.flush()
    return created


def expand_outbox(session: Session, settings: Settings) -> int:
    """Atomic fanout; exclude demo items and notifications older than opt-in."""
    query = select(NotificationOutbox).where(NotificationOutbox.state == 'pending').limit(50)
    if session.get_bind().dialect.name == 'postgresql':
        query = query.with_for_update(skip_locked=True)
    boxes = list(session.scalars(query))
    for box in boxes:
        notification = session.get(Notification, box.notification_id)
        if notification is None or notification.demo_session_id is not None:
            box.state = 'excluded'
            continue
        subscriptions = list(session.scalars(select(PushSubscription).where(
            PushSubscription.active.is_(True), PushSubscription.created_at <= notification.created_at,
            PushSubscription.vapid_key == settings.web_push_vapid_public_key,
        ))) if configured(settings) else []
        for subscription in subscriptions:
            session.execute(insert_for(session)(PushDelivery).values(
                id=uuid.uuid4(), notification_id=notification.id, subscription_id=subscription.id,
                state='pending', attempts=0,
            ).on_conflict_do_nothing(index_elements=['notification_id', 'subscription_id']))
        box.state = 'expanded' if subscriptions else 'no_destination'
    session.flush()
    return len(boxes)


def claim_delivery(session: Session, now: datetime) -> tuple[uuid.UUID, uuid.UUID] | None:
    query = select(PushDelivery).where(or_(
        and_(PushDelivery.state == 'pending', PushDelivery.next_attempt_at <= now),
        and_(PushDelivery.state == 'delivering', PushDelivery.lease_until < now),
    )).order_by(PushDelivery.next_attempt_at, PushDelivery.id).limit(1)
    if session.get_bind().dialect.name == 'postgresql':
        query = query.with_for_update(skip_locked=True)
    row = session.scalar(query)
    if row is None:
        session.rollback()
        return None
    token = uuid.uuid4()
    row.state, row.lease_token = 'delivering', token
    row.lease_until = now + timedelta(seconds=60)
    row.attempts += 1
    session.commit()
    return row.id, token


PushSender = Callable[[Settings, str, str, str, str, str], int]


def deliver_one(factory: sessionmaker[Session], settings: Settings, *,
                sender: PushSender = send_push) -> bool:
    """No business/PayPal mutation. Stable notification tags replace push duplicates."""
    with factory() as session:
        now = session.scalar(select(func.now())) or datetime.now(UTC)
        now = now.replace(tzinfo=UTC) if now.tzinfo is None else now
        claimed = claim_delivery(session, now)
        if claimed is None:
            return False
        identifier, token = claimed
        row = session.get(PushDelivery, identifier)
        assert row is not None
        subscription = session.get(PushSubscription, row.subscription_id)
        notification = session.get(Notification, row.notification_id)
        status = 0
        error = None
        if (subscription is None or not subscription.active or notification is None
                or notification.demo_session_id is not None or obsolete_deadline(session, notification, now)):
            outcome = 'cancelled'
        elif not configured(settings) or subscription.vapid_key != settings.web_push_vapid_public_key:
            outcome, error = 'failed', 'push_configuration_unavailable'
        else:
            try:
                status = sender(settings, subscription.endpoint, subscription.p256dh, subscription.auth,
                                str(notification.id), notification.dispute_id)
            except Exception:
                # Endpoint/keys/raw provider responses must never enter logs or the database.
                error = 'push_transport_error'
            if 200 <= status < 300:
                outcome = 'delivered'
            elif status in (404, 410):
                outcome, error = 'expired', 'subscription_expired'
            elif (status == 0 or status == 429 or status >= 500) and row.attempts < MAX_ATTEMPTS:
                outcome, error = 'pending', error or f'push_http_{status}'
            else:
                outcome, error = 'failed', error or f'push_http_{status}'
        session.rollback()
        row = session.scalar(select(PushDelivery).where(
            PushDelivery.id == identifier, PushDelivery.lease_token == token,
            PushDelivery.state == 'delivering',
        ).with_for_update())
        if row is None:
            return True  # A newer lease owns this attempt; do not overwrite it.
        row.state, row.last_error = outcome, error
        row.lease_until, row.lease_token = None, None
        if outcome == 'pending':
            row.next_attempt_at = now + timedelta(seconds=min(300, 2 ** row.attempts * 5))
        if outcome == 'expired':
            subscription = session.get(PushSubscription, row.subscription_id)
            if subscription is not None:
                subscription.active = False
                subscription.endpoint, subscription.p256dh, subscription.auth = '', '', ''
        session.commit()
        return True


def notification_tick(factory: sessionmaker[Session], settings: Settings) -> None:
    with factory() as session:
        now = session.scalar(select(func.now())) or datetime.now(UTC)
        now = now.replace(tzinfo=UTC) if now.tzinfo is None else now
        deadline_reminders(session, now)
        expand_outbox(session, settings)
        session.commit()
    for _ in range(5):
        if not deliver_one(factory, settings):
            break
