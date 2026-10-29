"""Domain models for store orders and shipments.

Moved from store_mock to support multiple store adapters (HTTP, local mock).
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from agent.app.domain.enums import OrderStatus, TrackingStatus

MOCK_MERCHANT_ID = "MOCK-MERCHANT-001"


@dataclass(frozen=True, slots=True)
class ShipmentRecord:
    """One shipment milestone for an order."""

    carrier: str
    tracking_number: str
    status: TrackingStatus
    event_time: datetime
    payload: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        if self.event_time.tzinfo is None:
            raise ValueError("Shipment event_time must be timezone-aware")


@dataclass(frozen=True, slots=True)
class OrderRecord:
    """Pure order snapshot used by evidence builders and adapters."""

    order_code: str
    paypal_transaction_id: str | None
    customer_email: str
    amount: Decimal
    currency: str
    status: OrderStatus
    items: tuple[dict[str, Any], ...]
    created_at: datetime
    shipments: tuple[ShipmentRecord, ...]
    buyer_prior_disputes: int = 0
    scenario_id: str | None = None

    def __post_init__(self) -> None:
        if not self.order_code.strip():
            raise ValueError("order_code cannot be empty")
        if self.amount < 0:
            raise ValueError("amount cannot be negative")
        if len(self.currency) != 3 or self.currency != self.currency.upper():
            raise ValueError("currency must be a three-letter uppercase code")
        if self.created_at.tzinfo is None:
            raise ValueError("created_at must be timezone-aware")
        if self.buyer_prior_disputes < 0:
            raise ValueError("buyer_prior_disputes cannot be negative")
