"""Fresh-start cutoff: PayPal disputes created before it are never imported again.

Stored in integration_observations, which the fresh-start reset keeps, so the
cutoff survives a wipe and the reconciler cannot pull old PayPal data back.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from agent.app.db.models import IntegrationObservation

CUTOFF_KEY = "sync:ignore-before"


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def get_cutoff(session: Session) -> datetime | None:
    row = session.get(IntegrationObservation, CUTOFF_KEY)
    return _utc(row.checked_at) if row else None


def set_cutoff(session: Session, when: datetime) -> None:
    session.merge(IntegrationObservation(key=CUTOFF_KEY, state="fresh-start", checked_at=_utc(when), config_tag=""))


def is_before_cutoff(session: Session, created: datetime) -> bool:
    cutoff = get_cutoff(session)
    return cutoff is not None and _utc(created) <= cutoff
