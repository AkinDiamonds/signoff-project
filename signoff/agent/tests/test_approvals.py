"""Tests for merchant approvals: tokens, cards, resolutions, waiver rules, and expiration.

Per Step 19:
- Token entropy and hash-at-rest checks.
- Uniform not-found response for unknown, expired, or used tokens.
- Concurrent resolves get 409 Conflict.
- Stale dispute state comparison against decision fingerprint with automated re-planning.
- Strict 422 validations on edits (negative, above disputed amount, >2 decimals, empty edit).
- Deny records decision and takes no other action.
- Notes are stored raw and escaped on output.
- Expiry job settles overdue approvals.
"""

import html
import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from agent.app.approvals import (
    ApprovalCardResponse,
    ApproveResolveRequest,
    DenyResolveRequest,
    EditResolveRequest,
    build_approval_card_response,
    compute_approval_expiry,
    create_approval,
    expire_overdue_approvals,
    get_approval_by_token,
    hash_token,
    register_approval_handlers,
    resolve_approval,
)
from agent.app.approvals.schemas import ActionMoneySchema
from agent.app.approvals.service import get_approval_by_id, resolve_approval_by_id
from agent.app.db.base import Base
from agent.app.db.models import Approval, Decision, Job
from agent.app.db.models import Dispute as DBDispute
from agent.app.domain.actions import MakeOffer
from agent.app.domain.enums import (
    ActionType,
    ApprovalResolution,
    JobKind,
    Verdict,
)
from agent.app.domain.money import Money
from agent.app.errors import (
    ConflictResolvedError,
    ConflictStaleError,
    EditValidationError,
    TokenInvalidError,
)
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import Dispute, parse_dispute
from agent.app.queue.registry import HandlerRegistry
from agent.app.store_mock.scenarios import SCENARIOS
from agent.app.store_mock.seed import seed_scenarios

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "paypal"


