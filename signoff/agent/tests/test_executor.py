"""Tests for Write-Ahead Executor, Reconciler, and Crash Safety Protocol.

Validates Step 13 requirements:
- Rejection of raw actions and non-ALLOW gate decisions.
- Action hash verification.
- Dispute fingerprint freshness check; aborts with EXEC-STALE on mismatch or resolution.
- Duplicate submission safety: one call only (idempotent).
- Write-ahead state transitions: INTENDED -> SENT -> CONFIRMED.
- PayPal 4xx: marked FAILED with debug id, no retry.
- Ambiguous 5xx / timeout: remains SENT; never resent.
- Reconciler: settles stuck executions by re-fetching dispute, NEVER re-sending.
- Crash recovery matrix: recoverable state at every step.
- Ledger events recorded for all state transitions.
"""

import time
import uuid
from collections.abc import Generator
from typing import Any

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from agent.app.db.models import Base, Decision, Execution, LedgerEvent
from agent.app.domain.actions import (
    SendMessage,
    compute_action_hash,
)
from agent.app.domain.enums import ExecutionStatus, TimelineEventKind, Verdict
from agent.app.executor.executor import (
    ExecutionRejectedError,
    execute_decision,
)
from agent.app.executor.reconciler import (
    reconcile_stuck_executions,
)
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import Dispute as PayPalDisputeModel
from agent.app.paypal.mutating_client import PayPalMutatingClient
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.policy.gate import GateDecision, evaluate_gate


def make_test_auth(client: httpx.AsyncClient) -> PayPalAuth:
    auth = PayPalAuth(
        client_id="test_client_id",
        client_secret="test_client_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=client,
    )
    auth._access_token = "mock_token"
    auth._expires_at = time.time() + 3600.0
    return auth


def make_sample_paypal_dispute(
    dispute_id: str = "PP-D-12345",
    status: str = "WAITING_FOR_SELLER_RESPONSE",
    offer: dict[str, Any] | None = None,
    messages: list[dict[str, Any]] | None = None,
) -> PayPalDisputeModel:
    data = {
        "dispute_id": dispute_id,
        "create_time": "2026-10-06T12:00:00Z",
        "update_time": "2026-10-06T12:00:00Z",
        "status": status,
        "dispute_state": "REQUIRED_ACTION",
        "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "dispute_amount": {"currency_code": "USD", "value": "100.00"},
        "dispute_life_cycle_stage": "INQUIRY",
        "dispute_channel": "INTERNAL",
        "allowed_response_options": {
            "make_offer": {"offer_types": ["REFUND"]},
            "accept_claim": {"accept_claim_types": ["REFUND"]},
        },
        "links": [
            {
                "href": f"https://api-m.sandbox.paypal.com/v1/customer/disputes/{dispute_id}",
                "rel": "self",
                "method": "GET",
            },
            {
                "href": f"https://api-m.sandbox.paypal.com/v1/customer/disputes/{dispute_id}/make-offer",
                "rel": "make_offer",
                "method": "POST",
            },
            {
                "href": f"https://api-m.sandbox.paypal.com/v1/customer/disputes/{dispute_id}/provide-evidence",
                "rel": "provide_evidence",
                "method": "POST",
            },
            {
                "href": f"https://api-m.sandbox.paypal.com/v1/customer/disputes/{dispute_id}/send-message",
                "rel": "send_message",
                "method": "POST",
            },
        ],
    }
    if offer:
        data["offer"] = offer
    if messages:
        data["messages"] = messages
    return PayPalDisputeModel.model_validate(data)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


from datetime import UTC, datetime

from agent.app.policy.gate import GateInput


def make_gate_allow_decision(action: Any, dispute: PayPalDisputeModel) -> GateDecision:
    """Helper to produce a valid GateDecision(ALLOW) using pure evaluate_gate."""
    decision = evaluate_gate(
        GateInput(
            action=action,
            dispute=dispute,
            charter=None,
            now=datetime(2026, 10, 6, 12, 1, tzinfo=UTC),
        )
    )
    assert decision.verdict == Verdict.ALLOW
    return decision


@pytest.mark.asyncio
async def test_executor_rejects_raw_action(db_session: Session):
    action = SendMessage(message="Hello")
    dummy_client: Any = None

    with pytest.raises(ExecutionRejectedError, match="Executor rejects raw actions"):
        await execute_decision(
            session=db_session,
            decision=action,  # type: ignore (testing runtime type safety)
            action=action,
            dispute_id="PP-D-123",
            read_client=dummy_client,
            mutating_client=dummy_client,
        )


