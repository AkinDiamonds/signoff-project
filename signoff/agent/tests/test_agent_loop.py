"""Comprehensive tests for Step 17: Agent loop and plan schema.

Per build-plan/steps/17-agent-loop.md:
- Agent reads, proposes, and hands everything to the gate; it can never act.
- Empty plan: ledger records "no action".
- Duplicate actions deduplicated; evidence ordered before message.
- Action not applicable to dispute reason: rejected and logged.
- The model names a mutating tool: rejected and logged.
- Too many actions: whole plan routed to approval.
- Stale fingerprint: skipped.
- Crash recovery: reuses same run ID.
- Very long or non-English buyer text: truncated with a marker, hash kept.
- Unknown action types rejected; amounts are decimal strings; extra fields forbidden.
- ALLOW routed to execute job; NEEDS_APPROVAL to approval creation; DENY to ledger.
- Read-tool allowlist enforced; no mutating client imported in agent package.
"""

import ast
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.agent.budget import DailyBudget
from agent.app.agent.cache import ScenarioCache
from agent.app.agent.llm import FakeProvider, LLMService, ProviderResponse
from agent.app.agent.loop import (
    is_action_applicable_to_reason,
    normalize_and_order_actions,
    run_agent_loop,
)
from agent.app.agent.prompts import (
    NON_ENGLISH_MARKER,
    TRUNCATION_MARKER,
    build_agent_prompt,
    is_likely_non_english,
    sanitize_buyer_text_for_prompt,
)
from agent.app.agent.schemas import (
    AgentPlan,
    MakeOfferActionSchema,
)
from agent.app.db.base import Base
from agent.app.db.models import AgentRun, Decision, Job
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.actions import ProvideEvidence, SendMessage
from agent.app.domain.enums import (
    ActionType,
    DisputeReason,
    DisputeStatus,
    JobKind,
    TimelineEventKind,
    Verdict,
)
from agent.app.domain.money import Money
from agent.app.ledger.service import get_timeline_events
from agent.app.paypal.models import (
    AllowedResponseOptions,
    Dispute,
    DisputedTransaction,
    DisputeMessage,
    ItemInfo,
    Link,
    MakeOfferOption,
)
from agent.app.store.base import StoreAmbiguous, StoreUnavailable
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
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = session_factory()
    seed_scenarios(session)
    yield session
    session.close()


def make_dispute(
    dispute_id: str = "PP-D-12345",
    reason: DisputeReason = DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
    status: DisputeStatus = DisputeStatus.WAITING_FOR_SELLER_RESPONSE,
    amount_str: str = "100.00",
    currency: str = "USD",
    links: list[Link] | None = None,
    allowed_options: AllowedResponseOptions | None = None,
    messages: list[DisputeMessage] | None = None,
    due_date: datetime | None = None,
) -> Dispute:
    """Helper to build a valid PayPal Dispute model."""
    default_links = [
        Link(
            href=f"https://api.sandbox.paypal.com/v1/customer/disputes/{dispute_id}/provide-evidence",
            rel="provide_evidence",
            method="POST",
        ),
        Link(
            href=f"https://api.sandbox.paypal.com/v1/customer/disputes/{dispute_id}/send-message",
            rel="send_message",
            method="POST",
        ),
    ]
    return Dispute(
        dispute_id=dispute_id,
        create_time=datetime(2026, 10, 1, 10, 0, 0, tzinfo=UTC),
        update_time=datetime(2026, 10, 1, 10, 0, 0, tzinfo=UTC),
        dispute_amount=Money(currency_code=currency, value=Decimal(amount_str)),
        status=status,
        reason=reason,
        dispute_state="REQUIRED_ACTION",
        dispute_life_cycle_stage="INQUIRY",
        dispute_channel="INTERNAL",
        seller_response_due_date=due_date or datetime.now(UTC) + timedelta(days=5),
        disputed_transactions=[
            DisputedTransaction(
                buyer_transaction_id="TX-BUYER-A",
                seller_transaction_id="TX-SCENARIO-A",
                items=[ItemInfo(item_name="Mechanical Watch", item_id="IT-01")],
            )
        ],
        links=links if links is not None else default_links,
        allowed_response_options=allowed_options or AllowedResponseOptions(),
        messages=messages or [],
    )


