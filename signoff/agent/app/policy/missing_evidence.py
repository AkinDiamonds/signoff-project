"""Pre-plan handling of missing delivery proof; signing gate remains authoritative."""

from datetime import datetime
from typing import Literal

from agent.app.agent.evidence import _valid_shipments
from agent.app.domain.enums import TrackingStatus
from agent.app.store.models import MISSING_TRACKING_REASON, OrderRecord


def evaluate_missing_delivery(
    order: OrderRecord | None,
    choice: Literal["HUMAN_REVIEW", "GATED_SETTLEMENT"],
    now: datetime,
) -> Literal["normal", "review", "settlement_only"]:
    if now.tzinfo is None:
        raise ValueError("An aware clock is required")
    if order is None:
        return "review"
    if order.tracking_unavailable_reason not in (None, MISSING_TRACKING_REASON):
        return "review"
    if order.tracking_unavailable_reason == MISSING_TRACKING_REASON:
        if order.shipments:
            return "review"
        return "settlement_only" if choice == "GATED_SETTLEMENT" else "review"
    if any(event.event_time < order.created_at or event.event_time > now for event in order.shipments):
        return "review"
    if order.shipments and max(order.shipments, key=lambda item: item.event_time).status == TrackingStatus.EXCEPTION:
        return "review"
    valid, ignored = _valid_shipments(order)
    if ignored:
        return "review"
    if any(event.status == TrackingStatus.DELIVERED for event, _carrier, _number in valid):
        return "normal"
    return "settlement_only" if choice == "GATED_SETTLEMENT" else "review"
