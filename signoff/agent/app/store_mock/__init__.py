"""Fictional mock store data and lookups for evidence building."""

from agent.app.store_mock.repository import (
    find_order_by_paypal_transaction_id,
    load_order_context,
)
from agent.app.store_mock.scenarios import (
    SCENARIOS,
    SCENARIOS_BY_TRANSACTION_ID,
    OrderRecord,
    ShipmentRecord,
)
from agent.app.store_mock.seed import seed_scenarios

__all__ = [
    "SCENARIOS",
    "SCENARIOS_BY_TRANSACTION_ID",
    "OrderRecord",
    "ShipmentRecord",
    "find_order_by_paypal_transaction_id",
    "load_order_context",
    "seed_scenarios",
]
