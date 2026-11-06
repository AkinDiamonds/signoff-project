"""Fresh start wipes app data but PayPal cannot re-import pre-cutoff disputes."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from agent.app.auth import hash_password, verify_password
from agent.app.db.models import Base, Dispute, IntegrationObservation, Job, Order
from agent.app.paypal.models import parse_dispute, parse_dispute_list
from agent.app.shop.models import Product
from agent.app.sync import reconcile_disputes, sync_dispute
from agent.app.sync.fresh_start import is_before_cutoff, set_cutoff
from agent.tests.test_dispute_sync import load_fixture_json, mock_paypal_client  # noqa: F401
from scripts.fresh_start import wipe


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_short_demo_password_is_accepted() -> None:
    assert verify_password("demo123", hash_password("demo123"))


def test_wipe_keeps_catalog_and_cutoff_only(db: Session) -> None:
    db.add(Product(sku="P1", name="Mug", description="A mug", price=Decimal("5.00")))
    db.add(Dispute(id="D1", state_fingerprint="x", status="OPEN", reason="OTHER", amount=Decimal("1.00"), snapshot={}))
    db.add(Job(kind="sync_dispute", dispute_id="D1", status="PENDING", payload={}))
    db.commit()

    wiped = wipe(db)
    set_cutoff(db, datetime.now(UTC))
    db.commit()

    assert "disputes" in wiped and "products" not in wiped
    assert db.scalar(select(Dispute)) is None and db.scalar(select(Job)) is None
    assert db.scalar(select(Product)) is not None
    assert db.scalar(select(Order)) is None
    assert db.get(IntegrationObservation, "sync:ignore-before") is not None


@pytest.mark.asyncio
async def test_old_paypal_disputes_are_not_reimported(db: Session, mock_paypal_client, monkeypatch) -> None:  # noqa: F811
    set_cutoff(db, datetime(2030, 1, 1, tzinfo=UTC))
    list_fixture = load_fixture_json("s5-list-disputes.json")
    one = load_fixture_json("s5-get-dispute.json")

    async def fake_list(**_: object):
        return parse_dispute_list(list_fixture)

    async def fake_get(_: str):
        return parse_dispute(one)

    monkeypatch.setattr(mock_paypal_client, "list_disputes", fake_list)
    monkeypatch.setattr(mock_paypal_client, "get_dispute", fake_get)

    result = await reconcile_disputes(session=db, paypal_client=mock_paypal_client)
    assert result.enqueued_count == 0 and db.scalar(select(Job)) is None

    await sync_dispute(one["dispute_id"], db, mock_paypal_client)
    assert db.scalar(select(Dispute)) is None


def test_new_disputes_after_cutoff_pass(db: Session) -> None:
    set_cutoff(db, datetime.now(UTC))
    assert not is_before_cutoff(db, datetime.now(UTC) + timedelta(minutes=1))