@pytest.mark.asyncio
async def test_executor_rejects_action_hash_mismatch(db_session: Session):
    action1 = SendMessage(message="Action 1")
    action2 = SendMessage(message="Action 2")
    sample_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action1, sample_dispute)

    dummy_client: Any = None

    with pytest.raises(ExecutionRejectedError, match="Action hash mismatch"):
        await execute_decision(
            session=db_session,
            decision=decision,
            action=action2,  # mismatched action!
            dispute_id="PP-D-12345",
            read_client=dummy_client,
            mutating_client=dummy_client,
        )


@pytest.mark.asyncio
async def test_executor_aborts_stale_dispute_resolved(db_session: Session):
    action = SendMessage(message="Resolving dispute")
    sample_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action, sample_dispute)

    resolved_dispute = make_sample_paypal_dispute(status="RESOLVED")

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=resolved_dispute.model_dump(mode="json"))

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )

        assert result.status == ExecutionStatus.FAILED
        assert "EXEC-STALE" in (result.error or "")


@pytest.mark.asyncio
async def test_executor_aborts_stale_fingerprint_mismatch(db_session: Session):
    action = SendMessage(message="Resolving dispute")
    sample_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action, sample_dispute)

    # Fresh dispute has different disputed amount -> different fingerprint
    modified_data = sample_dispute.model_dump(mode="json")
    modified_data["dispute_amount"] = {"currency_code": "USD", "value": "250.00"}

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=modified_data)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )

        assert result.status == ExecutionStatus.FAILED
        assert "EXEC-STALE" in (result.error or "")


@pytest.mark.asyncio
async def test_executor_normal_path_success(db_session: Session):
    action = SendMessage(message="Settle dispute message")
    initial_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action, initial_dispute)

    call_counts = {"get": 0, "post": 0}

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            call_counts["get"] += 1
            if call_counts["get"] == 1:
                # Pre-execution freshness check
                return httpx.Response(200, json=initial_dispute.model_dump(mode="json"))
            # Post-execution confirmation re-fetch
            confirmed = make_sample_paypal_dispute(status="WAITING_FOR_BUYER_RESPONSE")
            return httpx.Response(200, json=confirmed.model_dump(mode="json"))

        if request.method == "POST":
            call_counts["post"] += 1
            assert request.url.path == "/v1/customer/disputes/PP-D-12345/send-message"
            return httpx.Response(
                200,
                json={"status": "MESSAGE_SENT"},
                headers={"Paypal-Debug-Id": "dbg-exec-100"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )

        assert result.status == ExecutionStatus.CONFIRMED
        assert result.http_status == 200
        assert result.paypal_debug_id == "dbg-exec-100"
        assert result.confirmed_snapshot is not None
        assert call_counts["post"] == 1

        # Verify DB execution row
        exec_row = db_session.execute(
            select(Execution).where(Execution.dispute_id == "PP-D-12345")
        ).scalar_one()
        assert exec_row.status == ExecutionStatus.CONFIRMED.value
        assert exec_row.paypal_debug_id == "dbg-exec-100"

        # Verify ledger events recorded in order
        ledger_events = db_session.execute(
            select(LedgerEvent)
            .where(LedgerEvent.dispute_id == "PP-D-12345")
            .order_by(LedgerEvent.sequence_number.asc())
        ).scalars().all()

        kinds = [ev.event_kind for ev in ledger_events]
        assert kinds == [
            TimelineEventKind.EXECUTION_INTENDED.value,
            TimelineEventKind.EXECUTION_SENT.value,
            TimelineEventKind.EXECUTION_CONFIRMED.value,
        ]


@pytest.mark.asyncio
async def test_executor_duplicate_submission_one_call_only(db_session: Session):
    action = SendMessage(message="Hello buyer")
    sample_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action, sample_dispute)

    post_count = 0

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal post_count
        if request.method == "GET":
            return httpx.Response(200, json=sample_dispute.model_dump(mode="json"))
        if request.method == "POST":
            post_count += 1
            return httpx.Response(200, json={"status": "SENT"}, headers={"Paypal-Debug-Id": "dbg-dup-1"})
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        # First submission
        res1 = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )
        assert res1.status == ExecutionStatus.CONFIRMED
        assert post_count == 1

        # Second submission of identical decision
        res2 = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )
        # One call only; post_count remains 1!
        assert post_count == 1
        assert res2.status == ExecutionStatus.CONFIRMED
        assert res2.execution_id == res1.execution_id