def make_llm_service(responses: list[ProviderResponse | Exception]) -> LLMService:
    """Helper to create an LLMService with scripted responses."""
    provider = FakeProvider(responses)
    cache = ScenarioCache(enabled=False)
    budget = DailyBudget(Decimal("100.00"))
    return LLMService(
        provider=provider,
        cache=cache,
        budget=budget,
    )


# ==============================================================================
# 1. Type tests: schemas, decimal strings, extra fields forbidden
# ==============================================================================


def test_schema_rejects_unknown_action_type():
    raw = {"actions": [{"action_type": "DO_SOMETHING_UNKNOWN"}]}
    with pytest.raises(ValidationError):
        AgentPlan.model_validate(raw)


def test_schema_rejects_float_amount_for_offers():
    raw = {
        "actions": [
            {
                "action_type": "MAKE_OFFER",
                "amount": {"currency_code": "USD", "value": 25.50},  # float rejected!
            }
        ]
    }
    with pytest.raises(ValidationError, match="JSON floats are rejected"):
        AgentPlan.model_validate(raw)


def test_schema_accepts_valid_decimal_string_amount():
    raw = {
        "actions": [
            {
                "action_type": "MAKE_OFFER",
                "amount": {"currency_code": "USD", "value": "25.50"},
            }
        ]
    }
    plan = AgentPlan.model_validate(raw)
    assert len(plan.actions) == 1
    assert isinstance(plan.actions[0], MakeOfferActionSchema)
    domain_action = plan.actions[0].to_domain()
    assert domain_action.amount.value == Decimal("25.50")


def test_schema_forbids_extra_fields():
    raw_plan_extra = {
        "actions": [{"action_type": "PROVIDE_EVIDENCE"}],
        "hallucinated_field": "bad",
    }
    with pytest.raises(ValidationError):
        AgentPlan.model_validate(raw_plan_extra)

    raw_action_extra = {
        "actions": [
            {
                "action_type": "PROVIDE_EVIDENCE",
                "unknown_nested": True,
            }
        ]
    }
    with pytest.raises(ValidationError):
        AgentPlan.model_validate(raw_action_extra)


# ==============================================================================
# 2. Behavior tests: Empty plan records "no action"
# ==============================================================================


@pytest.mark.asyncio
async def test_empty_plan_records_no_action(db_session: Session):
    dispute = make_dispute()
    service = make_llm_service([ProviderResponse('{"actions": []}')])

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "no_action"
    assert result.actions_count == 0

    events, _ = get_timeline_events(db_session, dispute.dispute_id)
    kinds = [e["kind"] for e in events]
    assert TimelineEventKind.NO_ACTION.value in kinds

    run = db_session.get(AgentRun, result.run_id)
    assert run is not None
    assert run.plan == {"actions": []}


# ==============================================================================
# 3. Behavior tests: Deduplication and Ordering (evidence before message)
# ==============================================================================


def test_normalize_and_order_actions():
    ev = ProvideEvidence(action_type=ActionType.PROVIDE_EVIDENCE, notes="Tracking proof")
    ev_duplicate = ProvideEvidence(action_type=ActionType.PROVIDE_EVIDENCE, notes="Tracking proof")
    msg = SendMessage(action_type=ActionType.SEND_MESSAGE, message="We sent your order.")

    # Input: SendMessage first, then ProvideEvidence twice
    raw_actions = [msg, ev, ev_duplicate]
    ordered = normalize_and_order_actions(raw_actions)

    # Output: Exactly 2 actions, and ProvideEvidence MUST precede SendMessage
    assert len(ordered) == 2
    assert ordered[0].action_type == ActionType.PROVIDE_EVIDENCE
    assert ordered[1].action_type == ActionType.SEND_MESSAGE


