"""Persistent simulated shipping: legal transitions, retries and safe ownership."""

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session

from agent.app.agent.evidence import build_evidence
from agent.app.db.base import Base
from agent.app.db.models import Dispute, Order, SimulatedShipment, TrackingEvent
from agent.app.errors import AppError
from agent.app.fulfillment.service import (
    ShipmentAction,
    advance_due_shipments,
    apply_shipment_action,
    create_simulated_shipment,
    shipment_view,
)
from agent.app.settings import Settings
from agent.app.store.scope import OrderScope
from agent.app.store_mock.repository import load_order_context

NOW = datetime(2026, 10, 31, tzinfo=UTC)
SCOPE = OrderScope("MERCHANT-A")


@pytest.fixture
def shipment_order():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        order = Order(
            order_code="SIGSHIPTEST",
            merchant_id="MERCHANT-A",
            customer_email="buyer@example.test",
            amount="21.00",
            currency="USD",
            status="PAID",
            items=[],
            created_at=NOW - timedelta(minutes=1),
            paypal_capture_id="VERIFIED-CAPTURE",
            paypal_transaction_id="VERIFIED-CAPTURE",
        )
        session.add(order)
        session.flush()
        create_simulated_shipment(session, order, now=NOW)
        session.commit()
        yield session, order
    engine.dispose()


def action(version, kind="advance", request_id=None):
    return ShipmentAction(base_version=version, action=kind, request_id=request_id or uuid.uuid4())


def test_manual_progression_and_duplicate_request(shipment_order):
    session, order = shipment_order
    expected = [("IN_TRANSIT", "SHIPPED"), ("OUT_FOR_DELIVERY", "SHIPPED"), ("DELIVERED", "DELIVERED")]
    identity = shipment_view(session, order).shipment_id
    for version, (stage, status) in enumerate(expected):
        request = action(version)
        first = apply_shipment_action(session, order.order_code, request, scope=SCOPE, now=NOW)
        repeated = apply_shipment_action(session, order.order_code, request, scope=SCOPE, now=NOW)
        assert first.stage == repeated.stage == stage
        assert first.order_status == status and first.shipment_id == identity
    events = session.scalars(select(TrackingEvent).where(TrackingEvent.order_id == order.id)).all()
    assert len(events) == 4
    assert all(event.payload["source"] == "simulated" for event in events)
    assert all(event.event_time.replace(tzinfo=UTC) <= NOW for event in events)
    with pytest.raises(AppError):
        apply_shipment_action(session, order.order_code, action(3), scope=SCOPE, now=NOW)


def test_stale_and_reused_request_id_cannot_advance_again(shipment_order):
    session, order = shipment_order
    first = action(0)
    apply_shipment_action(session, order.order_code, first, scope=SCOPE, now=NOW)
    for invalid in (action(0), action(1, request_id=first.request_id)):
        with pytest.raises(AppError) as caught:
            apply_shipment_action(session, order.order_code, invalid, scope=SCOPE, now=NOW)
        assert caught.value.status_code == 409
    assert shipment_view(session, order).version == 1


def test_automatic_schedule_survives_restart_and_does_not_invent_past_events(shipment_order):
    session, order = shipment_order
    assert advance_due_shipments(session, now=NOW) == 0
    with Session(session.get_bind()) as restarted:
        for minute, stage in ((1, "IN_TRANSIT"), (2, "OUT_FOR_DELIVERY"), (3, "DELIVERED")):
            at = NOW + timedelta(minutes=minute)
            assert advance_due_shipments(restarted, now=at) == 1
            stored = restarted.get(Order, order.id)
            assert shipment_view(restarted, stored).stage == stage
            assert advance_due_shipments(restarted, now=at) == 0
        assert shipment_view(restarted, stored).next_event_at is None


@pytest.mark.parametrize("scope", [OrderScope("OTHER"), OrderScope("MERCHANT-A", "other-demo")])
def test_wrong_merchant_or_demo_scope_cannot_advance(shipment_order, scope):
    session, order = shipment_order
    with pytest.raises(AppError) as caught:
        apply_shipment_action(session, order.order_code, action(0), scope=scope, now=NOW)
    assert caught.value.status_code == 404
    assert shipment_view(session, order).version == 0


def test_missing_tracking_and_exception_are_explicit_and_pause_automatic_steps(shipment_order):
    session, order = shipment_order
    missing = apply_shipment_action(session, order.order_code, action(0, "missing_tracking"), scope=SCOPE, now=NOW)
    assert missing.mode == "missing_tracking" and missing.next_event_at is None
    assert advance_due_shipments(session, now=NOW + timedelta(days=1)) == 0
    apply_shipment_action(session, order.order_code, action(1, "resume"), scope=SCOPE, now=NOW)
    exception = apply_shipment_action(session, order.order_code, action(2, "exception"), scope=SCOPE, now=NOW)
    assert exception.stage == "EXCEPTION" and exception.next_event_at is None
    resumed = apply_shipment_action(session, order.order_code, action(3, "resume"), scope=SCOPE, now=NOW)
    assert resumed.stage == "IN_TRANSIT" and resumed.mode == "normal"


