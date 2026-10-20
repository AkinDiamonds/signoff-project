"""Job handlers for approvals queue operations."""

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from agent.app.approvals.service import expire_overdue_approvals
from agent.app.db.models import Job
from agent.app.domain.enums import JobKind
from agent.app.queue.payloads import ExpireApprovalsPayload, parse_job_payload
from agent.app.queue.registry import HandlerRegistry

logger = logging.getLogger(__name__)


def handle_expire_approvals_job(job: Job, session: Session) -> None:
    """Execute expire_approvals job scanning overdue approval tokens."""
    payload = parse_job_payload(job.kind, job.payload)
    cutoff = None
    if isinstance(payload, ExpireApprovalsPayload) and payload.cutoff_time:
        cutoff = payload.cutoff_time

    expired_count = expire_overdue_approvals(session, now=cutoff or datetime.now(UTC))
    session.commit()
    logger.info("Expired %d overdue approval tokens in job %s", expired_count, job.id)


def register_approval_handlers(registry: HandlerRegistry) -> None:
    """Register approvals handlers into worker HandlerRegistry."""

    def _expire_handler(job: Job, session: Session) -> None:
        handle_expire_approvals_job(job, session)

    registry.register(JobKind.EXPIRE_APPROVALS, _expire_handler)
    logger.info("Registered EXPIRE_APPROVALS handler into registry")
