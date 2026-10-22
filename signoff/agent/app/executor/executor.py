"""Write-ahead executor enforcing gate ALLOW decisions and crash safety.

Per plan/05-resilience.md and Step 13:
- Accepts ONLY an allowed GateDecision produced by the gate (or approval waiver).
- Type check: rejects raw actions or non-ALLOW decisions.
- Re-fetches dispute before any mutating call; aborts if fingerprint changed or dispute resolved (EXEC-STALE).
- In one DB transaction: inserts executions(decision_id UNIQUE, status=INTENDED).
- Unique violation / duplicate submission: one call only.
- Calls PayPal mutating client once.
- On success: marks SENT, re-fetches dispute to confirm state change, marks CONFIRMED.
- On ambiguous failure (timeout, 5xx): leaves SENT; reconciler decides by re-fetching.
- PayPal 4xx: marked FAILED with debug id, no retry.
- Writes ledger events for every state transition.
"""

import logging
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, Execution, LedgerEvent
from agent.app.db.models import Dispute as DBDispute
from agent.app.domain.actions import ProposedAction, compute_action_hash
from agent.app.domain.enums import DisputeStatus, ExecutionStatus, TimelineEventKind, Verdict
from agent.app.errors import AppError
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.mutating_client import (
    PayPalClientError,
    PayPalMutatingClient,
    PayPalTimeoutError,
    PayPalUpstreamError,
)
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.policy.gate import GateDecision

logger = logging.getLogger(__name__)


class ExecutionRejectedError(AppError):
    """Raised when the executor rejects an invalid or unauthorized decision/action."""

    def __init__(self, message: str) -> None:
        super().__init__(code="EXECUTION_REJECTED", message=message, status_code=400)


class ExecutionStaleError(AppError):
    """Raised when dispute fingerprint changed between gate evaluation and execution."""

    def __init__(self, message: str = "EXEC-STALE: Dispute state changed since decision") -> None:
        super().__init__(code="EXEC_STALE", message=message, status_code=409)


@dataclass(frozen=True, slots=True)
class ExecutionResult:
    """Outcome of an execution attempt."""

    status: ExecutionStatus
    dispute_id: str
    decision_id: uuid.UUID
    execution_id: uuid.UUID | None = None
    http_status: int | None = None
    paypal_debug_id: str | None = None
    error: str | None = None
    confirmed_snapshot: dict[str, Any] | None = None


def record_execution_ledger_event(
    session: Session,
    dispute_id: str,
    event_kind: TimelineEventKind,
    payload: dict[str, Any],
) -> LedgerEvent:
    """Append-only audit ledger writer with per-dispute sequential numbering."""
    stmt = select(func.coalesce(func.max(LedgerEvent.sequence_number), 0)).where(
        LedgerEvent.dispute_id == dispute_id
    )
    next_seq = (session.scalar(stmt) or 0) + 1
    event = LedgerEvent(
        dispute_id=dispute_id,
        sequence_number=next_seq,
        event_kind=event_kind.value,
        payload=payload,
    )
    session.add(event)
    return event


