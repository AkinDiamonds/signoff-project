"""Merchant approval service: token issuance, card retrieval, resolution, and expiration.

Per Step 19:
- Random tokens stored only as SHA-256 hashes at rest.
- Bound to action_hash and expiring before dispute due time.
- Uniform not-found response for invalid, expired, or used tokens with distinct internal logging.
- Atomic concurrency handling (row lock + conflict on concurrent resolves).
- Stale dispute conflict with automated re-planning job enqueueing.
- Strict 422 validations on edits (positive, max 2 decimals, <= dispute amount).
- Waiver rules applied on approval (A-01 / ALLOW for waivable steps).
- Expiry job for scanning and settling overdue approvals.
- Raw notes stored and escaped on output.
"""

import hashlib
import html
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.approvals.schemas import (
    ApprovalCardResponse,
    ApproveResolveRequest,
    DenyResolveRequest,
    DisputeCardSummary,
    EditResolveRequest,
    ResolveRequest,
    ResolveResponse,
)
from agent.app.db.models import Approval, Decision
from agent.app.db.models import Dispute as DBDispute
from agent.app.domain.actions import MakeOffer, SendMessage
from agent.app.domain.enums import (
    ActionType,
    ApprovalResolution,
    JobKind,
    TimelineEventKind,
    Verdict,
)
from agent.app.domain.money import Money
from agent.app.errors import (
    ConflictResolvedError,
    ConflictStaleError,
    EditValidationError,
    TokenInvalidError,
)
from agent.app.ledger.service import record_decision, record_ledger_event
from agent.app.paypal.models import parse_dispute
from agent.app.policy.approval import is_waivable, waive_with_approval
from agent.app.policy.charter import get_or_seed_charter, to_charter_response
from agent.app.policy.gate import GateInput, HistoryFlags, evaluate_gate, reconstruct_decision
from agent.app.queue.payloads import ExecuteDecisionPayload, RunAgentPayload
from agent.app.queue.queue import enqueue_job

logger = logging.getLogger(__name__)

DEFAULT_APPROVAL_TTL = timedelta(days=3)
MIN_EXPIRY_MARGIN = timedelta(hours=1)