@pytest.mark.asyncio
async def test_loop_deduplicates_and_orders_actions(db_session: Session):
    dispute = make_dispute()
    response_json = json.dumps(
        {
            "actions": [
                {"action_type": "SEND_MESSAGE", "message": "First message"},
                {"action_type": "PROVIDE_EVIDENCE", "notes": "Fulfillment info"},
                {"action_type": "PROVIDE_EVIDENCE", "notes": "Fulfillment info"},  # duplicate
            ]
        }
    )
    service = make_llm_service([ProviderResponse(response_json)])

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "completed"
    assert result.actions_count == 2
    assert len(result.decisions) == 2

    decisions = db_session.execute(
        select(Decision).where(Decision.dispute_id == dispute.dispute_id).order_by(Decision.created_at)
    ).scalars().all()

    action_types = [d.action_type for d in decisions]
    assert action_types == [ActionType.PROVIDE_EVIDENCE.value, ActionType.SEND_MESSAGE.value]


# ==============================================================================
# 4. Behavior tests: Inapplicable actions & Mutating tool names rejected
# ==============================================================================


def test_is_action_applicable_to_reason():
    # ProvideEvidence is applicable for not-received disputes
    assert is_action_applicable_to_reason(
        ActionType.PROVIDE_EVIDENCE,
        DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        DisputeStatus.WAITING_FOR_SELLER_RESPONSE,
    )

    # ProvideEvidence is NOT applicable for unauthorised disputes
    assert not is_action_applicable_to_reason(
        ActionType.PROVIDE_EVIDENCE,
        DisputeReason.UNAUTHORISED,
        DisputeStatus.WAITING_FOR_SELLER_RESPONSE,
    )

    # Appeal is not applicable for open disputes
    assert not is_action_applicable_to_reason(
        ActionType.APPEAL,
        DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        DisputeStatus.WAITING_FOR_SELLER_RESPONSE,
    )

    # Appeal IS applicable for resolved disputes
    assert is_action_applicable_to_reason(
        ActionType.APPEAL,
        DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED,
        DisputeStatus.RESOLVED,
    )


@pytest.mark.asyncio
async def test_inapplicable_action_rejected_and_logged(db_session: Session):
    # Dispute is UNAUTHORISED, so ProvideEvidence is inapplicable
    dispute = make_dispute(reason=DisputeReason.UNAUTHORISED)
    response_json = json.dumps({"actions": [{"action_type": "PROVIDE_EVIDENCE", "notes": "Proof"}]})
    service = make_llm_service([ProviderResponse(response_json)])

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "no_action"
    events, _ = get_timeline_events(db_session, dispute.dispute_id)
    kinds = [e["kind"] for e in events]
    assert TimelineEventKind.NO_ACTION.value in kinds


@pytest.mark.asyncio
async def test_mutating_tool_name_rejected_by_schema(db_session: Session):
    # Model returns "refund" as action_type (forbidden mutating tool name)
    dispute = make_dispute()
    service = make_llm_service([ProviderResponse('{"actions": [{"action_type": "refund"}]}')])

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    # LLMService repaired or returned failure since schema rejects "refund"
    assert result.status in ("failed", "no_action")


# ==============================================================================
# 5. Behavior tests: Too many actions -> Whole plan routed to approval
# ==============================================================================