@pytest.mark.asyncio
async def test_executor_paypal_4xx_marks_failed_with_debug_id(db_session: Session):
    action = SendMessage(message="Message that triggers 400")
    sample_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action, sample_dispute)

    call_count = 0

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        if request.method == "GET":
            return httpx.Response(200, json=sample_dispute.model_dump(mode="json"))
        if request.method == "POST":
            call_count += 1
            return httpx.Response(
                400,
                json={"name": "VALIDATION_ERROR", "message": "Invalid message content"},
                headers={"Paypal-Debug-Id": "dbg-err-400-exec"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )

        assert result.status == ExecutionStatus.FAILED
        assert result.http_status == 400
        assert result.paypal_debug_id == "dbg-err-400-exec"
        assert call_count == 1

        exec_row = db_session.execute(
            select(Execution).where(Execution.dispute_id == "PP-D-12345")
        ).scalar_one()
        assert exec_row.status == ExecutionStatus.FAILED.value
        assert exec_row.paypal_debug_id == "dbg-err-400-exec"

        ledger_events = db_session.execute(
            select(LedgerEvent)
            .where(LedgerEvent.dispute_id == "PP-D-12345")
            .order_by(LedgerEvent.sequence_number.asc())
        ).scalars().all()
        kinds = [ev.event_kind for ev in ledger_events]
        assert kinds == [TimelineEventKind.EXECUTION_INTENDED.value, TimelineEventKind.EXECUTION_FAILED.value]


@pytest.mark.asyncio
async def test_executor_timeout_leaves_sent_for_reconciler(db_session: Session):
    action = SendMessage(message="Message that times out")
    sample_dispute = make_sample_paypal_dispute()
    decision = make_gate_allow_decision(action, sample_dispute)

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json=sample_dispute.model_dump(mode="json"))
        if request.method == "POST":
            # Simulate network timeout
            raise httpx.ReadTimeout("Connection timed out")
        return httpx.Response(404)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await execute_decision(
            session=db_session,
            decision=decision,
            action=action,
            dispute_id="PP-D-12345",
            read_client=read_client,
            mutating_client=mutating_client,
        )

        assert result.status == ExecutionStatus.SENT

        exec_row = db_session.execute(select(Execution).where(Execution.dispute_id == "PP-D-12345")).scalar_one()
        assert exec_row.status == ExecutionStatus.SENT.value

        # Now test Reconciler:
        # Case A: Dispute reflects change -> Reconciler settles to CONFIRMED
        confirmed_dispute = make_sample_paypal_dispute(status="WAITING_FOR_BUYER_RESPONSE")

        async def recon_handler(req: httpx.Request) -> httpx.Response:
            assert req.method == "GET"
            return httpx.Response(200, json=confirmed_dispute.model_dump(mode="json"))

        recon_transport = httpx.MockTransport(recon_handler)
        async with httpx.AsyncClient(transport=recon_transport) as recon_client:
            recon_auth = make_test_auth(recon_client)
            recon_read_client = PayPalReadClient(auth=recon_auth, http_client=recon_client)

            outcomes = await reconcile_stuck_executions(
                session=db_session,
                read_client=recon_read_client,
            )
            assert len(outcomes) == 1
            assert outcomes[0].settled_status == ExecutionStatus.CONFIRMED.value

            db_session.refresh(exec_row)
            assert exec_row.status == ExecutionStatus.CONFIRMED.value


@pytest.mark.asyncio
async def test_reconciler_settles_unchanged_intended_to_failed(db_session: Session):
    # Simulate worker crash right after INTENDED record created
    sample_dispute = make_sample_paypal_dispute()
    action = SendMessage(message="Unsent message")
    action_hash = compute_action_hash(action)
    fingerprint = compute_dispute_fingerprint(sample_dispute)

    dec_id = uuid.uuid4()
    dec_row = Decision(
        id=dec_id,
        dispute_id="PP-D-CRASH",
        action_type="SEND_MESSAGE",
        action_payload=action.model_dump(),
        verdict=Verdict.ALLOW.value,
        rule_id="G0-00",
        reason="Allow",
        action_hash=action_hash,
        dispute_fingerprint=fingerprint,
        charter_version=1,
    )
    db_session.add(dec_row)
    exec_row = Execution(
        decision_id=dec_id,
        dispute_id="PP-D-CRASH",
        status=ExecutionStatus.INTENDED.value,
        request_hash=action_hash,
    )
    db_session.add(exec_row)
    db_session.commit()

    # Re-fetch shows dispute unchanged
    async def mock_handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=sample_dispute.model_dump(mode="json"))

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        read_client = PayPalReadClient(auth=auth, http_client=client)

        outcomes = await reconcile_stuck_executions(
            session=db_session,
            read_client=read_client,
        )
        assert len(outcomes) == 1
        assert outcomes[0].settled_status == ExecutionStatus.FAILED.value

        db_session.refresh(exec_row)
        assert exec_row.status == ExecutionStatus.FAILED.value

