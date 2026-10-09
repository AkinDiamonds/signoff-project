"""Job queue handler integration for dispute sync and reconcile.

Fulfills Step 09 requirements:
- Implements job handlers for JobKind.SYNC_DISPUTE and JobKind.RECONCILE.
- Registers handlers with HandlerRegistry.
- Manages database sessions and PayPalReadClient lifecycle safely.
"""

import logging

from sqlalchemy.orm import Session

from agent.app.db.models import Job
from agent.app.domain.enums import JobKind
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.queue import HandlerRegistry
from agent.app.sync.handler import sync_dispute
from agent.app.sync.reconciler import reconcile_disputes

logger = logging.getLogger(__name__)


async def handle_sync_dispute_job(
    job: Job,
    session: Session,
    paypal_client: PayPalReadClient | None = None,
) -> None:
    """Queue worker handler for JobKind.SYNC_DISPUTE jobs."""
    payload = job.payload or {}
    dispute_id = job.dispute_id or payload.get("dispute_id")
    if not dispute_id:
        raise ValueError(f"Job {job.id} missing required dispute_id in payload or column")

    event_id = payload.get("event_id")
    event_type = payload.get("event_type")

    owns_client = paypal_client is None
    client = paypal_client or PayPalReadClient()
    try:
        await sync_dispute(
            dispute_id=dispute_id,
            session=session,
            paypal_client=client,
            event_id=event_id,
            event_type=event_type,
        )
    finally:
        if owns_client:
            await client.close()


async def handle_reconcile_job(
    job: Job,
    session: Session,
    paypal_client: PayPalReadClient | None = None,
) -> None:
    """Queue worker handler for JobKind.RECONCILE jobs."""
    payload = job.payload or {}
    lookback_days = payload.get("lookback_days", 30)

    owns_client = paypal_client is None
    client = paypal_client or PayPalReadClient()
    try:
        await reconcile_disputes(
            session=session,
            paypal_client=client,
            lookback_days=lookback_days,
        )
    finally:
        if owns_client:
            await client.close()


def register_sync_handlers(
    registry: HandlerRegistry,
    paypal_client: PayPalReadClient | None = None,
) -> None:
    """Register sync and reconcile handlers into the worker HandlerRegistry."""

    async def _sync_handler(job: Job, session: Session) -> None:
        await handle_sync_dispute_job(job, session, paypal_client=paypal_client)

    async def _reconcile_handler(job: Job, session: Session) -> None:
        await handle_reconcile_job(job, session, paypal_client=paypal_client)

    registry.register(JobKind.SYNC_DISPUTE, _sync_handler)
    registry.register(JobKind.RECONCILE, _reconcile_handler)
    logger.info("Registered SYNC_DISPUTE and RECONCILE handlers into registry")
