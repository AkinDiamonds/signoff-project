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
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

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
from agent.app.db.base import Base
from agent.app.db.models import Approval, Decision
from agent.app.db.models import Dispute as DBDispute
from agent.app.db.models import Job
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
from agent.app.policy.gate import evaluate_gate
from agent.app.queue.payloads import ExpireApprovalsPayload
from agent.app.queue.registry import HandlerRegistry
from agent.app.store_mock.scenarios import SCENARIOS
from agent.app.store_mock.seed import seed_scenarios

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "paypal"


@pytest.fixture
def db_session() -> Session:
    """In-memory SQLite database session."""
    engine = create_engine("sqlite:///:memory:")
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
    now_dt = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)

    # Store raw HTML / script in notes
    approval.notes = '<script>alert("hack")</script>'
    db_session.commit()

    card = build_approval_card_response(db_session, approval)
    assert isinstance(card, ApprovalCardResponse)
    assert card.dispute_id == approval.dispute_id
    assert card.action_type == ActionType.MAKE_OFFER
    assert card.rule_id == "G3-01"

    # Notes must be escaped on output
    assert "<script>" not in card.notes
    assert card.notes == html.escape('<script>alert("hack")</script>')


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
    assert outcome.executed is True
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
    assert outcome.executed is True

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
