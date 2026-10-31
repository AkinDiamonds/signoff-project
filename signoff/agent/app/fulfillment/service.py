"""Append-only simulated shipment milestones with durable optimistic concurrency."""

import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from agent.app.db.models import Dispute, Order, SimulatedShipment, TrackingEvent
from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.domain.money import Money
from agent.app.errors import AppError, NotFoundError
from agent.app.shop.schemas import TrackingEventResponse
from agent.app.store.scope import OrderScope

logger = logging.getLogger(__name__)
STEP_INTERVAL = timedelta(minutes=1)
STAGES = ("PRE_TRANSIT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED")
PAID_STATUSES = ("PAID", "SHIPPED", "DELIVERED", "DISPUTED")


class ShipmentAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base_version: int = Field(ge=0)
    request_id: uuid.UUID
    action: Literal["advance", "missing_tracking", "exception", "resume"]


class ShipmentView(BaseModel):
    order_code: str
    order_status: str
    amount: Money
    shipment_id: uuid.UUID
    source: Literal["simulated"] = "simulated"
    carrier: str = "UPS"
    tracking_number: str
    stage: TrackingStatus
    mode: Literal["normal", "missing_tracking", "exception"]
    version: int
    next_event_at: datetime | None
    can_configure_scenario: bool
    events: list[TrackingEventResponse]


def _utc(value: datetime) -> datetime:
    # SQLite drops tzinfo on DateTime(timezone=True); stored model dates are UTC.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _clock(now: datetime) -> datetime:
    if now.tzinfo is None:
        raise ValueError("Shipment operations require an aware UTC clock")
    return now.astimezone(UTC)


def _events(session: Session, order: Order) -> list[TrackingEvent]:
    return list(
        session.scalars(
            select(TrackingEvent)
            .where(TrackingEvent.order_id == order.id)
            .order_by(TrackingEvent.event_time, TrackingEvent.id)
        )
    )


def _has_dispute(session: Session, order: Order) -> bool:
    reference = order.paypal_capture_id or order.paypal_transaction_id
    if reference is None:
        return False
    for dispute in session.scalars(select(Dispute).where(Dispute.demo_session_id == order.demo_session_id)):
        transactions = (dispute.snapshot or {}).get("disputed_transactions", [])
        if not isinstance(transactions, list):
            continue
        for tx in transactions:
            if isinstance(tx, dict) and reference in (tx.get("seller_transaction_id"), tx.get("buyer_transaction_id")):
                return True
    return False


def _event(session: Session, order: Order, shipment: SimulatedShipment, stage: str, now: datetime, actor: str) -> None:
    session.add(
        TrackingEvent(
            order_id=order.id,
            carrier="UPS",
            tracking_number=shipment.tracking_number,
            status=stage,
            event_time=now,
            payload={
                "source": "simulated",
                "shipment_id": str(shipment.id),
                "actor": actor,
                "mode": shipment.mode,
                "note": f"Simulated shipment: {stage.replace('_', ' ').lower()}.",
            },
        )
    )


def create_simulated_shipment(session: Session, order: Order, *, now: datetime) -> SimulatedShipment:
    now = _clock(now)
    if order.status not in PAID_STATUSES or not order.paypal_capture_id:
        raise AppError("ORDER_NOT_PAID", "A verified paid order is required for simulated shipping", status_code=409)
    existing = session.get(SimulatedShipment, order.id)
    if existing is not None:
        return existing
    if _utc(order.created_at) > now:
        raise AppError(
            "SHIPMENT_TIME_INVALID", "Order time requires review before shipment simulation", status_code=409
        )
    shipment = SimulatedShipment(
        order_id=order.id,
        id=uuid.uuid4(),
        status="PRE_TRANSIT",
        mode="normal",
        version=0,
        tracking_number=f"1Z999AA10{order.order_code}",
        next_event_at=now + STEP_INTERVAL,
    )
    session.add(shipment)
    session.flush()
    _event(session, order, shipment, "PRE_TRANSIT", now, "capture")
    return shipment


def shipment_view(session: Session, order: Order) -> ShipmentView:
    shipment = session.get(SimulatedShipment, order.id)
    if shipment is None:
        raise NotFoundError("No scheduled simulated shipment for this order")
    return ShipmentView.model_validate(
        {
            "order_code": order.order_code,
            "order_status": order.status,
            "amount": Money(value=order.amount, currency_code=order.currency),
            "shipment_id": shipment.id,
            "tracking_number": shipment.tracking_number,
            "stage": shipment.status,
            "mode": shipment.mode,
            "version": shipment.version,
            "next_event_at": _utc(shipment.next_event_at) if shipment.next_event_at else None,
            "can_configure_scenario": not _has_dispute(session, order),
            "events": [
                TrackingEventResponse(
                    carrier=event.carrier,
                    tracking_number=event.tracking_number,
                    status=event.status,
                    event_time=_utc(event.event_time),
                    source="simulated" if (event.payload or {}).get("source") == "simulated" else "unknown",
                )
                for event in _events(session, order)
            ],
        }
    )


