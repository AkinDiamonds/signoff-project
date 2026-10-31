"""All dispute transactions must resolve identically, without guessing an order."""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from agent.app.db.base import Base
from agent.app.db.models import Dispute, Order
from agent.app.db.session import get_db_session
from agent.app.main import create_app
from agent.app.paypal.models import DisputedTransaction
from agent.app.settings import Settings
from agent.app.store.base import StoreAmbiguous, StoreUnavailable
from agent.app.store.http_adapter import HttpStoreAdapter
from agent.app.store.local_adapter import LocalStoreAdapter
from agent.app.store.resolution import resolve_disputed_order


@dataclass(frozen=True)
class Link:
    order_code: str


@pytest.mark.parametrize("typed", [False, True])
def test_seller_reference_wins_over_unrelated_buyer_reference(typed):
    tx = {"seller_transaction_id": "SELLER", "buyer_transaction_id": "BUYER"}
    transactions = [DisputedTransaction.model_validate(tx) if typed else tx]
    lookup = {"SELLER": Link("CORRECT"), "BUYER": Link("UNRELATED")}
    result = resolve_disputed_order(transactions, lookup.get)
    assert result.status == "found" and result.order.order_code == "CORRECT"
    assert result.transaction_id == "SELLER"


def test_resolver_considers_later_transactions_and_verified_buyer_fallback():
    lookup = {"KNOWN": Link("ORDER")}
    result = resolve_disputed_order([
        {"buyer_transaction_id": "UNKNOWN"},
        {"seller_transaction_id": "OTHER", "buyer_transaction_id": "KNOWN"},
    ], lookup.get)
    assert result.status == "found" and result.order.order_code == "ORDER"
    assert result.transaction_id == "KNOWN"


def test_two_different_linked_orders_are_ambiguous():
    lookup = {"A": Link("ONE"), "B": Link("TWO")}
    result = resolve_disputed_order([
        {"seller_transaction_id": "A"}, {"seller_transaction_id": "B"},
    ], lookup.get)
    assert result.status == "ambiguous" and result.order is None


def test_repeated_aliases_for_same_order_are_not_ambiguous():
    calls = []

    def lookup(identifier):
        calls.append(identifier)
        return Link("SAME")

    result = resolve_disputed_order([
        {"seller_transaction_id": "A"}, {"seller_transaction_id": "A"},
        {"seller_transaction_id": "B"},
    ], lookup)
    assert result.status == "found" and result.order.order_code == "SAME"
    assert calls == ["A", "B"]


@pytest.mark.parametrize("failure,status", [
    (StoreAmbiguous("Duplicate local mappings"), "ambiguous"),
    (StoreUnavailable("Store offline"), "unavailable"),
])
def test_lookup_failure_cannot_become_a_successful_match(failure, status):
    def lookup(identifier):
        if identifier == "A":
            return Link("ONE")
        raise failure

    result = resolve_disputed_order([
        {"seller_transaction_id": "A"}, {"seller_transaction_id": "B"},
    ], lookup)
    assert result.status == status and result.order is None


@pytest.mark.parametrize("transactions", [None, {}, [], [None, 42, {}]])
def test_no_identifiers_never_match_by_other_fields(transactions):
    result = resolve_disputed_order(transactions, lambda _: pytest.fail("No lookup expected"))
    assert result.status == "not_found" and result.order is None


