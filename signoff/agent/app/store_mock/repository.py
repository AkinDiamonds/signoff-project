"""Database lookups that turn mock-store rows into pure order snapshots."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.store_mock.scenarios import (
    SCENARIOS,
    SCENARIOS_BY_TRANSACTION_ID,
    OrderRecord,
    ShipmentRecord,
)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def find_order_by_paypal_transaction_id(session: Session, transaction_id: str | None) -> Order | None:
    """Look up an order by PayPal transaction id; blank or unknown ids return None."""
    if not transaction_id or not transaction_id.strip():
        return None
    return session.scalar(select(Order).where(Order.paypal_transaction_id == transaction_id.strip()))


def _scenario_for_order(order: Order) -> OrderRecord | None:
    """Match a seeded scenario by transaction id, or by pooled order-code prefix."""
    scenario = SCENARIOS_BY_TRANSACTION_ID.get(order.paypal_transaction_id or "")
    if scenario is not None:
        return scenario
    return next(
        (item for item in SCENARIOS if order.order_code.startswith(f"SIG-{item.scenario_id}-")),
        None,
    )


def _to_record(order: Order, events: list[TrackingEvent], buyer_prior_disputes: int | None) -> OrderRecord:
    scenario = _scenario_for_order(order)
    prior = buyer_prior_disputes
    if prior is None:
        prior = scenario.buyer_prior_disputes if scenario is not None else 0

    items = tuple(item for item in order.items if isinstance(item, dict))
    shipments = tuple(
        ShipmentRecord(
            carrier=event.carrier,
            tracking_number=event.tracking_number,
            status=TrackingStatus(event.status),
            event_time=_ensure_utc(event.event_time),
            payload=event.payload if isinstance(event.payload, dict) else None,
        )
        for event in events
    )
    return OrderRecord(
        order_code=order.order_code,
        paypal_transaction_id=order.paypal_transaction_id,
        customer_email=order.customer_email,
        amount=order.amount,
        currency=order.currency,
        status=OrderStatus(order.status),
        items=items,
        created_at=_ensure_utc(order.created_at),
        shipments=shipments,
        buyer_prior_disputes=prior,
        scenario_id=scenario.scenario_id if scenario is not None else None,
    )


def load_order_context(
    session: Session,
    transaction_id: str | None,
    *,
    buyer_prior_disputes: int | None = None,
) -> OrderRecord | None:
    """Load an order and its shipments, or None when the transaction is unknown.

    ``buyer_prior_disputes`` overrides the seeded scenario value when supplied.
    """
    order = find_order_by_paypal_transaction_id(session, transaction_id)
    if order is None:
        return None

    events = list(
        session.scalars(
            select(TrackingEvent)
            .where(TrackingEvent.order_id == order.id)
            .order_by(TrackingEvent.event_time)
        ).all()
    )
    return _to_record(order, events, buyer_prior_disputes)
