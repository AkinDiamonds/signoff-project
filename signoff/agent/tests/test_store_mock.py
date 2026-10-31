"""Mock store seeding and lookup tests using an in-memory SQLite database."""

from collections.abc import Generator
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from agent.app.agent.evidence import NOT_RECEIVED_REASON, build_evidence, to_provide_evidence
from agent.app.db.base import Base
from agent.app.db.models import Order, TrackingEvent
from agent.app.store_mock.repository import (
    find_order_by_paypal_transaction_id,
    load_order_context,
)
from agent.app.store_mock.scenarios import SCENARIOS
from agent.app.store_mock.seed import SeedResult, seed_scenarios
from scripts.bind_order import bind_order


@pytest.fixture
def session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as db_session:
        yield db_session


def test_seed_is_idempotent(session: Session):
    first = seed_scenarios(session)
    second = seed_scenarios(session)

    assert first == SeedResult(orders_added=5, tracking_events_added=5)
    assert second == SeedResult(orders_added=0, tracking_events_added=0)
    assert session.scalar(select(func.count()).select_from(Order)) == 5
    assert session.scalar(select(func.count()).select_from(TrackingEvent)) == 5


def test_lookup_by_paypal_transaction_id(session: Session):
    seed_scenarios(session)

    order = find_order_by_paypal_transaction_id(session, "TX-SCENARIO-A")
    assert order is not None
    assert order.order_code == "SIG-A-1001"
    assert find_order_by_paypal_transaction_id(session, "TX-MISSING") is None
    assert find_order_by_paypal_transaction_id(session, "") is None
    assert find_order_by_paypal_transaction_id(session, "   ") is None


def test_load_order_context_maps_shipments_and_scenario_history(session: Session):
    seed_scenarios(session)

    context = load_order_context(session, "TX-SCENARIO-C")
    assert context is not None
    assert context.scenario_id == "C"
    assert context.buyer_prior_disputes == 1
    assert len(context.shipments) == 2
    assert [shipment.carrier for shipment in context.shipments] == ["UPS", "FEDEX"]
    assert context.created_at.tzinfo is not None

    override = load_order_context(session, "TX-SCENARIO-A", buyer_prior_disputes=4)
    assert override is not None
    assert override.buyer_prior_disputes == 4


def test_lookup_miss_returns_none(session: Session):
    seed_scenarios(session)
    assert load_order_context(session, "TX-MISSING") is None


def test_seeded_order_builds_submittable_evidence(session: Session):
    seed_scenarios(session)
    context = load_order_context(session, "TX-SCENARIO-A")
    assert context is not None

    evidence = build_evidence(
        context,
        reason=NOT_RECEIVED_REASON,
        transaction_id="TX-SCENARIO-A",
    )
    action = to_provide_evidence(evidence)

    assert evidence.buildable is True
    assert action is not None
    assert action.tracking_info[0]["carrier"] == "UPS"
    assert action.tracking_info[0]["tracking_number"] == "1Z999AA10123456784"


def test_scenario_data_is_fictional_and_unique():
    transaction_ids = [scenario.paypal_transaction_id for scenario in SCENARIOS]

    assert len(transaction_ids) == len(set(transaction_ids))
    for scenario in SCENARIOS:
        assert scenario.paypal_transaction_id is not None
        assert scenario.paypal_transaction_id.startswith("TX-SCENARIO-")
        assert scenario.customer_email.endswith("@example.test")


def test_bind_order_idempotent(session: Session, monkeypatch):
    """bind_order creates an Order and TrackingEvents and is idempotent."""
    monkeypatch.setattr("scripts.bind_order.get_session_factory", lambda: lambda: session)

    bind_order("TX-REAL-99887766", "A")

    order = session.scalar(select(Order).where(Order.paypal_transaction_id == "TX-REAL-99887766"))
    assert order is not None
    assert order.order_code == "SIG-A-TX-REAL-"
    assert order.amount == Decimal("42.00")

    events = list(session.scalars(select(TrackingEvent).where(TrackingEvent.order_id == order.id)).all())
    assert len(events) == 1
    assert events[0].carrier == "UPS"

    # Running again is idempotent
    bind_order("TX-REAL-99887766", "A")
    total_orders = session.scalar(
        select(func.count()).select_from(Order).where(Order.paypal_transaction_id == "TX-REAL-99887766")
    )
    assert total_orders == 1
