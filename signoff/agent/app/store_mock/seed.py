"""Idempotent seeding of fictional scenario orders and tracking events."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.store_mock.scenarios import MOCK_MERCHANT_ID, SCENARIOS, OrderRecord


@dataclass(frozen=True, slots=True)
class SeedResult:
    orders_added: int
    tracking_events_added: int


def seed_scenarios(
    session: Session,
    scenarios: Sequence[OrderRecord] = SCENARIOS,
) -> SeedResult:
    """Insert missing scenario records. Safe to run repeatedly; never updates rows."""
    orders_added = 0
    tracking_added = 0

    for record in scenarios:
        order = session.scalar(select(Order).where(Order.order_code == record.order_code))
        if order is None:
            order = Order(
                order_code=record.order_code,
                merchant_id=MOCK_MERCHANT_ID,
                customer_email=record.customer_email,
                paypal_transaction_id=record.paypal_transaction_id,
                amount=record.amount,
                currency=record.currency,
                status=record.status.value,
                items=[dict(item) for item in record.items],
                created_at=record.created_at,
            )
            session.add(order)
            session.flush()
            orders_added += 1

        for shipment in record.shipments:
            exists = session.scalar(
                select(TrackingEvent.id).where(
                    TrackingEvent.order_id == order.id,
                    TrackingEvent.tracking_number == shipment.tracking_number,
                    TrackingEvent.status == shipment.status.value,
                    TrackingEvent.event_time == shipment.event_time,
                )
            )
            if exists is None:
                session.add(
                    TrackingEvent(
                        order_id=order.id,
                        carrier=shipment.carrier,
                        tracking_number=shipment.tracking_number,
                        status=shipment.status.value,
                        event_time=shipment.event_time,
                        payload=shipment.payload,
                    )
                )
                session.flush()
                tracking_added += 1

    return SeedResult(orders_added=orders_added, tracking_events_added=tracking_added)


def main() -> None:
    """Seed the configured database (``python -m agent.app.store_mock.seed``)."""
    from agent.app.db.session import get_session_factory

    with get_session_factory()() as session:
        result = seed_scenarios(session)
        session.commit()
    print(f"Seeded mock store: {result.orders_added} orders, {result.tracking_events_added} tracking events.")


if __name__ == "__main__":
    main()