def _as_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware UTC, even if loaded as naive from SQLite."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def hash_token(raw_token: str) -> str:
    """Compute SHA-256 hash of raw approval token for storage and lookup."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


def compute_approval_expiry(
    seller_due_date: datetime | None,
    now: datetime,
) -> datetime:
    """Calculate approval expiry ensuring it expires before dispute response deadline."""
    default_expiry = now + DEFAULT_APPROVAL_TTL

    if seller_due_date is None:
        return default_expiry

    due_utc = seller_due_date.replace(tzinfo=UTC) if seller_due_date.tzinfo is None else seller_due_date.astimezone(UTC)

    if due_utc <= now:
        # If due date already passed or right now, expire immediately
        return now

    # Ensure it expires at least MIN_EXPIRY_MARGIN before the dispute due date
    margin_expiry = due_utc - MIN_EXPIRY_MARGIN
    if margin_expiry <= now:
        # If due date is within the margin, set halfway between now and due date
        remaining = (due_utc - now) / 2
        return now + remaining

    return min(default_expiry, margin_expiry)


def create_approval(
    session: Session,
    decision: Decision,
    dispute: Any,
    now: datetime | None = None,
) -> tuple[Approval, str]:
    """Generate a high-entropy random token, store its hash, and persist the approval card."""
    now_dt = now or datetime.now(UTC)
    raw_token = secrets.token_urlsafe(32)
    token_hash_val = hash_token(raw_token)

    due_date = getattr(dispute, "seller_response_due_date", None)
    expires_at = compute_approval_expiry(due_date, now_dt)

    approval = Approval(
        id=uuid.uuid4(),
        decision_id=decision.id,
        dispute_id=decision.dispute_id,
        token_hash=token_hash_val,
        payload_hash=decision.action_hash,
        expires_at=expires_at,
        resolution=ApprovalResolution.PENDING.value,
        notes=None,
        created_at=now_dt,
    )
    session.add(approval)
    session.flush()

    record_ledger_event(
        session,
        decision.dispute_id,
        TimelineEventKind.APPROVAL_REQUESTED,
        {
            "approval_id": str(approval.id),
            "decision_id": str(decision.id),
            "token_hash": token_hash_val,
            "expires_at": expires_at.isoformat(),
            "rule_id": decision.rule_id,
        },
    )

    return approval, raw_token


def get_approval_by_token(
    session: Session,
    raw_token: str,
    now: datetime | None = None,
) -> Approval:
    """Retrieve an approval by raw token with uniform 404 response for invalid/expired/used tokens."""
    now_dt = now or datetime.now(UTC)
    token_hash_val = hash_token(raw_token)

    stmt = select(Approval).where(Approval.token_hash == token_hash_val)
    approval = session.scalar(stmt)

    if approval is None:
        logger.warning("Approval lookup failed: internal_reason=token_not_found (hash=%s)", token_hash_val[:8])
        raise TokenInvalidError()

    if _as_utc(approval.expires_at) <= now_dt:
        logger.warning(
            "Approval lookup failed: internal_reason=token_expired (id=%s, expires_at=%s, now=%s)",
            approval.id,
            approval.expires_at,
            now_dt,
        )
        raise TokenInvalidError()

    if approval.resolution != ApprovalResolution.PENDING.value:
        logger.warning(
            "Approval lookup failed: internal_reason=token_used (id=%s, resolution=%s)",
            approval.id,
            approval.resolution,
        )
        raise TokenInvalidError()

    return approval


def build_approval_card_response(
    session: Session,
    approval: Approval,
) -> ApprovalCardResponse:
    """Build response DTO for GET /api/approvals/{token} with raw notes escaped on output."""
    decision = session.scalar(select(Decision).where(Decision.id == approval.decision_id))
    if decision is None:
        raise TokenInvalidError("Underlying decision for approval card not found")

    db_dispute = session.scalar(select(DBDispute).where(DBDispute.id == approval.dispute_id))

    dispute_reason = db_dispute.reason if db_dispute else "UNKNOWN"
    dispute_status = db_dispute.status if db_dispute else "UNKNOWN"
    dispute_amount_val = str(db_dispute.amount) if db_dispute else "0.00"
    dispute_currency = db_dispute.currency if db_dispute else "USD"
    seller_due = (
        db_dispute.seller_response_due_date.isoformat()
        if (db_dispute and db_dispute.seller_response_due_date)
        else None
    )

    buyer_msg: str | None = None
    if db_dispute and db_dispute.snapshot:
        msgs = db_dispute.snapshot.get("messages") or []
        if msgs and isinstance(msgs[0], dict):
            buyer_msg = msgs[0].get("content")

    # Escape notes on output
    escaped_notes = html.escape(approval.notes) if approval.notes else None

    return ApprovalCardResponse(
        id=str(approval.id),
        decision_id=str(decision.id),
        dispute_id=approval.dispute_id,
        token_hash=approval.token_hash,
        payload_hash=approval.payload_hash,
        action_type=ActionType(decision.action_type),
        action_payload=decision.action_payload or {},
        verdict=Verdict(decision.verdict),
        rule_id=decision.rule_id,
        reason=decision.reason,
        expires_at=approval.expires_at.isoformat(),
        resolution=ApprovalResolution(approval.resolution),
        notes=escaped_notes,
        dispute=DisputeCardSummary(
            id=approval.dispute_id,
            amount={"value": dispute_amount_val, "currency_code": dispute_currency},
            reason=dispute_reason,
            status=dispute_status,
            seller_response_due_date=seller_due,
            buyer_message=buyer_msg,
        ),
        created_at=approval.created_at.isoformat(),
        resolved_at=approval.resolved_at.isoformat() if approval.resolved_at else None,
    )


def resolve_approval(
    session: Session,
    raw_token: str,
    request: ResolveRequest,
    now: datetime | None = None,
) -> ResolveResponse:
    """Resolve an approval card with approve, deny, or edit.

    Enforces:
    - Atomicity & concurrency conflict via row lock (with_for_update).
    - Stale dispute state comparison against decision fingerprint.
    - Edits re-evaluated by pure gate and validated (422 on negative/over-dispute/too many decimals).
    - Approve applies waiver rules (A-01 ALLOW) and enqueues execute job.
    - Deny records decision and stops.
    """
    now_dt = now or datetime.now(UTC)
    token_hash_val = hash_token(raw_token)

    # 1. Lock the approval row to serialize concurrent resolves
    stmt = select(Approval).where(Approval.token_hash == token_hash_val).with_for_update()
    approval = session.scalar(stmt)

    if approval is None:
        logger.warning("Approval resolve failed: token_not_found (hash=%s)", token_hash_val[:8])
        raise TokenInvalidError()

    if _as_utc(approval.expires_at) <= now_dt:
        logger.warning("Approval resolve failed: token_expired (id=%s)", approval.id)
        raise TokenInvalidError()

    if approval.resolution != ApprovalResolution.PENDING.value:
        logger.warning(
            "Approval resolve conflict: already resolved (id=%s, resolution=%s)",
            approval.id,
            approval.resolution,
        )
        raise ConflictResolvedError("Approval has already been resolved")

    # 2. Fetch original decision and local dispute
    decision = session.scalar(select(Decision).where(Decision.id == approval.decision_id))
    if decision is None:
        raise TokenInvalidError("Underlying decision for approval card not found")

    db_dispute = session.scalar(select(DBDispute).where(DBDispute.id == approval.dispute_id))

    # 3. Check for stale dispute state
    if db_dispute is not None and db_dispute.state_fingerprint != decision.dispute_fingerprint:
        logger.warning(
            "Dispute %s state changed since approval was created (decision_fp=%s, current_fp=%s). Enqueueing re-plan.",
            approval.dispute_id,
            decision.dispute_fingerprint[:8],
            db_dispute.state_fingerprint[:8],
        )
        enqueue_job(
            session=session,
            kind=JobKind.RUN_AGENT,
            payload=RunAgentPayload(
                dispute_id=approval.dispute_id,
                fingerprint=db_dispute.state_fingerprint,
            ),
        )
        raise ConflictStaleError(
            "Dispute state has changed since this approval card was created. Re-planning enqueued."
        )

    raw_notes = getattr(request, "notes", None) or getattr(request, "reason", None)

    # 4. Handle resolution based on action
    if isinstance(request, DenyResolveRequest) or request.action == "DENY":
        approval.resolution = ApprovalResolution.DENY.value
        approval.resolved_at = now_dt
        approval.notes = raw_notes

        deny_reason = f"Merchant denied approval: {request.reason or raw_notes or 'Denied by merchant'}"
        record_decision(
            session=session,
            dispute_id=approval.dispute_id,
            action_type=ActionType(decision.action_type),
            action_payload=decision.action_payload,
            verdict=Verdict.DENY,
            rule_id="A-01",
            reason=deny_reason,
            action_hash=decision.action_hash,
            dispute_fingerprint=decision.dispute_fingerprint,
            charter_version=decision.charter_version,
            also_triggered=[decision.rule_id],
        )

        record_ledger_event(
            session,
            approval.dispute_id,
            TimelineEventKind.APPROVAL_RESOLVED,
            {
                "approval_id": str(approval.id),
                "resolution": "DENY",
                "notes": raw_notes,
            },
        )
        session.commit()

        return ResolveResponse(
            resolution="DENY",
            approval_id=str(approval.id),
            dispute_id=approval.dispute_id,
            executed=False,
        )

    if isinstance(request, ApproveResolveRequest) or request.action == "APPROVE":
        # Reconstruct original GateDecision to evaluate waiver rules
        gate_dec = reconstruct_decision(
            verdict=Verdict(decision.verdict),
            rule_id=decision.rule_id,
            reason=decision.reason,
            action_hash=decision.action_hash,
            dispute_fingerprint=decision.dispute_fingerprint,
            charter_version=decision.charter_version,
            also_triggered=tuple(decision.also_triggered or ()),
        )

        if not is_waivable(gate_dec):
            raise EditValidationError(
                "This decision cannot be waived by merchant approval (non-waivable rule triggered)"
            )

        waived_dec = waive_with_approval(gate_dec)
        if waived_dec is None:
            raise EditValidationError("Waiver refused for this decision")

        new_decision = record_decision(
            session=session,
            dispute_id=approval.dispute_id,
            action_type=ActionType(decision.action_type),
            action_payload=decision.action_payload,
            verdict=Verdict.ALLOW,
            rule_id="A-01",
            reason=waived_dec.reason,
            action_hash=decision.action_hash,
            dispute_fingerprint=decision.dispute_fingerprint,
            charter_version=decision.charter_version,
            also_triggered=waived_dec.also_triggered,
        )

        approval.resolution = ApprovalResolution.APPROVE.value
        approval.resolved_at = now_dt
        approval.notes = raw_notes

        record_ledger_event(
            session,
            approval.dispute_id,
            TimelineEventKind.APPROVAL_RESOLVED,
            {
                "approval_id": str(approval.id),
                "resolution": "APPROVE",
                "decision_id": str(new_decision.id),
            },
        )

        enqueue_job(
            session=session,
            kind=JobKind.EXECUTE_DECISION,
            payload=ExecuteDecisionPayload(decision_id=str(new_decision.id)),
        )
        session.commit()

        return ResolveResponse(
            resolution="APPROVE",
            approval_id=str(approval.id),
            dispute_id=approval.dispute_id,
            decision_id=str(new_decision.id),
            executed=True,
        )

    if isinstance(request, EditResolveRequest) or request.action == "EDIT":
        # Validate edit fields per Step 19
        if request.amount is not None:
            try:
                dec_val = Decimal(request.amount.value)
            except Exception as exc:
                raise EditValidationError(f"Invalid decimal value for amount: {request.amount.value}") from exc

            if dec_val <= Decimal("0.00"):
                raise EditValidationError("Edited amount must be strictly positive and non-negative")

            if dec_val.as_tuple().exponent < -2:
                raise EditValidationError("Edited amount has too many decimal places; maximum 2 allowed")

            if db_dispute is not None and dec_val > db_dispute.amount:
                raise EditValidationError(f"Edited amount {dec_val} exceeds disputed amount {db_dispute.amount}")

        # Construct edited domain action
        orig_payload = dict(decision.action_payload or {})
        orig_action_type = ActionType(decision.action_type)

        if orig_action_type == ActionType.MAKE_OFFER:
            new_amount = (
                Money(value=Decimal(request.amount.value), currency_code=request.amount.currency_code)
                if request.amount
                else Money(
                    value=Decimal(str(orig_payload["amount"]["value"])),
                    currency_code=orig_payload["amount"]["currency_code"],
                )
            )
            edited_action = MakeOffer(
                amount=new_amount,
                offer_type=orig_payload.get("offer_type", "REFUND"),
                note=request.message or orig_payload.get("note"),
            )
        elif orig_action_type == ActionType.SEND_MESSAGE:
            edited_action = SendMessage(
                message=request.message or orig_payload.get("message", ""),
            )
        else:
            raise EditValidationError(f"Editing action type '{orig_action_type}' is not supported")

        # Load charter and re-evaluate gate
        db_charter = get_or_seed_charter(session, merchant_id="default")
        charter_entity = to_charter_response(db_charter)

        paypal_model = parse_dispute(db_dispute.snapshot) if (db_dispute and db_dispute.snapshot) else None
        if paypal_model is None:
            raise EditValidationError("Dispute snapshot unavailable for re-gating")

        gate_in = GateInput(
            action=edited_action,
            dispute=paypal_model,
            charter=charter_entity,
            now=now_dt,
            history_flags=HistoryFlags(),
            prior_executions=(),
        )
        re_gated = evaluate_gate(gate_in)

        # Apply human merchant waiver if re-gated decision requires approval
        if re_gated.verdict == Verdict.ALLOW:
            verdict_to_save = Verdict.ALLOW
            rule_to_save = re_gated.rule_id
            reason_to_save = re_gated.reason
            also_triggered = re_gated.also_triggered
        elif re_gated.verdict == Verdict.NEEDS_APPROVAL and is_waivable(re_gated):
            waived = waive_with_approval(re_gated)
            verdict_to_save = Verdict.ALLOW
            rule_to_save = "A-01"
            reason_to_save = waived.reason if waived else "Approved edit waived"
            also_triggered = waived.also_triggered if waived else ()
        else:
            verdict_to_save = re_gated.verdict
            rule_to_save = re_gated.rule_id
            reason_to_save = re_gated.reason
            also_triggered = re_gated.also_triggered

        new_decision = record_decision(
            session=session,
            dispute_id=approval.dispute_id,
            action_type=orig_action_type,
            action_payload=edited_action.model_dump(mode="json"),
            verdict=verdict_to_save,
            rule_id=rule_to_save,
            reason=f"Edited action: {reason_to_save}",
            action_hash=re_gated.action_hash,
            dispute_fingerprint=re_gated.dispute_fingerprint,
            charter_version=re_gated.charter_version,
            also_triggered=list(also_triggered),
        )

        approval.resolution = ApprovalResolution.EDIT.value
        approval.edited_payload = edited_action.model_dump(mode="json")
        approval.resolved_at = now_dt
        approval.notes = raw_notes

        record_ledger_event(
            session,
            approval.dispute_id,
            TimelineEventKind.APPROVAL_RESOLVED,
            {
                "approval_id": str(approval.id),
                "resolution": "EDIT",
                "decision_id": str(new_decision.id),
            },
        )

        executed = verdict_to_save == Verdict.ALLOW
        if executed:
            enqueue_job(
                session=session,
                kind=JobKind.EXECUTE_DECISION,
                payload=ExecuteDecisionPayload(decision_id=str(new_decision.id)),
            )

        session.commit()

        return ResolveResponse(
            resolution="EDIT",
            approval_id=str(approval.id),
            dispute_id=approval.dispute_id,
            decision_id=str(new_decision.id),
            executed=executed,
        )

    raise EditValidationError(f"Unsupported resolve action: '{getattr(request, 'action', None)}'")


def expire_overdue_approvals(session: Session, now: datetime | None = None) -> int:
    """Scan and settle all overdue approvals to EXPIRED status."""
    now_dt = now or datetime.now(UTC)

    stmt = select(Approval).where(
        Approval.resolution == ApprovalResolution.PENDING.value,
        Approval.expires_at <= now_dt,
    ).with_for_update()

    overdue_approvals = session.scalars(stmt).all()
    count = 0

    for app_row in overdue_approvals:
        app_row.resolution = ApprovalResolution.EXPIRED.value
        app_row.resolved_at = now_dt
        record_ledger_event(
            session,
            app_row.dispute_id,
            TimelineEventKind.APPROVAL_RESOLVED,
            {
                "approval_id": str(app_row.id),
                "resolution": "EXPIRED",
                "message": "Approval card expired past deadline",
            },
        )
        count += 1

    session.flush()
    return count