@pytest.mark.asyncio
async def test_too_many_actions_routed_to_approval(db_session: Session):
    # 3 distinct actions exceeds MAX_ACTIONS_PER_PLAN (2)
    dispute = make_dispute(
        allowed_options=AllowedResponseOptions(
            make_offer=MakeOfferOption(offer_types=["REFUND"]),
        ),
        links=[
            Link(href="...", rel="provide_evidence", method="POST"),
            Link(href="...", rel="send_message", method="POST"),
            Link(href="...", rel="make_offer", method="POST"),
        ],
    )
    response_json = json.dumps(
        {
            "actions": [
                {"action_type": "PROVIDE_EVIDENCE", "notes": "Tracking"},
                {"action_type": "SEND_MESSAGE", "message": "Hello"},
                {"action_type": "MAKE_OFFER", "amount": {"currency_code": "USD", "value": "10.00"}},
            ]
        }
    )
    service = make_llm_service([ProviderResponse(response_json)])

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "completed"
    assert result.actions_count == 3

    # All decisions must have NEEDS_APPROVAL verdict
    decisions = db_session.execute(
        select(Decision).where(Decision.dispute_id == dispute.dispute_id)
    ).scalars().all()

    assert len(decisions) == 3
    for dec in decisions:
        assert dec.verdict == Verdict.NEEDS_APPROVAL.value

    # NO execute jobs should be enqueued
    execute_jobs = db_session.execute(
        select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value)
    ).scalars().all()
    assert len(execute_jobs) == 0

    # APPROVAL_REQUESTED ledger events must be present
    events, _ = get_timeline_events(db_session, dispute.dispute_id)
    approval_events = [e for e in events if e["kind"] == TimelineEventKind.APPROVAL_REQUESTED.value]
    assert len(approval_events) == 3


# ==============================================================================
# 6. Behavior tests: Stale fingerprint skipped
# ==============================================================================


@pytest.mark.asyncio
async def test_stale_fingerprint_skipped(db_session: Session):
    dispute = make_dispute()
    fake_provider = FakeProvider([ProviderResponse('{"actions": []}')])
    service = LLMService(
        provider=fake_provider,
        cache=ScenarioCache(enabled=False),
        budget=DailyBudget(Decimal("10.00")),
    )

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        expected_fingerprint="stale_hash_12345",
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "skipped"
    # LLM was never called
    assert fake_provider.calls == 0


# ==============================================================================
# 7. Behavior tests: Crash retry reuses same run ID
# ==============================================================================


@pytest.mark.asyncio
async def test_crash_retry_reuses_same_run_id(db_session: Session):
    dispute = make_dispute()
    resp = '{"actions": [{"action_type": "SEND_MESSAGE", "message": "Hi"}]}'
    service = make_llm_service([ProviderResponse(resp), ProviderResponse(resp)])

    first_result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )
    first_run_id = first_result.run_id

    # Simulate rerun / retry
    second_result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )
    second_run_id = second_result.run_id

    assert first_run_id == second_run_id

    # Exactly one AgentRun row exists in DB
    runs = db_session.execute(
        select(AgentRun).where(AgentRun.dispute_id == dispute.dispute_id)
    ).scalars().all()
    assert len(runs) == 1
    assert runs[0].id == first_run_id


# ==============================================================================
# 8. Buyer text sanitization: long and non-English text handling
# ==============================================================================


def test_sanitize_buyer_text_long_and_non_english():
    # Very long English text
    long_text = "Where is my item? " * 100
    sanitized = sanitize_buyer_text_for_prompt(long_text, max_length=200)
    assert TRUNCATION_MARKER in sanitized
    # Precise bound: truncated at 200 chars + space + marker
    assert len(sanitized) <= 200 + 1 + len(TRUNCATION_MARKER)

    # Non-English text
    russian_text = "Где мой заказ? Я жду уже две недели и ничего не пришло."
    assert is_likely_non_english(russian_text)
    sanitized_non_eng = sanitize_buyer_text_for_prompt(russian_text)
    assert NON_ENGLISH_MARKER in sanitized_non_eng

    # Combined: very long non-English text must also be capped at max_length
    long_russian = russian_text * 20  # >> 500 chars
    sanitized_long_non_eng = sanitize_buyer_text_for_prompt(long_russian, max_length=200)
    assert NON_ENGLISH_MARKER in sanitized_long_non_eng
    assert len(sanitized_long_non_eng) <= 200 + 1 + len(NON_ENGLISH_MARKER)


def test_build_agent_prompt_preserves_input_hash_for_long_text():
    dispute = make_dispute(
        messages=[DisputeMessage(posted_by="BUYER", content="A" * 1500, time_posted=datetime.now(UTC))]
    )
    prompt_text, input_hash = build_agent_prompt(dispute)

    # Prompt text contains truncation marker
    assert TRUNCATION_MARKER in prompt_text
    # Hash is a 64-char hex SHA-256 string
    assert len(input_hash) == 64
    int(input_hash, 16)  # valid hex