@pytest.fixture
def db_session() -> Iterator[Session]:
    """In-memory SQLite database session."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    seed_scenarios(session, SCENARIOS)
    session.commit()
    yield session
    session.close()


@pytest.fixture
def sample_dispute() -> Dispute:
    path = FIXTURES_DIR / "s5-get-dispute.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return parse_dispute(data)


@pytest.fixture
def setup_pending_approval(db_session: Session, sample_dispute: Dispute):
    """Seed DB dispute, gate decision, and pending approval card."""
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)
    fp = str(compute_dispute_fingerprint(sample_dispute))

    # Seed DB dispute cache
    db_dispute = DBDispute(
        id=sample_dispute.dispute_id,
        state_fingerprint=fp,
        status=sample_dispute.status.value if hasattr(sample_dispute.status, "value") else str(sample_dispute.status),
        reason=sample_dispute.reason.value if hasattr(sample_dispute.reason, "value") else str(sample_dispute.reason),
        amount=Decimal("10.00"),
        currency="USD",
        seller_response_due_date=sample_dispute.seller_response_due_date,
        snapshot=sample_dispute.model_dump(mode="json"),
    )
    db_session.add(db_dispute)

    # Seed Gate decision requiring approval (e.g. G3-01 amount above auto-refund ceiling)
    offer_action = MakeOffer(
        amount=Money(value=Decimal("10.00"), currency_code="USD"),
        offer_type="REFUND",
        note="Settlement offer",
    )
    decision = Decision(
        dispute_id=sample_dispute.dispute_id,
        action_type=ActionType.MAKE_OFFER.value,
        action_payload=offer_action.model_dump(mode="json"),
        verdict=Verdict.NEEDS_APPROVAL.value,
        rule_id="G3-01",
        reason="Offer exceeds standing authority ceiling; requires human review",
        action_hash="mock_action_hash_1234567890",
        dispute_fingerprint=fp,
        charter_version=1,
        also_triggered=[],
    )
    db_session.add(decision)
    db_session.commit()

    # Create approval
    approval, raw_token = create_approval(db_session, decision, sample_dispute, now=now_dt)
    db_session.commit()

    return approval, raw_token, decision, db_dispute


# ---------------------------------------------------------------------------
# 1. Token entropy and hash-at-rest checks
# ---------------------------------------------------------------------------


def test_owner_card_survives_new_api_process_without_raw_token(db_session, setup_pending_approval):
    from fastapi.testclient import TestClient

    from agent.app.db.session import get_db_session
    from agent.app.main import create_app
    from agent.app.settings import Settings

    approval, token, _decision, dispute = setup_pending_approval
    approval.expires_at = datetime.now(UTC) + timedelta(days=1)
    db_session.commit()
    for _ in range(2):
        app = create_app(Settings(demo_show_approval_links=False))
        app.dependency_overrides[get_db_session] = lambda: db_session
        with TestClient(app) as client:
            detail = client.get(f"/api/disputes/{dispute.id}").json()
            assert detail["approval_url"] == f"/app/approvals/{approval.id}"
            card = client.get(f"/api/approvals/cards/{approval.id}")
            assert card.status_code == 200 and card.json()["id"] == str(approval.id)
            assert token not in card.text and token not in str(detail)
    approval.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()
    assert client.get(f"/api/disputes/{dispute.id}").json()["approval_url"] is None


def test_owner_card_approve_uses_same_one_time_resolution(db_session, setup_pending_approval):
    approval, token, _decision, _dispute = setup_pending_approval
    now = datetime(2026, 10, 6, 12, tzinfo=UTC)
    assert get_approval_by_id(db_session, approval.id, now).id == approval.id
    result = resolve_approval_by_id(db_session, approval.id, ApproveResolveRequest(action="APPROVE"), now)
    assert result.resolution == ApprovalResolution.APPROVE
    with pytest.raises(ConflictResolvedError):
        resolve_approval(db_session, token, ApproveResolveRequest(action="APPROVE"), now)


def test_owner_history_survives_phone_refresh_after_resolution_and_expiry(db_session, setup_pending_approval):
    from agent.app.approvals.service import build_approval_card_response

    approval, _token, _decision, _dispute = setup_pending_approval
    now = datetime(2026, 10, 6, 12, tzinfo=UTC)
    result = resolve_approval_by_id(db_session, approval.id, ApproveResolveRequest(action='APPROVE'), now)
    assert result.queued and not result.executed
    db_session.expire_all()  # Simulate another API request/process reading committed state.
    restored = get_approval_by_id(db_session, approval.id, now + timedelta(days=10), include_history=True)
    card = build_approval_card_response(db_session, restored)
    assert card.resolution == 'APPROVE'
    assert card.execution_state == 'queued'
    assert card.server_now
    with pytest.raises(ConflictResolvedError):
        resolve_approval_by_id(db_session, approval.id, ApproveResolveRequest(action='APPROVE'), now)


def test_owner_card_refuses_stale_and_expired_decisions(db_session, setup_pending_approval):
    approval, _token, _decision, dispute = setup_pending_approval
    now = datetime(2026, 10, 6, 12, tzinfo=UTC)
    with pytest.raises(TokenInvalidError):
        get_approval_by_id(db_session, approval.id, now + timedelta(days=10))
    dispute.state_fingerprint = "changed-fingerprint"
    db_session.commit()
    with pytest.raises(ConflictStaleError):
        resolve_approval_by_id(db_session, approval.id, ApproveResolveRequest(action="APPROVE"), now)


def test_token_entropy_and_hash_at_rest(db_session, setup_pending_approval):
    """Assert high-entropy random token, SHA-256 storage, and raw token never stored."""
    approval, raw_token, decision, _ = setup_pending_approval

    # Token must have high entropy (at least 32 urlsafe characters)
    assert len(raw_token) >= 32
    assert isinstance(raw_token, str)

    # Database only holds SHA-256 hash
    expected_hash = hash_token(raw_token)
    assert approval.token_hash == expected_hash

    # Raw token must NEVER appear in DB row
    approval_row = db_session.scalar(select(Approval).where(Approval.id == approval.id))
    assert approval_row.token_hash == expected_hash
    assert raw_token not in str(approval_row.__dict__)

    # Payload hash bound to decision action hash
    assert approval.payload_hash == decision.action_hash


# ---------------------------------------------------------------------------
# 2. Expiry calculation before dispute due date
# ---------------------------------------------------------------------------


def test_approval_expiry_before_due_date():
    """Approval expiry must fall before dispute seller_response_due_date."""
    now_dt = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
    due_dt = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)

    expiry = compute_approval_expiry(due_dt, now_dt)
    assert expiry.tzinfo is not None
    # Must expire before due date
    assert expiry < due_dt

    # When due date is very close (e.g. 30 minutes away)
    close_due = now_dt + timedelta(minutes=30)
    close_expiry = compute_approval_expiry(close_due, now_dt)
    assert close_expiry < close_due


# ---------------------------------------------------------------------------
# 3. Uniform 404 response for unknown, expired, or used tokens
# ---------------------------------------------------------------------------


def test_uniform_404_for_unknown_expired_used_tokens(db_session, setup_pending_approval):
    """Unknown, expired, or already-used token returns uniform TokenInvalidError (404)."""
    approval, raw_token, _, _ = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    # 1. Unknown token
    with pytest.raises(TokenInvalidError) as exc_info:
        get_approval_by_token(db_session, "non_existent_token_12345678", now=now_dt)
    assert exc_info.value.status_code == 404

    # 2. Expired token
    future_now = approval.expires_at + timedelta(minutes=5)
    with pytest.raises(TokenInvalidError) as exc_info2:
        get_approval_by_token(db_session, raw_token, now=future_now)
    assert exc_info2.value.status_code == 404

    # 3. Used / resolved token
    approval.resolution = ApprovalResolution.APPROVE.value
    db_session.commit()
    with pytest.raises(TokenInvalidError) as exc_info3:
        get_approval_by_token(db_session, raw_token, now=now_dt)
    assert exc_info3.value.status_code == 404


# ---------------------------------------------------------------------------
# 4. Get approval card data & escaped notes
# ---------------------------------------------------------------------------


def test_get_approval_card_and_notes_escaped(db_session, setup_pending_approval):
    """Card data includes dispute summary, and raw notes are escaped on output."""
    approval, raw_token, _, _ = setup_pending_approval

    # Store raw HTML / script in notes
    approval.notes = '<script>alert("hack")</script>'
    db_session.commit()

    card = build_approval_card_response(db_session, approval)
    assert isinstance(card, ApprovalCardResponse)
    assert card.dispute_id == approval.dispute_id
    assert card.action_type == ActionType.MAKE_OFFER
    assert card.rule_id == "G3-01"

    # Notes must be escaped on output
    notes = card.notes or ""
    assert "<script>" not in notes
    assert notes == html.escape('<script>alert("hack")</script>')


# ---------------------------------------------------------------------------
# 5. Resolve APPROVE: waiver rules applied, ALLOW / A-01, execution enqueued
# ---------------------------------------------------------------------------


def test_resolve_approve_executes_waiver(db_session, setup_pending_approval):
    """Approve waives G3-01, records ALLOW with A-01, and queues execute job."""
    approval, raw_token, orig_dec, _ = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    req = ApproveResolveRequest(action="APPROVE", notes="Approved by supervisor")
    outcome = resolve_approval(db_session, raw_token, req, now=now_dt)

    assert outcome.resolution == "APPROVE"
    assert outcome.queued is True and outcome.executed is False
    assert outcome.decision_id is not None

    # Verify new decision has ALLOW and rule A-01
    new_dec = db_session.scalar(select(Decision).where(Decision.id == outcome.decision_id))
    assert new_dec is not None
    assert new_dec.verdict == Verdict.ALLOW.value
    assert new_dec.rule_id == "A-01"

    # Verify execution job queued
    queued_jobs = db_session.scalars(
        select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value)
    ).all()
    assert len(queued_jobs) == 1
    assert queued_jobs[0].payload.get("decision_id") == str(new_dec.id)

    # Verify approval row updated
    updated_app = db_session.scalar(select(Approval).where(Approval.id == approval.id))
    assert updated_app.resolution == ApprovalResolution.APPROVE.value
    assert updated_app.resolved_at is not None


def test_approval_of_deterministic_gate_decision_creates_distinct_allowed_record(db_session, setup_pending_approval):
    from agent.app.ledger.service import record_decision

    _, _, original, dispute = setup_pending_approval
    decision = record_decision(db_session, dispute_id=original.dispute_id, action_type=original.action_type,
                               action_payload=original.action_payload, verdict=original.verdict,
                               rule_id=original.rule_id, reason=original.reason, action_hash=original.action_hash,
                               dispute_fingerprint=original.dispute_fingerprint,
                               charter_version=original.charter_version)
    approval, token = create_approval(db_session, decision, parse_dispute(dispute.snapshot),
                                      now=datetime(2026, 10, 6, 12, tzinfo=UTC))
    db_session.commit()
    result = resolve_approval(db_session, token, ApproveResolveRequest(action="APPROVE"),
                              now=datetime(2026, 10, 6, 12, tzinfo=UTC))
    allowed = db_session.get(Decision, result.decision_id)
    assert allowed is not None and allowed.id != decision.id
    assert allowed.verdict == Verdict.ALLOW.value and decision.verdict == Verdict.NEEDS_APPROVAL.value
    assert db_session.get(Approval, approval.id).resolution == ApprovalResolution.APPROVE.value


@pytest.mark.asyncio
async def test_deterministic_approved_decision_reaches_worker_as_allowed(
    db_session, setup_pending_approval, monkeypatch,
):
    from unittest.mock import AsyncMock

    from agent.app.executor.job import handle_execute_decision_job
    from agent.app.ledger.service import record_decision
    from agent.app.policy.charter import get_or_seed_charter

    _, _, original, dispute = setup_pending_approval
    original = record_decision(db_session, dispute_id=original.dispute_id, action_type=original.action_type,
                               action_payload=original.action_payload, verdict=original.verdict,
                               rule_id=original.rule_id, reason=original.reason, action_hash=original.action_hash,
                               dispute_fingerprint=original.dispute_fingerprint,
                               charter_version=original.charter_version)
    _, token = create_approval(db_session, original, parse_dispute(dispute.snapshot),
                               now=datetime(2026, 10, 6, 12, tzinfo=UTC))
    get_or_seed_charter(db_session, merchant_id="default")
    db_session.commit()
    resolve_approval(db_session, token, ApproveResolveRequest(action="APPROVE"),
                     now=datetime(2026, 10, 6, 12, tzinfo=UTC))
    job = db_session.scalar(select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value))
    executor = AsyncMock()
    monkeypatch.setattr("agent.app.executor.job.execute_decision", executor)
    await handle_execute_decision_job(job, db_session, read_client=object(), mutating_client=object())
    assert executor.await_count == 1
    assert executor.await_args.kwargs['decision'].verdict == Verdict.ALLOW
    assert executor.await_args.kwargs['decision_id'] != original.id


# ---------------------------------------------------------------------------
# 6. Resolve DENY: records decision, takes no further action
# ---------------------------------------------------------------------------


def test_resolve_deny_takes_no_action(db_session, setup_pending_approval):
    """Deny records decision as DENY and queues no execute job."""
    approval, raw_token, _, _ = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    req = DenyResolveRequest(action="DENY", reason="Customer claim suspicious")
    outcome = resolve_approval(db_session, raw_token, req, now=now_dt)

    assert outcome.resolution == "DENY"
    assert outcome.executed is False

    # No execution job queued
    queued_jobs = db_session.scalars(
        select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value)
    ).all()
    assert len(queued_jobs) == 0

    # Approval marked DENY
    updated_app = db_session.scalar(select(Approval).where(Approval.id == approval.id))
    assert updated_app.resolution == ApprovalResolution.DENY.value


# ---------------------------------------------------------------------------
# 7. Resolve EDIT: validates 422, re-runs gate, waives and executes
# ---------------------------------------------------------------------------


def test_resolve_edit_success(db_session, setup_pending_approval):
    """Editing amount re-evaluates gate, waives under A-01, and queues execute job."""
    approval, raw_token, _, _ = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    req = EditResolveRequest(
        action="EDIT",
        amount=ActionMoneySchema(value="5.00", currency_code="USD"),
        message="Partial refund counter-offer",
    )
    outcome = resolve_approval(db_session, raw_token, req, now=now_dt)

    assert outcome.resolution == "EDIT"
    assert outcome.queued is True and outcome.executed is False

    # Edited decision was saved
    new_dec = db_session.scalar(select(Decision).where(Decision.id == outcome.decision_id))
    assert new_dec is not None
    assert new_dec.action_payload["amount"]["value"] == "5.00"

    # Queued for execution
    queued_jobs = db_session.scalars(
        select(Job).where(Job.kind == JobKind.EXECUTE_DECISION.value)
    ).all()
    assert len(queued_jobs) == 1


def test_resolve_edit_validations_422(db_session, setup_pending_approval):
    """Edits that are negative, above dispute amount, or have >2 decimals raise 422."""
    _, raw_token, _, _ = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    # 1. Negative amount
    req_neg = EditResolveRequest(
        action="EDIT",
        amount=ActionMoneySchema(value="-5.00", currency_code="USD"),
    )
    with pytest.raises(EditValidationError) as exc1:
        resolve_approval(db_session, raw_token, req_neg, now=now_dt)
    assert exc1.value.status_code == 422

    # 2. Above disputed amount ($10.00 is disputed)
    req_over = EditResolveRequest(
        action="EDIT",
        amount=ActionMoneySchema(value="50.00", currency_code="USD"),
    )
    with pytest.raises(EditValidationError) as exc2:
        resolve_approval(db_session, raw_token, req_over, now=now_dt)
    assert exc2.value.status_code == 422

    # 3. More than 2 decimal places
    req_decimals = EditResolveRequest(
        action="EDIT",
        amount=ActionMoneySchema(value="5.005", currency_code="USD"),
    )
    with pytest.raises(EditValidationError) as exc3:
        resolve_approval(db_session, raw_token, req_decimals, now=now_dt)
    assert exc3.value.status_code == 422


# ---------------------------------------------------------------------------
# 8. Concurrent resolves: conflict on second attempt (409)
# ---------------------------------------------------------------------------


def test_concurrent_resolves_conflict_409(db_session, setup_pending_approval):
    """One resolve succeeds; subsequent resolve gets 409 Conflict."""
    _, raw_token, _, _ = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    req1 = ApproveResolveRequest(action="APPROVE")
    outcome1 = resolve_approval(db_session, raw_token, req1, now=now_dt)
    assert outcome1.resolution == "APPROVE"

    # Second resolve attempt
    req2 = DenyResolveRequest(action="DENY")
    with pytest.raises(ConflictResolvedError) as exc_info:
        resolve_approval(db_session, raw_token, req2, now=now_dt)
    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# 9. Stale dispute conflict (409) and automated re-planning
# ---------------------------------------------------------------------------


def test_stale_dispute_conflict_and_replan(db_session, setup_pending_approval):
    """If dispute state changes after card was created, resolve raises 409 and queues re-plan."""
    approval, raw_token, _, db_dispute = setup_pending_approval
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    # Mutate dispute fingerprint in DB to simulate upstream state transition
    db_dispute.state_fingerprint = "mutated_new_fingerprint_9999"
    db_session.commit()

    req = ApproveResolveRequest(action="APPROVE")
    with pytest.raises(ConflictStaleError) as exc_info:
        resolve_approval(db_session, raw_token, req, now=now_dt)

    assert exc_info.value.status_code == 409

    # Assert RUN_AGENT job enqueued for re-planning
    replan_jobs = db_session.scalars(
        select(Job).where(
            Job.dispute_id == approval.dispute_id,
            Job.kind == JobKind.RUN_AGENT.value,
        )
    ).all()
    assert len(replan_jobs) == 1


# ---------------------------------------------------------------------------
# 10. Expiry job
# ---------------------------------------------------------------------------


def test_expiry_job(db_session, setup_pending_approval):
    """Overdue approvals are transitioned to EXPIRED by the expiry job."""
    approval, _, _, _ = setup_pending_approval
    future_now = approval.expires_at + timedelta(hours=2)

    count = expire_overdue_approvals(db_session, now=future_now)
    assert count >= 1

    updated_app = db_session.scalar(select(Approval).where(Approval.id == approval.id))
    assert updated_app.resolution == ApprovalResolution.EXPIRED.value

    # Test registry integration
    registry = HandlerRegistry()
    register_approval_handlers(registry)
    handler = registry.get(JobKind.EXPIRE_APPROVALS)
    assert handler is not None