def test_dispute_status_is_not_replaced_by_shipping_status(shipment_order):
    session, order = shipment_order
    order.status = "DISPUTED"
    session.commit()
    result = apply_shipment_action(session, order.order_code, action(0), scope=SCOPE, now=NOW)
    assert result.order_status == "DISPUTED" and result.stage == "IN_TRANSIT"


@pytest.mark.parametrize("status", ["PENDING", "CANCELLED"])
def test_unpaid_or_cancelled_order_cannot_advance(shipment_order, status):
    session, order = shipment_order
    order.status = status
    session.commit()
    with pytest.raises(AppError):
        apply_shipment_action(session, order.order_code, action(0), scope=SCOPE, now=NOW)


def test_future_history_and_naive_clock_are_rejected(shipment_order):
    session, order = shipment_order
    with pytest.raises(ValueError):
        apply_shipment_action(session, order.order_code, action(0), scope=SCOPE, now=NOW.replace(tzinfo=None))
    event = session.scalar(select(TrackingEvent).where(TrackingEvent.order_id == order.id))
    event.event_time = NOW + timedelta(days=1)
    session.commit()
    with pytest.raises(AppError):
        apply_shipment_action(session, order.order_code, action(0), scope=SCOPE, now=NOW)


def test_missing_tracking_requires_human_review_without_deleting_history(shipment_order):
    session, order = shipment_order
    before = session.scalars(select(TrackingEvent.id)).all()
    apply_shipment_action(session, order.order_code, action(0, "missing_tracking"), scope=SCOPE, now=NOW)
    record = load_order_context(session, "VERIFIED-CAPTURE")
    assert record.shipments == ()
    evidence = build_evidence(record, reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED")
    assert not evidence.buildable and "withheld" in evidence.reason
    assert set(before) <= set(session.scalars(select(TrackingEvent.id)).all())


def test_future_delivery_is_not_delivery_evidence(shipment_order):
    session, order = shipment_order
    session.add(
        TrackingEvent(
            order_id=order.id,
            carrier="UPS",
            tracking_number="SIM-FUTURE",
            status="DELIVERED",
            event_time=datetime.now(UTC) + timedelta(days=1),
            payload={"source": "simulated"},
        )
    )
    session.commit()
    record = load_order_context(session, "VERIFIED-CAPTURE")
    assert all(event.status != "DELIVERED" for event in record.shipments)
    assert not build_evidence(record, reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED").buildable


def test_scenario_is_locked_after_a_paypal_dispute_but_progress_can_append(shipment_order):
    session, order = shipment_order
    session.add(
        Dispute(
            id="PP-SHIP-LOCK",
            state_fingerprint="fp",
            status="OPEN",
            reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
            amount="21.00",
            currency="USD",
            snapshot={"disputed_transactions": [{"seller_transaction_id": "VERIFIED-CAPTURE"}]},
        )
    )
    session.commit()
    with pytest.raises(AppError) as caught:
        apply_shipment_action(session, order.order_code, action(0, "exception"), scope=SCOPE, now=NOW)
    assert caught.value.code == "SHIPMENT_SCENARIO_LOCKED"
    result = apply_shipment_action(session, order.order_code, action(0), scope=SCOPE, now=NOW)
    assert result.stage == "IN_TRANSIT" and not result.can_configure_scenario


def test_automatic_progress_respects_merchant_boundary(shipment_order):
    session, order = shipment_order
    assert advance_due_shipments(session, now=NOW + timedelta(minutes=1), merchant_id="OTHER") == 0
    assert shipment_view(session, order).version == 0


def test_two_database_sessions_cannot_advance_the_same_version_twice():
    engine = create_engine(Settings().database_url)
    code = f"SIG{uuid.uuid4().hex[:20]}"
    now = datetime.now(UTC)
    with Session(engine) as session:
        order = Order(
            order_code=code,
            merchant_id="MERCHANT-A",
            customer_email="buyer@example.test",
            amount="21.00",
            currency="USD",
            status="PAID",
            items=[],
            created_at=now - timedelta(minutes=1),
            paypal_capture_id="CAPTURE-CONCURRENT",
            paypal_transaction_id="CAPTURE-CONCURRENT",
        )
        session.add(order)
        session.flush()
        create_simulated_shipment(session, order, now=now)
        session.commit()
        identifier = order.id
    barrier = threading.Barrier(2)

    def advance():
        with Session(engine) as session:
            barrier.wait(timeout=5)
            try:
                apply_shipment_action(session, code, action(0), scope=SCOPE, now=now)
                return "OK"
            except AppError as error:
                return error.code

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(advance) for _ in range(2)]
            assert sorted(future.result(timeout=15) for future in futures) == ["OK", "SHIPMENT_CONFLICT"]
        with Session(engine) as session:
            assert session.get(SimulatedShipment, identifier).version == 1
            assert len(session.scalars(select(TrackingEvent).where(TrackingEvent.order_id == identifier)).all()) == 2
    finally:
        with Session(engine) as session:
            session.execute(delete(TrackingEvent).where(TrackingEvent.order_id == identifier))
            session.execute(delete(SimulatedShipment).where(SimulatedShipment.order_id == identifier))
            session.execute(delete(Order).where(Order.id == identifier))
            session.commit()
        engine.dispose()
