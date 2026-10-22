"""Job queue wiring: registers every production handler for the worker.

EXECUTE_DECISION lives in app/executor/job.py because only the executor package may import
the mutating PayPal client (architecture guard).
"""

import logging
from typing import Any

from sqlalchemy.orm import Session

from agent.app.agent.llm import LLMService, build_llm_service
from agent.app.agent.loop import run_agent_loop
from agent.app.approvals.jobs import register_approval_handlers
from agent.app.db.models import Job
from agent.app.domain.enums import JobKind
from agent.app.executor.job import handle_execute_decision_job
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.queue.payloads import RunAgentPayload, parse_job_payload
from agent.app.queue.registry import HandlerRegistry
from agent.app.settings import Settings
from agent.app.sync.jobs import register_sync_handlers

logger = logging.getLogger(__name__)


async def handle_run_agent_job(
    job: Job,
    session: Session,
    *,
    read_client: PayPalReadClient | None = None,
    llm_service: LLMService | None = None,
) -> None:
    """Queue worker handler for JobKind.RUN_AGENT jobs."""
    payload = parse_job_payload(job.kind, job.payload)
    if not isinstance(payload, RunAgentPayload):
        raise ValueError(f"Invalid payload type for RUN_AGENT job: {type(payload).__name__}")

    dispute_id = job.dispute_id or payload.dispute_id
    if not dispute_id:
        raise ValueError(f"Job {job.id} missing required dispute_id")

    fingerprint = payload.fingerprint

    owns_read = read_client is None
    client = read_client or PayPalReadClient()
    service = llm_service or build_llm_service(Settings())

    try:
        result = await run_agent_loop(
            session=session,
            dispute_id=dispute_id,
            expected_fingerprint=fingerprint,
            read_client=client,
            llm_service=service,
        )
        logger.info(
            "Agent loop completed for dispute %s (status=%s, decisions=%d)",
            dispute_id,
            result.status,
            len(result.decisions),
        )
    finally:
        if owns_read:
            await client.close()


def register_agent_handlers(
    registry: HandlerRegistry,
    *,
    read_client: PayPalReadClient | None = None,
    mutating_client: Any | None = None,
    llm_service: LLMService | None = None,
) -> None:
    """Register RUN_AGENT and EXECUTE_DECISION handlers into registry."""

    async def _run_agent_handler(job: Job, session: Session) -> None:
        await handle_run_agent_job(
            job,
            session,
            read_client=read_client,
            llm_service=llm_service,
        )

    async def _execute_decision_handler(job: Job, session: Session) -> None:
        await handle_execute_decision_job(
            job,
            session,
            read_client=read_client,
            mutating_client=mutating_client,
        )

    registry.register(JobKind.RUN_AGENT, _run_agent_handler)
    registry.register(JobKind.EXECUTE_DECISION, _execute_decision_handler)
    logger.info("Registered RUN_AGENT and EXECUTE_DECISION handlers into registry")


def build_registry(
    *,
    read_client: PayPalReadClient | None = None,
    mutating_client: Any | None = None,
    llm_service: LLMService | None = None,
) -> HandlerRegistry:
    """Build a complete HandlerRegistry wiring all production queue job handlers."""
    registry = HandlerRegistry()
    register_sync_handlers(registry, paypal_client=read_client)
    register_approval_handlers(registry)
    register_agent_handlers(
        registry,
        read_client=read_client,
        mutating_client=mutating_client,
        llm_service=llm_service,
    )
    return registry
