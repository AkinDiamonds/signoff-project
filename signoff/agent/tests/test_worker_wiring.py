"""Tests for Step 34 blockers 0.1, 0.2, and 0.3.

Validates:
- 0.1: Full worker loop with build_registry() processes SYNC_DISPUTE -> RUN_AGENT -> EXECUTE_DECISION
  producing all expected ledger events.
- 0.2: LLM_PROVIDER=fake builds FakeScenarioProvider and returns deterministic plans,
  with failure switch via FAKE_LLM_FAIL or the explicit FAIL_LLM buyer-message marker.
- 0.3: Test seam records raw approval tokens and serves them via GET /__test__/approval-links
  when PAYPAL_ENV=stub and APP_ENV != prod.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.agent.llm import (
    SCENARIO_PLANS,
    FakeScenarioProvider,
    ProviderError,
    build_llm_service,
    build_provider,
)
from agent.app.approvals.service import create_approval
from agent.app.db.base import Base
from agent.app.db.models import Decision, LedgerEvent
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.enums import (
    ActionType,
    JobKind,
    TimelineEventKind,
    Verdict,
)
from agent.app.main import create_app
from agent.app.paypal.models import parse_dispute
from agent.app.paypal.mutating_client import MutatingResult
from agent.app.policy.charter import get_or_seed_charter
from agent.app.queue import enqueue_job
from agent.app.queue.payloads import SyncDisputePayload
from agent.app.queue.wiring import build_registry
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.store_mock.seed import seed_scenarios
from agent.app.test_seams import clear_test_approval_outbox
from agent.app.worker import Worker


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    install_append_only_triggers(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    with session_factory() as session:
        seed_scenarios(session)
        get_or_seed_charter(session)
        session.commit()
    return engine, session_factory


def test_worker_loop_full_pipeline(test_db):
    """Blocker 0.1: Worker loop processes SYNC_DISPUTE through RUN_AGENT and EXECUTE_DECISION."""
    _, session_factory = test_db

    sample_snapshot = {
        "dispute_id": "PP-SCENARIO-A",
        "create_time": "2026-10-20T10:00:00Z",
        "update_time": "2026-10-20T10:00:00Z",
        "status": "WAITING_FOR_SELLER_RESPONSE",
        "dispute_state": "REQUIRED_ACTION",
        "dispute_life_cycle_stage": "INQUIRY",
        "dispute_channel": "INTERNAL",
        "links": [
            {"href": "https://stub/provide-evidence", "rel": "provide-evidence", "method": "POST"},
            {"href": "https://stub/send-message", "rel": "send-message", "method": "POST"},
        ],
        "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "dispute_amount": {"currency_code": "USD", "value": "42.00"},
        "disputed_transactions": [
            {
                "seller_transaction_id": "TX-SCENARIO-A",
                "buyer_transaction_id": "TX-BUYER-A",
                "gross_amount": {"currency_code": "USD", "value": "42.00"},
            }
        ],
    }

    mock_paypal_read = MagicMock()
    mock_paypal_read.get_dispute = AsyncMock(return_value=parse_dispute(sample_snapshot))
    mock_paypal_read.close = AsyncMock()

    mutating_result = MutatingResult(status_code=200, debug_id="debug-test-123", data={})

    mock_paypal_mutating = MagicMock()
    mock_paypal_mutating.execute_action = AsyncMock(return_value=mutating_result)
    mock_paypal_mutating.close = AsyncMock()

    fake_settings = Settings(
        llm_provider="fake",
        paypal_env=PayPalEnv.stub,
        app_env=AppEnv.test,
    )
    llm_service = build_llm_service(fake_settings)

    registry = build_registry(
        read_client=mock_paypal_read,
        mutating_client=mock_paypal_mutating,
        llm_service=llm_service,
    )

    worker = Worker(
        session_factory=session_factory,
        registry=registry,
        poll_interval=0.01,
    )

    with session_factory() as session:
        enqueue_job(
            session=session,
            kind=JobKind.SYNC_DISPUTE,
            payload=SyncDisputePayload(
                dispute_id="PP-SCENARIO-A",
                event_id="WH-TEST-001",
                event_type="CUSTOMER.DISPUTE.CREATED",
            ),
        )

    # Run jobs through worker loop
    # 1. SYNC_DISPUTE runs, enqueues RUN_AGENT
    had_job = worker.run_once()
    assert had_job is True

    # 2. RUN_AGENT runs, plans with fake LLM, gate decides ALLOW, enqueues EXECUTE_DECISION
    had_job = worker.run_once()
    assert had_job is True

    # 3. One EXECUTE_DECISION job per ALLOW action (evidence + message), then the queue is empty
    assert worker.run_once() is True
    assert worker.run_once() is True
    assert worker.run_once() is False

    with session_factory() as session:
        events = session.execute(
            select(LedgerEvent)
            .where(LedgerEvent.dispute_id == "PP-SCENARIO-A")
            .order_by(LedgerEvent.sequence_number.asc())
        ).scalars().all()

        kinds = [e.event_kind for e in events]
        assert TimelineEventKind.DISPUTE_SYNCED.value in kinds
        assert TimelineEventKind.RUN_STARTED.value in kinds
        assert TimelineEventKind.GATE_DECIDED.value in kinds
        assert TimelineEventKind.EXECUTION_INTENDED.value in kinds
        assert TimelineEventKind.EXECUTION_CONFIRMED.value in kinds


def test_fake_scenario_provider():
    """Blocker 0.2: FakeScenarioProvider returns deterministic plans and supports fault injection."""
    settings_fake = Settings(
        llm_provider="fake",
        fake_llm_fail=False,
        app_env=AppEnv.test,
    )
    provider = build_provider(settings_fake)
    assert isinstance(provider, FakeScenarioProvider)

    # Prod check: LLM_PROVIDER=fake is strictly forbidden when APP_ENV=prod
    with pytest.raises(ValueError, match="strictly forbidden"):
        Settings(
            llm_provider="fake",
            app_env=AppEnv.prod,
            paypal_client_id="id",
            paypal_client_secret="sec",
            approval_token_secret="a" * 32,
        )

    # Fault check via setting
    failing_settings = Settings(
        llm_provider="fake",
        fake_llm_fail=True,
        app_env=AppEnv.test,
    )
    failing_provider = build_provider(failing_settings)
    with pytest.raises(ProviderError):
        asyncio.run(failing_provider.complete([{"role": "user", "content": "test prompt"}]))

    # Fault check via explicit buyer-message marker
    with pytest.raises(ProviderError):
        asyncio.run(provider.complete([{"role": "user", "content": "FAIL_LLM please fail"}]))

    # Scenario D/E are keyed by disputed amount, not by stub dispute id
    for amount, expected in (("64.00", "D"), ("55.00", "E")):
        response = asyncio.run(
            provider.complete([{"role": "user", "content": f"Disputed Amount: {amount} USD"}])
        )
        assert json.loads(response.content) == json.loads(SCENARIO_PLANS[expected])


def test_approval_links_test_seam(test_db):
    """Blocker 0.3: Raw approval token recorded and exposed via GET /__test__/approval-links."""
    clear_test_approval_outbox()
    _, session_factory = test_db

    settings = Settings(
        paypal_env=PayPalEnv.stub,
        app_env=AppEnv.test,
        llm_provider="fake",
    )
    app = create_app(settings)
    client = TestClient(app)

    with session_factory() as session:
        dec = Decision(
            dispute_id="PP-APPROVAL-TEST",
            action_type=ActionType.MAKE_OFFER.value,
            action_payload={"amount": {"currency_code": "USD", "value": "180.00"}},
            verdict=Verdict.NEEDS_APPROVAL.value,
            rule_id="G3-01",
            reason="Exceeds limit",
            action_hash="hash123",
            dispute_fingerprint="fp123",
            charter_version=1,
        )
        session.add(dec)
        session.flush()

        sample_dispute = MagicMock()
        sample_dispute.seller_response_due_date = None

        approval, raw_token = create_approval(session, dec, sample_dispute, settings=settings)
        session.commit()

    # Query the test seam
    resp = client.get("/__test__/approval-links?dispute_id=PP-APPROVAL-TEST")
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"] == raw_token
    assert data["url"] == f"/approve/{raw_token}"
    assert len(data["links"]) >= 1

    # Cleanup
    clear_test_approval_outbox()
