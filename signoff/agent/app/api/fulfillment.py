"""Owner-only, CSRF-protected simulated shipment controls."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Order, SimulatedShipment
from agent.app.db.session import get_db_session
from agent.app.fulfillment.service import ShipmentAction, ShipmentView, apply_shipment_action, shipment_view
from agent.app.store.scope import order_scope

router = APIRouter(prefix="/api/fulfillment", tags=["Simulated shipments"])


@router.get("/orders", response_model=list[ShipmentView])
def list_shipments(
    request: Request,
    db: Annotated[Session, Depends(get_db_session)],
    demo_session_id: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ShipmentView]:
    scope = order_scope(request.app.state.settings, demo_session_id)
    orders = db.scalars(
        select(Order).join(SimulatedShipment).where(*scope.predicates()).order_by(Order.created_at.desc()).limit(limit)
    )
    return [shipment_view(db, order) for order in orders]


@router.post("/orders/{order_code}/actions", response_model=ShipmentView)
def shipment_action(
    order_code: str,
    body: ShipmentAction,
    request: Request,
    db: Annotated[Session, Depends(get_db_session)],
    demo_session_id: str | None = None,
) -> ShipmentView:
    return apply_shipment_action(
        db, order_code, body, scope=order_scope(request.app.state.settings, demo_session_id), now=datetime.now(UTC)
    )