def _mutate(
    session: Session,
    order: Order,
    shipment: SimulatedShipment,
    *,
    now: datetime,
    action: str,
    request: ShipmentAction | None,
) -> None:
    if order.status not in PAID_STATUSES or not order.paypal_capture_id:
        raise AppError("ORDER_NOT_PAID", "Only verified paid shipments can advance", status_code=409)
    if _utc(order.created_at) > now or any(
        _utc(event.event_time) > now or _utc(event.event_time) < _utc(order.created_at)
        for event in _events(session, order)
    ):
        raise AppError("SHIPMENT_TIME_INVALID", "Shipment history contains an invalid occurrence time", status_code=409)
    stage, mode = shipment.status, shipment.mode
    if action == "advance":
        if mode != "normal" or stage not in STAGES[:-1]:
            raise AppError("SHIPMENT_TRANSITION_INVALID", "This simulated shipment cannot advance", status_code=409)
        stage = STAGES[STAGES.index(stage) + 1]
    elif action == "missing_tracking" and stage == "PRE_TRANSIT" and mode == "normal":
        mode = "missing_tracking"
    elif action == "exception" and stage in STAGES[:-1] and mode == "normal":
        stage, mode = "EXCEPTION", "exception"
    elif action == "resume" and mode in ("missing_tracking", "exception"):
        stage = "IN_TRANSIT" if mode == "exception" else stage
        mode = "normal"
    else:
        raise AppError("SHIPMENT_TRANSITION_INVALID", "This simulated shipment change is not valid", status_code=409)
    due = now + STEP_INTERVAL if mode == "normal" and stage != "DELIVERED" else None
    values: dict[str, object] = {"status": stage, "mode": mode, "version": shipment.version + 1, "next_event_at": due}
    if request is not None:
        values["last_request_id"] = request.request_id
        values["last_request_tag"] = _request_tag(request)
    claim = update(SimulatedShipment).where(
        SimulatedShipment.order_id == order.id, SimulatedShipment.version == shipment.version
    )
    if request is None:
        claim = claim.where(SimulatedShipment.next_event_at <= now, SimulatedShipment.mode == "normal")
    claimed = session.scalar(
        claim.values(**values).execution_options(synchronize_session="fetch").returning(SimulatedShipment.id)
    )
    if claimed is None:
        raise AppError("SHIPMENT_CONFLICT", "Shipment changed. Refresh before trying again.", status_code=409)
    if order.status != OrderStatus.DISPUTED.value:
        order.status = (
            "DELIVERED"
            if stage == "DELIVERED"
            else ("SHIPPED" if stage in ("IN_TRANSIT", "OUT_FOR_DELIVERY") else order.status)
        )
    _event(session, order, shipment, stage, now, "merchant" if request else "automatic")
    session.commit()


def _request_tag(request: ShipmentAction) -> str:
    return hashlib.sha256(f"{request.base_version}:{request.action}".encode()).hexdigest()


def apply_shipment_action(
    session: Session,
    code: str,
    request: ShipmentAction,
    *,
    scope: OrderScope,
    now: datetime,
) -> ShipmentView:
    now = _clock(now)
    order = session.scalar(
        select(Order)
        .where(Order.order_code == code, *scope.predicates())
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if order is None:
        raise NotFoundError("Order not found")
    shipment = session.get(SimulatedShipment, order.id, populate_existing=True)
    if shipment is None:
        raise NotFoundError("No scheduled simulated shipment for this order")
    if shipment.last_request_id == request.request_id:
        if shipment.last_request_tag != _request_tag(request):
            raise AppError(
                "IDEMPOTENCY_CONFLICT", "This request ID was already used for another change", status_code=409
            )
        return shipment_view(session, order)
    if shipment.version != request.base_version:
        raise AppError("SHIPMENT_CONFLICT", "Shipment changed. Refresh before trying again.", status_code=409)
    if request.action != "advance" and _has_dispute(session, order):
        raise AppError(
            "SHIPMENT_SCENARIO_LOCKED", "Scenario changes stop once a PayPal dispute exists", status_code=409
        )
    _mutate(session, order, shipment, now=now, action=request.action, request=request)
    return shipment_view(session, order)


def advance_due_shipments(
    session: Session,
    *,
    now: datetime,
    merchant_id: str | None = None,
    limit: int = 50,
) -> int:
    now = _clock(now)
    query = (
        select(Order.id)
        .join(SimulatedShipment)
        .where(
            SimulatedShipment.mode == "normal",
            SimulatedShipment.next_event_at <= now,
            Order.status.in_(PAID_STATUSES),
            Order.paypal_capture_id.is_not(None),
        )
        .order_by(SimulatedShipment.next_event_at)
        .limit(limit)
    )
    if merchant_id is not None:
        query = query.where(Order.merchant_id == merchant_id)
    # Bound the batch and use a version claim even where a test DB lacks row locks.
    candidates = list(session.scalars(query))
    advanced = 0
    for order_id in candidates:
        try:
            order = session.scalar(
                select(Order)
                .where(Order.id == order_id)
                .execution_options(populate_existing=True)
                .with_for_update(skip_locked=True)
            )
            if order is None:
                session.rollback()
                continue
            shipment = session.get(SimulatedShipment, order_id, populate_existing=True)
            if shipment is None:
                session.rollback()
                continue
            _mutate(session, order, shipment, now=now, action="advance", request=None)
            advanced += 1
        except AppError:
            session.rollback()
            logger.warning("Simulated shipment requires review; no milestone was written")
    return advanced
