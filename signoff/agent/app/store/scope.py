"""Server-owned merchant/demo boundaries for order evidence and fulfilment."""

from dataclasses import dataclass

from sqlalchemy.sql.elements import ColumnElement

from agent.app.db.models import Order
from agent.app.settings import AppEnv, Settings


@dataclass(frozen=True)
class OrderScope:
    merchant_id: str | None
    demo_session_id: str | None = None

    def predicates(self) -> list[ColumnElement[bool]]:
        conditions = [Order.demo_session_id == self.demo_session_id]
        if self.merchant_id is not None:
            conditions.append(Order.merchant_id == self.merchant_id)
        return conditions


def order_scope(settings: Settings, demo_session_id: str | None = None) -> OrderScope:
    # Missing production merchant configuration never broadens a lookup.
    merchant = settings.paypal_merchant_id.strip() or ("" if settings.app_env == AppEnv.prod else None)
    return OrderScope(merchant, demo_session_id)
