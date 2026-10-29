"""Local in-process StoreAdapter wrapping the database session and mock repository."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import TrackingStatus
from agent.app.shop.disputes import _find_dispute_for_transaction
from agent.app.store.base import StoreAdapter
from agent.app.store.models import OrderRecord, ShipmentRecord
from agent.app.store_mock.repository import load_order_context


def _ensure_utc(dt: Any) -> datetime:
    if dt is None:
        return datetime.now(UTC)
    if isinstance(dt, str):
        try:
            return datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return datetime.now(UTC)
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    return datetime.now(UTC)


class LocalStoreAdapter:
    """StoreAdapter implementation backed by local database session."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def find_order(self, transaction_id: str) -> OrderRecord | None:
        """Find an order by PayPal transaction ID, with shipments included."""
        return load_order_context(self._session, transaction_id)

    def get_shipments(self, order_code: str) -> list[ShipmentRecord]:
        """Retrieve tracking shipment events for an order code."""
        order = self._session.scalar(select(Order).where(Order.order_code == order_code.strip()))
        if order is None:
            return []
        events = list(
            self._session.scalars(
                select(TrackingEvent)
                .where(TrackingEvent.order_id == order.id)
                .order_by(TrackingEvent.event_time.asc())
            ).all()
        )
        return [
            ShipmentRecord(
                carrier=e.carrier,
                tracking_number=e.tracking_number,
                status=TrackingStatus(e.status),
                event_time=_ensure_utc(e.event_time),
                payload=e.payload if isinstance(e.payload, dict) else None,
            )
            for e in events
        ]

    def get_messages(self, order_code: str) -> list[dict]:
        """Retrieve buyer messages for an order."""
        order = self._session.scalar(select(Order).where(Order.order_code == order_code.strip()))
        if not order or not order.paypal_transaction_id:
            return []
        dispute = _find_dispute_for_transaction(self._session, order.paypal_transaction_id)
        if not dispute or not dispute.snapshot:
            return []
        raw = dispute.snapshot.get("messages", [])
        return [
            m for m in raw
            if isinstance(m, dict) and str(m.get("posted_by", "BUYER")).upper() == "BUYER"
        ]

    def get_policies(self) -> dict:
        """Retrieve merchant policies."""
        return {
            "return_window_days": 30,
            "refund_window_days": 30,
            "shipping_policy": "Orders are shipped within 1-2 business days via standard tracked carriers.",
            "return_policy": "Items must be returned in original condition within 30 days of delivery.",
            "cancellation_policy": "Orders may be cancelled before shipment tracking is generated.",
        }
