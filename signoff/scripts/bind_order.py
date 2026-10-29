"""Bind a real transaction ID to a seeded scenario order (06-judge-flow.md Part C).

Usage:
    python -m scripts.bind_order --txn <paypal_transaction_id> --scenario A|B|C|D|E
"""

import argparse
import sys

from sqlalchemy import select

from agent.app.db.base import Base
from agent.app.db.models import Order
from agent.app.db.session import get_session_factory
from agent.app.domain.enums import TrackingStatus
from agent.app.store.models import OrderRecord
from agent.app.store_mock.scenarios import SCENARIOS
from agent.app.store_mock.seed import seed_scenarios


def bind_order(txn_id: str, scenario_letter: str) -> None:
    scenario = next((s for s in SCENARIOS if s.scenario_id == scenario_letter.upper()), None)
    if not scenario:
        print(f"Error: Unknown scenario '{scenario_letter}'. Choose from A, B, C, D, E.")
        sys.exit(1)

    clean_txn = txn_id.strip()
    order_code = f"SIG-{scenario.scenario_id}-{clean_txn[:8]}"

    bound_record = OrderRecord(
        order_code=order_code,
        paypal_transaction_id=clean_txn,
        customer_email=scenario.customer_email,
        amount=scenario.amount,
        currency=scenario.currency,
        status=scenario.status,
        items=scenario.items,
        created_at=scenario.created_at,
        shipments=scenario.shipments,
        buyer_prior_disputes=scenario.buyer_prior_disputes,
        scenario_id=scenario.scenario_id,
    )

    with get_session_factory()() as session:
        Base.metadata.create_all(session.get_bind())
        # Check if already bound by transaction or order code
        existing = session.scalar(
            select(Order).where(
                (Order.paypal_transaction_id == clean_txn) | (Order.order_code == order_code)
            )
        )
        if existing:
            print(f"Order already bound: {existing.order_code} (txn: {existing.paypal_transaction_id})")
        else:
            seed_scenarios(session, [bound_record])
            session.commit()
            print(f"Bound order created: {order_code}")

        print(f"Order Code: {order_code}")
        print(f"Transaction ID: {clean_txn}")
        print("Evidence supplied:")
        for idx, shipment in enumerate(scenario.shipments, start=1):
            is_delivered = shipment.status == TrackingStatus.DELIVERED
            print(
                f"  [{idx}] Carrier: {shipment.carrier}, "
                f"Tracking: {shipment.tracking_number}, "
                f"Status: {shipment.status.value}, "
                f"Delivered: {is_delivered}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Bind a real PayPal transaction to a seeded scenario order.")
    parser.add_argument("--txn", required=True, help="PayPal transaction or capture ID")
    parser.add_argument(
        "--scenario",
        required=True,
        choices=["A", "B", "C", "D", "E"],
        help="Scenario letter (A, B, C, D, or E)",
    )
    args = parser.parse_args()
    bind_order(args.txn, args.scenario)


if __name__ == "__main__":
    main()
