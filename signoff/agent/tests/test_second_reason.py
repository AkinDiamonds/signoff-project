"""Step 22 tests: reason registry, second reason, and repeat-disputer history."""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.agent.budget import DailyBudget
from agent.app.agent.cache import ScenarioCache
from agent.app.agent.llm import FakeProvider, LLMService, ProviderResponse
from agent.app.agent.loop import run_agent_loop
from agent.app.agent.reasons import (
    SupportedReason,
    UnsupportedReason,
    build_evidence_for,
    get_support,
)
from agent.app.agent.reasons.history import count_buyer_disputes
from agent.app.agent.reasons.not_as_described import (
    NOT_AS_DESCRIBED_REASON,
    build_not_as_described,
)
from agent.app.db.base import Base
from agent.app.db.models import AgentRun, LedgerEvent
from agent.app.db.models import Dispute as DBDispute
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.enums import DisputeReason, DisputeStatus, TimelineEventKind, Verdict
from agent.app.domain.money import Money
from agent.app.ledger.service import get_timeline_events
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import (
    AllowedResponseOptions,
    BuyerInfo,
    Dispute,
    DisputedTransaction,
    Link,
)
from agent.app.store_mock.scenarios import SCENARIOS_BY_TRANSACTION_ID
from agent.app.store_mock.seed import seed_scenarios


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    install_append_only_triggers(engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)()
    seed_scenarios(session)
    session.commit()
    yield session
    session.close()


def scenario_record(scenario_id: str):
    return next(
        record for record in SCENARIOS_BY_TRANSACTION_ID.values() if record.scenario_id == scenario_id
    )


def make_dispute(reason: str, transaction_id: str, *, buyer: bool = True) -> Dispute:
    return Dispute(
        dispute_id=f"PP-{reason[:4]}-{transaction_id}",
        create_time=datetime(2026, 9, 12, 12, tzinfo=UTC),
        update_time=datetime(2026, 9, 12, 12, tzinfo=UTC),
        dispute_amount=Money(currency_code="USD", value=Decimal("55.00")),
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE,
        reason=reason,
        dispute_state="REQUIRED_ACTION",
        dispute_life_cycle_stage="INQUIRY",
        dispute_channel="INTERNAL",
        seller_response_due_date=datetime.now(UTC) + timedelta(days=5),
        disputed_transactions=[
            DisputedTransaction(
                buyer_transaction_id="TX-BUYER",
                seller_transaction_id=transaction_id,
                buyer=BuyerInfo(payer_id="BUYER-1", email="emery.wong@example.test") if buyer else None,
            )
        ],
        links=[
            Link(
                href="https://api-m.sandbox.paypal.com/v1/customer/disputes/x/provide-evidence",
                rel="provide_evidence",
            ),
            Link(
                href="https://api-m.sandbox.paypal.com/v1/customer/disputes/x/send-message",
                rel="send_message",
            ),
        ],
        allowed_response_options=AllowedResponseOptions(),
    )


def make_llm_service(plan: dict) -> LLMService:
    return LLMService(
        provider=FakeProvider([ProviderResponse(json.dumps(plan))]),
        cache=ScenarioCache(enabled=False),
        budget=DailyBudget(Decimal("100.00")),
    )


# --- Registry ---


def test_registry_is_exhaustive_for_supported_reasons():
    not_received = get_support(DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED)
    not_described = get_support(DisputeReason.MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED)

    assert isinstance(not_received, SupportedReason)
    assert isinstance(not_described, SupportedReason)
    assert not_described.requires_buildable_evidence is True


def test_unsupported_reason_is_a_distinct_type_and_never_builds():
    support = get_support(DisputeReason.UNAUTHORISED)
    assert isinstance(support, UnsupportedReason)

    evidence = build_evidence_for(
        DisputeReason.UNAUTHORISED,
        scenario_record("A"),
        transaction_id="TX-SCENARIO-A",
    )
    assert evidence.buildable is False
    assert "human review" in evidence.reason


# --- Second reason builder ---


def test_not_as_described_builds_receipt_evidence():
    record = scenario_record("E")
    evidence = build_not_as_described(record, transaction_id=record.paypal_transaction_id)

    assert evidence.buildable is True
    assert evidence.evidence_type == "RECEIPT"
    assert evidence.tracking_info == ()
    assert "Rose candle" in (evidence.notes or "")
    assert "not supported" not in evidence.reason


