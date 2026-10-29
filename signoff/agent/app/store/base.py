"""StoreAdapter Protocol and StoreUnavailable exception."""

from typing import Protocol, runtime_checkable

from agent.app.store.models import OrderRecord, ShipmentRecord


class StoreUnavailable(Exception):
    """Raised when an external or local store service cannot be reached."""


@runtime_checkable
class StoreAdapter(Protocol):
    """Synchronous interface for retrieving store orders, tracking, and policies."""

    def find_order(self, transaction_id: str) -> OrderRecord | None:
        """Find an order by PayPal transaction ID, including its shipments.

        Returns:
            OrderRecord with shipments populated if found, or None if unknown.

        Raises:
            StoreUnavailable: On network, connection, or upstream server errors.
        """
        ...

    def get_shipments(self, order_code: str) -> list[ShipmentRecord]:
        """Retrieve tracking shipment milestones for an order.

        Returns:
            List of ShipmentRecord objects ordered chronologically.

        Raises:
            StoreUnavailable: On network, connection, or upstream server errors.
        """
        ...

    def get_messages(self, order_code: str) -> list[dict]:
        """Retrieve buyer communication messages for an order.

        Returns:
            List of message dictionaries, or empty list if none exist.

        Raises:
            StoreUnavailable: On network, connection, or upstream server errors.
        """
        ...

    def get_policies(self) -> dict:
        """Retrieve merchant policies for shipping, refunds, and return windows.

        Returns:
            Dictionary containing policy rules.

        Raises:
            StoreUnavailable: On network, connection, or upstream server errors.
        """
        ...
