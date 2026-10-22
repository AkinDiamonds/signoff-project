"""Queue handler for EXECUTE_DECISION jobs (lives here: only app/executor may import the mutating client)."""

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, Job
from agent.app.domain.actions import parse_action_from_stored
from agent.app.domain.enums import Verdict
from agent.app.executor.executor import execute_decision
from agent.app.paypal.mutating_client import PayPalMutatingClient
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.policy.gate import reconstruct_decision
from agent.app.queue.payloads import ExecuteDecisionPayload, parse_job_payload

logger = logging.getLogger(__name__)


async def handle_execute_decision_job(
    job: Job,
    session: Session,
    *,
    read_client: PayPalReadClient | None = None,
    mutating_client: Any | None = None,
) -> None:
    """Queue worker handler for JobKind.EXECUTE_DECISION jobs."""
    payload = parse_job_payload(job.kind, job.payload)
    if not isinstance(payload, ExecuteDecisionPayload):
        raise ValueError(f"Invalid payload type for EXECUTE_DECISION job: {type(payload).__name__}")

    decision_id = payload.decision_id
    dispute_id = payload.dispute_id or job.dispute_id

    dec_row: Decision | None = None
    if decision_id:
        dec_row = session.get(Decision, uuid.UUID(decision_id))
    elif dispute_id:
        dec_row = session.execute(
            select(Decision)
            .where(Decision.dispute_id == dispute_id)
            .order_by(Decision.created_at.desc())
        ).scalars().first()

    if dec_row is None:
        logger.warning(
            "ExecuteDecision job %s could not locate Decision row (decision_id=%s, dispute_id=%s)",
            job.id,
            decision_id,
            dispute_id,
        )
        return

    if dec_row.verdict != Verdict.ALLOW.value:
        logger.warning(
            "Decision %s verdict is not ALLOW (%s). Skipping execution in worker.",
            dec_row.id,
            dec_row.verdict,
        )
        return

    action = parse_action_from_stored(dec_row.action_type, dec_row.action_payload)
    gate_decision = reconstruct_decision(
        verdict=Verdict(dec_row.verdict),
        rule_id=dec_row.rule_id,
        reason=dec_row.reason,
        action_hash=dec_row.action_hash,
        dispute_fingerprint=dec_row.dispute_fingerprint,
        charter_version=dec_row.charter_version,
        also_triggered=dec_row.also_triggered or (),
    )

    owns_read = read_client is None
    owns_mutating = mutating_client is None
    rc = read_client or PayPalReadClient()
    mc = mutating_client or PayPalMutatingClient()

    try:
        result = await execute_decision(
            session=session,
            decision=gate_decision,
            action=action,
            dispute_id=dec_row.dispute_id,
            read_client=rc,
            mutating_client=mc,
            decision_id=dec_row.id,
        )
        logger.info(
            "Execution completed for decision %s (dispute=%s, status=%s)",
            dec_row.id,
            dec_row.dispute_id,
            result.status,
        )
    finally:
        if owns_read:
            await rc.close()
        if owns_mutating:
            await mc.close()
