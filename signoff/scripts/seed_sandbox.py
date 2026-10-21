"""Idempotently fill the demo pool with paid mock transactions.

S10: one dispute per transaction, so each scenario gets a fixed number of
pooled copies. Running this repeatedly never duplicates or updates rows.
"""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, TrackingEvent
from agent.app.domain.enums import OrderStatus
from agent.app.settings import Settings
from agent.app.store_mock.scenarios import MOCK_MERCHANT_ID, SCENARIOS, OrderRecord


def pool_order_code(record: OrderRecord, copy: int) -> str:
    return f"SIG-{record.scenario_id}-POOL-{copy:03d}"


def pool_transaction_id(record: OrderRecord, copy: int) -> str:
    return f"TX-POOL-{record.scenario_id}-{copy:03d}"


def seed_pool(session: Session, copies: int | None = None) -> tuple[int, int]:
    """Insert missing pool orders and tracking events; return (orders, events) added."""
    copies = copies or Settings().demo_pool_size_per_scenario
    orders_added = 0
    events_added = 0

    for record in SCENARIOS:
        for copy in range(1, copies + 1):
            code = pool_order_code(record, copy)
            if session.scalar(select(Order.id).where(Order.order_code == code)) is not None:
                continue

            order = Order(
                order_code=code,
                merchant_id=MOCK_MERCHANT_ID,
                customer_email=record.customer_email,
                paypal_transaction_id=pool_transaction_id(record, copy),
                amount=record.amount,
                currency=record.currency,
                status=OrderStatus.PAID.value,
                items=[dict(item) for item in record.items],
                created_at=record.created_at,
            )
            session.add(order)
            session.flush()
            orders_added += 1

            for shipment in record.shipments:
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
                events_added += 1
            session.flush()

    return orders_added, events_added


def main() -> None:
    parser = argparse.ArgumentParser(description="Fill the demo scenario transaction pool.")
    parser.add_argument(
        "--copies",
        type=int,
        default=None,
        help="Copies per scenario (default: DEMO_POOL_SIZE_PER_SCENARIO)",
    )
    args = parser.parse_args()

    from agent.app.db.session import get_session_factory

    with get_session_factory()() as session:
        orders, events = seed_pool(session, args.copies)
        session.commit()
        print(f"Seeded demo pool: {orders} orders, {events} tracking events.")


if __name__ == "__main__":
    main()
