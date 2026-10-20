"""Reconciler for executions stuck in INTENDED or SENT states.

Per plan/05-resilience.md and Step 13:
- Reconciles stuck executions by re-fetching dispute from PayPal (via read_client).
- NEVER re-sends or calls mutating endpoints during reconciliation.
- Settles rows to CONFIRMED or FAILED.
- Writes ledger event for every settled transition.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, Execution
from agent.app.domain.enums import DisputeStatus, ExecutionStatus, TimelineEventKind
from agent.app.executor.executor import record_execution_ledger_event
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import Dispute as PayPalDispute
from agent.app.paypal.read_client import PayPalReadClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ReconciliationOutcome:
    """Outcome of reconciling a single execution."""

    execution_id: str
    dispute_id: str
    previous_status: str
    settled_status: str
    reason: str


def has_action_reflected(
    action_type: str,
    original_fingerprint: str,
    fresh_dispute: PayPalDispute,
) -> bool:
    """Determine whether an action has been reflected on PayPal based on fresh dispute state."""
    fresh_fingerprint = compute_dispute_fingerprint(fresh_dispute)
    fresh_status = fresh_dispute.status.value if hasattr(fresh_dispute.status, "value") else str(fresh_dispute.status)

    # 1. Any fingerprint change indicates state transition on PayPal
    if fresh_fingerprint != original_fingerprint:
        return True

    # 2. Action-specific state reflection checks
    if action_type == "ACCEPT_CLAIM":
        return fresh_status == DisputeStatus.RESOLVED.value

    if action_type in ("ESCALATE", "APPEAL"):
        return fresh_status == DisputeStatus.UNDER_REVIEW.value

    if action_type == "MAKE_OFFER":
        return (
            fresh_status == DisputeStatus.WAITING_FOR_BUYER_RESPONSE.value
            or fresh_dispute.offer is not None
        )

    if action_type == "PROVIDE_EVIDENCE":
        # Check if status moved or provide_evidence link consumed
        if fresh_status in (
            DisputeStatus.UNDER_REVIEW.value,
            DisputeStatus.WAITING_FOR_BUYER_RESPONSE.value,
            DisputeStatus.RESOLVED.value,
        ):
            return True
        link_rels = {link.rel.lower() for link in fresh_dispute.links if link.rel}
        if not ({"provide_evidence", "provide-evidence"} & link_rels):
            return True

    return action_type == "SEND_MESSAGE" and bool(fresh_dispute.messages)


async def reconcile_single_execution(
    session: Session,
    execution: Execution,
    read_client: PayPalReadClient,
    *,
    settle_unchanged_after_seconds: float = 300.0,
) -> ReconciliationOutcome:
    """Reconcile an execution stuck in INTENDED or SENT by re-fetching dispute. NEVER re-sends."""
    if execution.status not in (ExecutionStatus.INTENDED.value, ExecutionStatus.SENT.value):
        return ReconciliationOutcome(
            execution_id=str(execution.id),
            dispute_id=execution.dispute_id,
            previous_status=execution.status,
            settled_status=execution.status,
            reason="Execution already settled",
        )

    prev_status = execution.status
    decision = session.execute(
        select(Decision).where(Decision.id == execution.decision_id)
    ).scalar_one_or_none()

    orig_fingerprint = decision.dispute_fingerprint if decision else ""
    action_type = decision.action_type if decision else ""

    logger.info(
        "Reconciling execution %s for dispute %s (current status=%s)",
        execution.id,
        execution.dispute_id,
        prev_status,
    )

    # Re-fetch fresh dispute state from PayPal (GET only)
    fresh_dispute = await read_client.get_dispute(execution.dispute_id)
    reflected = has_action_reflected(action_type, orig_fingerprint, fresh_dispute)

    if reflected:
        # Action took effect on PayPal -> CONFIRMED
        execution.status = ExecutionStatus.CONFIRMED.value
        execution.confirmed_snapshot = fresh_dispute.model_dump(mode="json")
        record_execution_ledger_event(
            session=session,
            dispute_id=execution.dispute_id,
            event_kind=TimelineEventKind.EXECUTION_CONFIRMED,
            payload={
                "execution_id": str(execution.id),
                "reconciled": True,
                "previous_status": prev_status,
                "confirmed_fingerprint": compute_dispute_fingerprint(fresh_dispute),
            },
        )
        session.commit()
        return ReconciliationOutcome(
            execution_id=str(execution.id),
            dispute_id=execution.dispute_id,
            previous_status=prev_status,
            settled_status=ExecutionStatus.CONFIRMED.value,
            reason="Action confirmed by re-fetching dispute state from PayPal",
        )

    # Not reflected on PayPal:
    # If stuck in INTENDED (crash before send), settle to FAILED
    # If stuck in SENT and timeout threshold exceeded, settle to FAILED
    now = datetime.now(UTC)
    created_at = execution.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    age_seconds = (now - created_at).total_seconds()

    if prev_status == ExecutionStatus.INTENDED.value or age_seconds >= settle_unchanged_after_seconds:
        execution.status = ExecutionStatus.FAILED.value
        execution.error_message = (
            f"Reconciled as failed: action not reflected on PayPal "
            f"(prev_status={prev_status}, age={age_seconds:.1f}s)"
        )
        record_execution_ledger_event(
            session=session,
            dispute_id=execution.dispute_id,
            event_kind=TimelineEventKind.EXECUTION_FAILED,
            payload={
                "execution_id": str(execution.id),
                "reconciled": True,
                "previous_status": prev_status,
                "reason": execution.error_message,
            },
        )
        session.commit()
        return ReconciliationOutcome(
            execution_id=str(execution.id),
            dispute_id=execution.dispute_id,
            previous_status=prev_status,
            settled_status=ExecutionStatus.FAILED.value,
            reason="Dispute unchanged on PayPal; settled to FAILED",
        )

    return ReconciliationOutcome(
        execution_id=str(execution.id),
        dispute_id=execution.dispute_id,
        previous_status=prev_status,
        settled_status=prev_status,
        reason="Awaiting propagation; remains in progress",
    )


async def reconcile_stuck_executions(
    session: Session,
    read_client: PayPalReadClient,
    *,
    settle_unchanged_after_seconds: float = 300.0,
) -> list[ReconciliationOutcome]:
    """Find and reconcile all executions currently in INTENDED or SENT states."""
    stuck_execs = session.execute(
        select(Execution).where(
            Execution.status.in_([ExecutionStatus.INTENDED.value, ExecutionStatus.SENT.value])
        )
    ).scalars().all()

    outcomes: list[ReconciliationOutcome] = []
    for exec_row in stuck_execs:
        outcome = await reconcile_single_execution(
            session=session,
            execution=exec_row,
            read_client=read_client,
            settle_unchanged_after_seconds=settle_unchanged_after_seconds,
        )
        outcomes.append(outcome)

    return outcomes