@pytest.mark.parametrize("duplicate", [False, True])
def test_merchant_list_detail_and_local_store_agree(duplicate):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for index in range(2 if duplicate else 1):
            session.add(Order(
                order_code=f"SIG-RESOLVE-{index}", merchant_id="MOCK-MERCHANT-001",
                customer_email="buyer@example.test", paypal_transaction_id="SELLER",
                amount=Decimal("21.00"), currency="USD", status="PAID", items=[],
                created_at=datetime.now(UTC),
            ))
        transactions = [
            {"buyer_transaction_id": "UNKNOWN"},
            {"seller_transaction_id": "SELLER", "buyer_transaction_id": "BUYER"},
        ]
        session.add(Dispute(
            id="PP-RESOLVE", state_fingerprint="fingerprint", status="OPEN",
            reason="MERCHANDISE_OR_SERVICE_NOT_RECEIVED", amount=Decimal("21.00"), currency="USD",
            snapshot={"disputed_transactions": transactions}, created_at=datetime.now(UTC),
        ))
        session.commit()
        resolved = resolve_disputed_order(transactions, LocalStoreAdapter(session).find_order)
        expected = "ambiguous" if duplicate else "found"
        assert resolved.status == expected
        app = create_app(Settings(store_api_key="fictional-store-key"))
        app.dependency_overrides[get_db_session] = lambda: session
        with TestClient(app) as client:
            detail = client.get("/api/disputes/PP-RESOLVE").json()
            listing = client.get("/api/disputes").json()["items"][0]
            for view in (detail, listing):
                assert view["order_resolution"] == expected
                assert view["order_code"] == (None if duplicate else "SIG-RESOLVE-0")
            store = client.get(
                "/api/store/orders/by-transaction/SELLER", headers={"X-Store-Key": "fictional-store-key"}
            )
            assert store.status_code == (409 if duplicate else 200)
    engine.dispose()


def test_http_store_preserves_ambiguity_instead_of_returning_a_match():
    client = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(409)))
    adapter = HttpStoreAdapter("https://store.example.test", "fictional-key", client)
    with pytest.raises(StoreAmbiguous):
        adapter.find_order("DUPLICATE")
    client.close()


@pytest.mark.parametrize('chosen_demo', [None, 'chosen-demo'])
def test_merchant_resolution_does_not_mix_other_merchants_or_demo_sessions(chosen_demo):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for code, merchant, demo in [
            ('CORRECT', 'MERCHANT-A', chosen_demo),
            ('OTHER-MERCHANT', 'MERCHANT-B', None),
            ('OTHER-DEMO', 'MERCHANT-A', 'different-demo'),
        ]:
            session.add(Order(
                order_code=code, merchant_id=merchant, demo_session_id=demo,
                customer_email='buyer@example.test', paypal_transaction_id='SHARED-CAPTURE',
                amount=Decimal('21.00'), currency='USD', status='PAID', items=[], created_at=datetime.now(UTC),
            ))
        session.add(Dispute(
            id='PP-SCOPED', state_fingerprint='fp', status='OPEN',
            reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('21.00'), currency='USD',
            snapshot={
                'disputed_transactions': [{'seller_transaction_id': 'SHARED-CAPTURE'}],
                'messages': [{'posted_by': 'BUYER', 'time_posted': datetime.now(UTC).isoformat(),
                              'content': 'Private order message'}],
            },
            demo_session_id=chosen_demo,
        ))
        session.commit()
        app = create_app(Settings(paypal_merchant_id='MERCHANT-A', store_api_key='fictional-key'))
        app.dependency_overrides[get_db_session] = lambda: session
        with TestClient(app) as client:
            detail = client.get('/api/disputes/PP-SCOPED').json()
            listing = client.get('/api/disputes').json()['items'][0]
            for view in (detail, listing):
                assert view['order_resolution'] == 'found'
                assert view['order_code'] == 'CORRECT'
            for route in ('shipments', 'messages'):
                response = client.get(
                    f'/api/store/orders/OTHER-MERCHANT/{route}', headers={'X-Store-Key': 'fictional-key'}
                )
                if route == 'messages':
                    assert response.status_code == 200 and response.json() == []
                else:
                    assert response.status_code == 404
    engine.dispose()


def test_verified_capture_reference_does_not_accept_conflicting_legacy_alias():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Order(
            order_code='CANONICAL', merchant_id='MERCHANT-A', customer_email='buyer@example.test',
            paypal_transaction_id='OLD-UNVERIFIED-ALIAS', paypal_capture_id='VERIFIED-CAPTURE',
            amount=Decimal('21.00'), currency='USD', status='PAID', items=[], created_at=datetime.now(UTC),
        ))
        session.commit()
        adapter = LocalStoreAdapter(session)
        record = adapter.find_order('VERIFIED-CAPTURE')
        assert record.order_code == 'CANONICAL'
        assert record.paypal_transaction_id == 'VERIFIED-CAPTURE'
        assert adapter.find_order('OLD-UNVERIFIED-ALIAS') is None
    engine.dispose()
