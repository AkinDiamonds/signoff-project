"""One fail-closed order resolver shared by merchant queries and the agent."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Literal, Protocol

from agent.app.store.base import StoreAmbiguous, StoreUnavailable


class LinkedOrder(Protocol):
    @property
    def order_code(self) -> str: ...


ResolutionStatus = Literal["found", "not_found", "ambiguous", "unavailable"]


@dataclass(frozen=True)
class OrderResolution[OrderT: LinkedOrder]:
    status: ResolutionStatus
    order: OrderT | None = None
    transaction_id: str | None = None


def _identifier(transaction: object, field: str) -> str | None:
    value = transaction.get(field) if isinstance(transaction, Mapping) else getattr(transaction, field, None)
    return value.strip() if isinstance(value, str) and value.strip() else None


def resolve_disputed_order[OrderT: LinkedOrder](
    transactions: object, lookup: Callable[[str], OrderT | None]
) -> OrderResolution[OrderT]:
    """Resolve all transactions, preferring the seller reference within each one.

    Buyer references may be aliases known to the store, never matches by email or
    amount. Different orders across transactions, duplicate mappings and store
    failures prevent returning any order, even if an earlier lookup succeeded.
    """
    if not isinstance(transactions, (list, tuple)):
        return OrderResolution("not_found")
    cached: dict[str, OrderT | None] = {}
    matches: dict[str, tuple[OrderT, str]] = {}
    for transaction in transactions:
        for field in ("seller_transaction_id", "buyer_transaction_id"):
            identifier = _identifier(transaction, field)
            if identifier is None:
                continue
            if identifier not in cached:
                try:
                    cached[identifier] = lookup(identifier)
                except StoreAmbiguous:
                    return OrderResolution("ambiguous")
                except StoreUnavailable:
                    return OrderResolution("unavailable")
            order = cached[identifier]
            if order is not None:
                matches[order.order_code] = (order, identifier)
                break
    if len(matches) > 1:
        return OrderResolution("ambiguous")
    if not matches:
        return OrderResolution("not_found")
    order, identifier = next(iter(matches.values()))
    return OrderResolution("found", order, identifier)
