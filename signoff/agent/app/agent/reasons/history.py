"""Buyer dispute history counting for gate rule G5-01.

Counts prior disputes in a rolling window by buyer identity. Unknown identity
means unknown history: the count is zero, the buyer is not flagged, and the gap
is logged. Seeded mock scenarios provide a fallback count when no real dispute
history exists yet.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from agent.app.db.models import Dispute
from agent.app.paypal.models import Dispute as PayPalDispute

logger = logging.getLogger(__name__)

HISTORY_WINDOW_DAYS = 180


@dataclass(frozen=True, slots=True)
class BuyerHistory:
    """Buyer identity and prior-dispute count used by the gate."""

    buyer_id: str | None
    prior_disputes: int
    known: bool
    window_days: int

    @property
    def should_flag(self) -> bool:
        return self.known and self.prior_disputes > 0


def _clean(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def buyer_identity(dispute: PayPalDispute | Any) -> str | None:
    """Extract a stable buyer identifier from a PayPal dispute, or None."""
    for transaction in getattr(dispute, "disputed_transactions", None) or []:
        buyer = getattr(transaction, "buyer", None)
        if buyer is None:
            continue
        for attribute in ("payer_id", "email"):
            identity = _clean(getattr(buyer, attribute, None))
            if identity:
                return identity
    return None


def _snapshot_buyer_id(snapshot: Any) -> str | None:
    if not isinstance(snapshot, dict):
        return None
    for transaction in snapshot.get("disputed_transactions") or []:
        if not isinstance(transaction, dict):
            continue
        buyer = transaction.get("buyer")
        if not isinstance(buyer, dict):
            continue
        for key in ("payer_id", "email"):
            identity = _clean(buyer.get(key))
            if identity:
                return identity
    return None


def count_buyer_disputes(
    session: Session,
    dispute: PayPalDispute,
    *,
    now: datetime,
    window_days: int = HISTORY_WINDOW_DAYS,
    fallback_count: int = 0,
) -> BuyerHistory:
    """Count this buyer's other disputes created inside the window.

    ``fallback_count`` is the seeded mock-store value, used only when the buyer
    is known and no real dispute rows exist yet.
    """
    if now.tzinfo is None:
        raise ValueError("Timezone-naive now is rejected; must be UTC")

    identity = buyer_identity(dispute)
    if identity is None:
        logger.info(
            "Buyer identity missing for dispute %s; history unknown and not flagged.",
            getattr(dispute, "dispute_id", "unknown"),
        )
        return BuyerHistory(buyer_id=None, prior_disputes=0, known=False, window_days=window_days)

    cutoff = now - timedelta(days=window_days)
    own_id = getattr(dispute, "dispute_id", None)
    # Push date and demo filters into SQL so the DB can use indexes.
    rows = session.execute(
        select(Dispute.id, Dispute.snapshot)
        .where(
            and_(
                Dispute.demo_session_id.is_(None),
                Dispute.created_at >= cutoff,
            )
        )
    ).all()
    count = 0
    for row in rows:
        if row.id == own_id:
            continue
        if _snapshot_buyer_id(row.snapshot) == identity:
            count += 1

    if count == 0 and fallback_count > 0:
        count = fallback_count

    return BuyerHistory(
        buyer_id=identity,
        prior_disputes=count,
        known=True,
        window_days=window_days,
    )
