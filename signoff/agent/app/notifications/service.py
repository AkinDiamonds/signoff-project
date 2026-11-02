"""Create generic notifications atomically with their source event."""

import hashlib
import uuid

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from agent.app.db.models import Dispute, LedgerEvent, Notification, NotificationOutbox

EVENTS = {
    "DISPUTE_SYNCED": ("new_dispute", "A dispute needs your attention."),
    "APPROVAL_REQUESTED": ("approval_requested", "An action needs your approval."),
    "EXECUTION_CONFIRMED": ("action_confirmed", "An action update is available."),
    "EXECUTION_FAILED": ("action_failed", "An action could not be completed."),
    "RUN_FAILED": ("review_needed", "A dispute needs your review."),
    "INJECTION_FLAGGED": ("review_needed", "A dispute needs your review."),
    "NO_ACTION": ("review_needed", "A dispute needs your review."),
}


def record_notification(session: Session, event: LedgerEvent) -> None:
    mapped = EVENTS.get(event.event_kind)
    if mapped is None:
        return
    if event.event_kind == "NO_ACTION" and (event.payload or {}).get("reason") not in {
        "tracking_requires_review",
        "signing_policy_changed",
        "store_unavailable",
        "order_ambiguous",
        "evidence_missing",
        "evidence_changed",
        "unsupported_reason",
        "all_actions_rejected",
    }:
        return
    dispute = session.get(Dispute, event.dispute_id)
    if dispute is None:
        return
    kind, message = mapped
    payload = event.payload or {}
    if kind == "new_dispute":
        source = "first-sync"
    elif kind == "approval_requested":
        source = str(payload.get("decision_id") or payload.get("approval_id") or event.id)
    else:
        source = str(payload.get("execution_id") or event.id)
    key = hashlib.sha256(f"{dispute.id}:{kind}:{source}".encode()).hexdigest()
    identifier = uuid.uuid4()
    values = dict(
        id=identifier,
        dispute_id=dispute.id,
        demo_session_id=dispute.demo_session_id,
        kind=kind,
        dedupe_key=key,
        source_event_id=event.id,
        message=message,
    )
    insert = sqlite_insert if session.get_bind().dialect.name == "sqlite" else pg_insert
    created = session.scalar(
        insert(Notification)
        .values(**values)
        .on_conflict_do_nothing(index_elements=["dedupe_key"])
        .returning(Notification.id)
    )
    if created is not None:
        session.add(NotificationOutbox(notification_id=identifier, state="pending", attempts=0))