def ensure_decision_record(
    session: Session,
    decision: GateDecision,
    dispute_id: str,
    action: ProposedAction,
    decision_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Find existing or persist Decision record in database for foreign key constraint."""
    if decision_id is not None:
        existing = session.execute(select(Decision).where(Decision.id == decision_id)).scalar_one_or_none()
        if existing is not None:
            return existing.id

    action_type = action.action_type.value if hasattr(action.action_type, "value") else str(action.action_type)
    action_dict = action.model_dump(mode="json")

    # Generate a deterministic UUID if none provided
    dec_id = decision_id or uuid.uuid5(
        uuid.NAMESPACE_OID,
        f"{dispute_id}:{decision.action_hash}:{decision.dispute_fingerprint}",
    )

    existing_dec = session.execute(select(Decision).where(Decision.id == dec_id)).scalar_one_or_none()
    if existing_dec is not None:
        return existing_dec.id

    dec_row = Decision(
        id=dec_id,
        dispute_id=dispute_id,
        action_type=action_type,
        action_payload=action_dict,
        verdict=decision.verdict.value,
        rule_id=decision.rule_id,
        reason=decision.reason,
        also_triggered=list(decision.also_triggered),
        action_hash=decision.action_hash,
        dispute_fingerprint=decision.dispute_fingerprint,
        charter_version=decision.charter_version,
    )
    session.add(dec_row)
    session.flush()
    return dec_row.id


async def execute_decision(
    session: Session,
    decision: GateDecision,
    action: ProposedAction,
    dispute_id: str,
    *,
    read_client: PayPalReadClient,
    mutating_client: PayPalMutatingClient,
    decision_id: uuid.UUID | None = None,
    evidence_files: Sequence[tuple[str, bytes, str | None]] | None = None,
) -> ExecutionResult:
    """Execute a GateDecision(ALLOW) following the strict write-ahead protocol.

    Protocol steps (plan/05-resilience.md):
    1. Verify decision is a GateDecision with verdict=ALLOW and matching action_hash.
    2. Re-fetch dispute from PayPal; compare state_fingerprint and status.
       Mismatch or resolved dispute -> abort (EXEC-STALE).
    3. In DB transaction: insert executions(decision_id UNIQUE, status=INTENDED).
       Unique violation -> already handled, stop and return existing execution.
    4. Call PayPal mutating client once.
    5. On success: set SENT, re-fetch to confirm change, set CONFIRMED.
    6. On ambiguous failure (timeout, 5xx): leave SENT for reconciler.
    7. On PayPal 4xx: set FAILED with debug id, no retry.
    8. Ledger entry recorded for every transition.
    """
    # Step 1: Verification of decision type and verdict
    if not isinstance(decision, GateDecision):
        raise ExecutionRejectedError(
            f"Executor rejects raw actions or non-GateDecision input: {type(decision).__name__}"
        )

    if decision.verdict != Verdict.ALLOW:
        raise ExecutionRejectedError(
            f"Executor only executes ALLOW decisions; rejected verdict: {decision.verdict}"
        )

    action_hash = compute_action_hash(action)
    if action_hash != decision.action_hash:
        raise ExecutionRejectedError(
            f"Action hash mismatch: action produces '{action_hash}', decision has '{decision.action_hash}'"
        )

    clean_dispute_id = dispute_id.strip()

    # Step 2: Re-fetch dispute from PayPal and compare fingerprint
    fresh_dispute = await read_client.get_dispute(clean_dispute_id)
    fresh_fingerprint = compute_dispute_fingerprint(fresh_dispute)

    # Check if dispute was resolved or fingerprint changed since decision
    status_val = fresh_dispute.status.value if hasattr(fresh_dispute.status, "value") else str(fresh_dispute.status)
    action_type = action.action_type.value if hasattr(action.action_type, "value") else str(action.action_type)

    if action_type != "APPEAL" and status_val == DisputeStatus.RESOLVED.value:
        logger.warning(
            "Dispute %s resolved between gate and execution. Aborting with EXEC-STALE.",
            clean_dispute_id,
        )
        return ExecutionResult(
            status=ExecutionStatus.FAILED,
            dispute_id=clean_dispute_id,
            decision_id=decision_id or uuid.UUID(int=0),
            error="EXEC-STALE: Dispute resolved between gate evaluation and execution",
        )

    if fresh_fingerprint != decision.dispute_fingerprint:
        logger.warning(
            "Dispute %s fingerprint mismatch: fresh=%s, decision=%s. Aborting with EXEC-STALE.",
            clean_dispute_id,
            fresh_fingerprint,
            decision.dispute_fingerprint,
        )
        return ExecutionResult(
            status=ExecutionStatus.FAILED,
            dispute_id=clean_dispute_id,
            decision_id=decision_id or uuid.UUID(int=0),
            error="EXEC-STALE: Dispute state changed since decision",
        )

    # Step 3: Ensure decision record in DB and check for duplicate submission
    dec_uuid = ensure_decision_record(
        session=session,
        decision=decision,
        dispute_id=clean_dispute_id,
        action=action,
        decision_id=decision_id,
    )

    # Check if an execution already exists for this decision_id (one call only)
    existing_exec = session.execute(
        select(Execution).where(Execution.decision_id == dec_uuid)
    ).scalar_one_or_none()

    if existing_exec is not None:
        logger.info(
            "Duplicate submission for decision %s; returning existing execution %s (status=%s)",
            dec_uuid,
            existing_exec.id,
            existing_exec.status,
        )
        return ExecutionResult(
            status=ExecutionStatus(existing_exec.status),
            dispute_id=clean_dispute_id,
            decision_id=dec_uuid,
            execution_id=existing_exec.id,
            http_status=existing_exec.http_status,
            paypal_debug_id=existing_exec.paypal_debug_id,
            error=existing_exec.error_message,
            confirmed_snapshot=existing_exec.confirmed_snapshot,
        )

    # Insert INTENDED execution record and write ledger event
    execution = Execution(
        decision_id=dec_uuid,
        dispute_id=clean_dispute_id,
        status=ExecutionStatus.INTENDED.value,
        request_hash=decision.action_hash,
    )
    session.add(execution)
    session.flush()

    record_execution_ledger_event(
        session=session,
        dispute_id=clean_dispute_id,
        event_kind=TimelineEventKind.EXECUTION_INTENDED,
        payload={
            "execution_id": str(execution.id),
            "decision_id": str(dec_uuid),
            "action_type": action_type,
            "action_hash": decision.action_hash,
        },
    )
    session.commit()

    # Step 4: Call PayPal mutating client once
    try:
        mutating_resp = await mutating_client.execute_action(
            dispute_id=clean_dispute_id,
            action=action,
            evidence_files=evidence_files,
        )
    except PayPalClientError as client_err:
        # PayPal 4xx: failed with debug id, no retry
        execution.status = ExecutionStatus.FAILED.value
        execution.http_status = client_err.status_code
        execution.paypal_debug_id = client_err.debug_id
        execution.error_message = client_err.message

        record_execution_ledger_event(
            session=session,
            dispute_id=clean_dispute_id,
            event_kind=TimelineEventKind.EXECUTION_FAILED,
            payload={
                "execution_id": str(execution.id),
                "decision_id": str(dec_uuid),
                "http_status": client_err.status_code,
                "paypal_debug_id": client_err.debug_id,
                "error": client_err.message,
            },
        )
        session.commit()

        return ExecutionResult(
            status=ExecutionStatus.FAILED,
            dispute_id=clean_dispute_id,
            decision_id=dec_uuid,
            execution_id=execution.id,
            http_status=client_err.status_code,
            paypal_debug_id=client_err.debug_id,
            error=client_err.message,
        )

    except (PayPalTimeoutError, PayPalUpstreamError) as ambig_err:
        # Timeout or 5xx: stays SENT, resolved by re-fetch, never resent
        execution.status = ExecutionStatus.SENT.value
        execution.http_status = getattr(ambig_err, "status_code", None)
        execution.paypal_debug_id = getattr(ambig_err, "debug_id", None)
        execution.error_message = ambig_err.message

        record_execution_ledger_event(
            session=session,
            dispute_id=clean_dispute_id,
            event_kind=TimelineEventKind.EXECUTION_SENT,
            payload={
                "execution_id": str(execution.id),
                "decision_id": str(dec_uuid),
                "ambiguous_error": ambig_err.message,
                "status": "SENT_AMBIGUOUS",
            },
        )
        session.commit()

        return ExecutionResult(
            status=ExecutionStatus.SENT,
            dispute_id=clean_dispute_id,
            decision_id=dec_uuid,
            execution_id=execution.id,
            http_status=execution.http_status,
            paypal_debug_id=execution.paypal_debug_id,
            error=ambig_err.message,
        )

    # Step 5: On success, set SENT, then re-fetch dispute to confirm state change
    execution.status = ExecutionStatus.SENT.value
    execution.http_status = mutating_resp.status_code
    execution.paypal_debug_id = mutating_resp.debug_id

    record_execution_ledger_event(
        session=session,
        dispute_id=clean_dispute_id,
        event_kind=TimelineEventKind.EXECUTION_SENT,
        payload={
            "execution_id": str(execution.id),
            "decision_id": str(dec_uuid),
            "http_status": mutating_resp.status_code,
            "paypal_debug_id": mutating_resp.debug_id,
        },
    )
    session.commit()

    # Re-fetch dispute to confirm state change
    try:
        confirmed_dispute = await read_client.get_dispute(clean_dispute_id)
        confirmed_snapshot = confirmed_dispute.model_dump(mode="json")

        execution.status = ExecutionStatus.CONFIRMED.value
        execution.confirmed_snapshot = confirmed_snapshot

        # Keep the local projection in step with the confirmed state so the
        # reconciler does not treat our own mutation as an external change.
        db_dispute = session.get(DBDispute, clean_dispute_id)
        if db_dispute is not None:
            db_dispute.state_fingerprint = str(compute_dispute_fingerprint(confirmed_dispute))
            db_dispute.snapshot = confirmed_snapshot

        record_execution_ledger_event(
            session=session,
            dispute_id=clean_dispute_id,
            event_kind=TimelineEventKind.EXECUTION_CONFIRMED,
            payload={
                "execution_id": str(execution.id),
                "decision_id": str(dec_uuid),
                "confirmed_fingerprint": compute_dispute_fingerprint(confirmed_dispute),
            },
        )
        session.commit()

        return ExecutionResult(
            status=ExecutionStatus.CONFIRMED,
            dispute_id=clean_dispute_id,
            decision_id=dec_uuid,
            execution_id=execution.id,
            http_status=mutating_resp.status_code,
            paypal_debug_id=mutating_resp.debug_id,
            confirmed_snapshot=confirmed_snapshot,
        )

    except Exception as refetch_err:
        logger.warning(
            "Dispute %s re-fetch confirmation failed (%s); leaving execution %s as SENT for reconciler",
            clean_dispute_id,
            refetch_err,
            execution.id,
        )
        return ExecutionResult(
            status=ExecutionStatus.SENT,
            dispute_id=clean_dispute_id,
            decision_id=dec_uuid,
            execution_id=execution.id,
            http_status=mutating_resp.status_code,
            paypal_debug_id=mutating_resp.debug_id,
            error=f"Confirmation re-fetch pending: {refetch_err}",
        )