# ==============================================================================
# 9. Gate routing: ALLOW -> execute job, NEEDS_APPROVAL -> approval, DENY -> ledger
# ==============================================================================


@pytest.mark.asyncio
async def test_gate_routing_allow_enqueues_execute_job(db_session: Session):
    dispute = make_dispute()
    service = make_llm_service(
        [ProviderResponse('{"actions": [{"action_type": "PROVIDE_EVIDENCE", "notes": "Shipped via UPS"}]}')]
    )

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "completed"
    assert result.decisions[0].verdict == Verdict.ALLOW

    # Execute job was enqueued
    execute_jobs = db_session.execute(
        select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value)
    ).scalars().all()
    assert len(execute_jobs) == 1
    assert execute_jobs[0].payload["decision_id"] is not None


@pytest.mark.asyncio
async def test_gate_routing_deny_records_decision_in_ledger_only(db_session: Session):
    # Deadline in the past triggers G2-02 (DENY)
    past_due = datetime.now(UTC) - timedelta(days=2)
    dispute = make_dispute(due_date=past_due)
    service = make_llm_service(
        [ProviderResponse('{"actions": [{"action_type": "PROVIDE_EVIDENCE", "notes": "Late evidence"}]}')]
    )

    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        llm_service=service,
    )

    assert result.status == "completed"
    assert result.decisions[0].verdict == Verdict.DENY

    # Decision recorded
    decisions = db_session.execute(
        select(Decision).where(Decision.dispute_id == dispute.dispute_id)
    ).scalars().all()
    assert len(decisions) == 1
    assert decisions[0].verdict == Verdict.DENY.value

    # NO execute job enqueued
    execute_jobs = db_session.execute(
        select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value)
    ).scalars().all()
    assert len(execute_jobs) == 0


# ==============================================================================
# 10. Architecture contract: no mutating client imports in agent package
# ==============================================================================


def test_agent_package_has_no_mutating_client_imports():
    """Verify that agent/app/agent/ contains no imports of mutating_client."""
    agent_dir = Path(__file__).resolve().parents[1] / "app" / "agent"
    assert agent_dir.is_dir()

    violations: list[str] = []
    for py_file in agent_dir.rglob("*.py"):
        tree = ast.parse(py_file.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if "mutating_client" in alias.name:
                        violations.append(f"{py_file.name}: {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                if "mutating_client" in mod:
                    violations.append(f"{py_file.name}: from {mod}")
                for alias in node.names:
                    if "mutating_client" in alias.name:
                        violations.append(f"{py_file.name}: from {mod} import {alias.name}")

    assert not violations, f"Forbidden mutating client imports in agent package: {violations}"


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", [StoreUnavailable, StoreAmbiguous])
async def test_store_unavailable_fails_closed_to_human_review(db_session: Session, failure):
    """Unavailable or ambiguous evidence stops before planning or execution."""
    class BrokenStoreAdapter:
        def find_order(self, transaction_id: str):
            raise failure("Order resolution failed")

        def get_shipments(self, order_code: str):
            raise StoreUnavailable("Store network connection timeout")

        def get_messages(self, order_code: str):
            raise StoreUnavailable("Store network connection timeout")

        def get_policies(self):
            raise StoreUnavailable("Store network connection timeout")

    dispute = make_dispute()
    result = await run_agent_loop(
        session=db_session,
        dispute_id=dispute.dispute_id,
        dispute=dispute,
        store_adapter=BrokenStoreAdapter(),
    )

    assert result.human_needed is True
    assert result.actions_count == 0
    assert result.status == "no_action"
    assert len(result.decisions) == 0

    events, _ = get_timeline_events(db_session, dispute.dispute_id)
    kinds = [e["kind"] for e in events]
    assert TimelineEventKind.NO_ACTION.value in kinds