def test_not_as_described_without_items_is_not_buildable():
    from dataclasses import replace

    record = replace(scenario_record("E"), items=())
    evidence = build_not_as_described(record, transaction_id=record.paypal_transaction_id)

    assert evidence.buildable is False
    assert "Human review" in evidence.reason


def test_reason_change_changes_fingerprint():
    not_received = make_dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "TX-SCENARIO-E")
    not_described = make_dispute(NOT_AS_DESCRIBED_REASON, "TX-SCENARIO-E")

    assert compute_dispute_fingerprint(not_received) != compute_dispute_fingerprint(not_described)


# --- Loop behavior ---


@pytest.mark.asyncio
async def test_unsupported_reason_stops_with_human_needed(db_session: Session):
    dispute = make_dispute("UNAUTHORISED", "TX-SCENARIO-A")
    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=make_llm_service({"actions": [{"action_type": "PROVIDE_EVIDENCE"}]}),
    )

    assert result.status == "no_action"
    assert result.human_needed is True
    assert db_session.get(AgentRun, result.run_id) is None
    events, _ = get_timeline_events(db_session, dispute.dispute_id)
    assert events[-1]["kind"] == TimelineEventKind.NO_ACTION.value
    no_action = db_session.scalars(
        select(LedgerEvent).where(
            LedgerEvent.dispute_id == dispute.dispute_id,
            LedgerEvent.event_kind == TimelineEventKind.NO_ACTION.value,
        )
    ).one()
    assert no_action.payload["reason"] == "unsupported_reason"


@pytest.mark.asyncio
async def test_second_reason_repeat_disputer_needs_approval(db_session: Session):
    dispute = make_dispute(NOT_AS_DESCRIBED_REASON, "TX-SCENARIO-E")
    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=make_llm_service(
            {"actions": [{"action_type": "PROVIDE_EVIDENCE", "notes": "Order receipt attached."}]}
        ),
    )

    assert result.status == "completed"
    assert result.decisions[0].verdict == Verdict.NEEDS_APPROVAL
    assert result.decisions[0].rule_id == "G5-01"


# --- Buyer history ---


def _history_dispute(
    dispute_id: str,
    payer_id: str,
    created_at: datetime,
    demo_session_id: str | None = None,
) -> DBDispute:
    return DBDispute(
        id=dispute_id,
        state_fingerprint=dispute_id,
        status=DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value,
        reason=DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED.value,
        amount=Decimal("10.00"),
        currency="USD",
        snapshot={
            "disputed_transactions": [{"buyer": {"payer_id": payer_id}}],
        },
        demo_session_id=demo_session_id,
        created_at=created_at,
    )


def test_history_counts_only_same_buyer_inside_window(db_session: Session):
    now = datetime.now(UTC)
    db_session.add_all(
        [
            _history_dispute("PP-H1", "BUYER-1", now - timedelta(days=10)),
            _history_dispute("PP-H2", "BUYER-1", now - timedelta(days=20)),
            _history_dispute("PP-H3", "BUYER-1", now - timedelta(days=400)),
            _history_dispute("PP-H4", "BUYER-2", now - timedelta(days=5)),
            _history_dispute("PP-H5", "BUYER-1", now - timedelta(days=2), demo_session_id="demo-x"),
        ]
    )
    db_session.commit()

    history = count_buyer_disputes(
        db_session,
        make_dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "TX-SCENARIO-A"),
        now=now,
    )

    assert history.known is True
    assert history.buyer_id == "BUYER-1"
    assert history.prior_disputes == 2


def test_history_unknown_identity_is_not_flagged(db_session: Session):
    history = count_buyer_disputes(
        db_session,
        make_dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "TX-SCENARIO-A", buyer=False),
        now=datetime.now(UTC),
        fallback_count=5,
    )

    assert history.known is False
    assert history.prior_disputes == 0


def test_history_falls_back_to_seeded_count(db_session: Session):
    history = count_buyer_disputes(
        db_session,
        make_dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "TX-SCENARIO-A"),
        now=datetime.now(UTC),
        fallback_count=3,
    )

    assert history.prior_disputes == 3
