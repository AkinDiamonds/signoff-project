"""Dispute reconciliation poller.

Fulfills Step 09 requirements:
- Lists open disputes from PayPal via PayPalReadClient.
- Compares state fingerprints (or snapshot update times when available) between PayPal and the local database.
- Enqueues SYNC_DISPUTE jobs for missing or changed disputes.
- Coalesces with existing pending sync jobs.
- Caps items processed per cycle to handle large dispute volumes smoothly.
"""

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from math import ceil

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.models import Dispute, Job, LedgerEvent
from agent.app.domain.enums import JobKind, JobStatus, TimelineEventKind
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.read_client import PayPalReadClient

logger = logging.getLogger(__name__)


def _snapshot_update_time(dispute: Dispute) -> datetime | None:
    """Read PayPal's update_time from a stored snapshot, if present and valid."""
    raw = (dispute.snapshot or {}).get("update_time")
    if not isinstance(raw, str):
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


@dataclass
class ReconcileResult:
    """Outcome of a reconciliation cycle."""

    checked_count: int
    enqueued_count: int
    disputes_enqueued: list[str] = field(default_factory=list)


async def reconcile_disputes(
    session: Session,
    paypal_client: PayPalReadClient,
    max_items: int = 50,
    page_size: int = 20,
    lookback_days: int = 30,
) -> ReconcileResult:
    """Poll PayPal for open disputes and enqueue sync jobs for any with mismatched fingerprints.

    Edge cases handled:
    - Huge open list: capped at max_items per cycle.
    - Dropped webhook: caught by poller and enqueued.
    - Concurrency with webhooks: coalesces with existing pending sync jobs.
    """
    start_time: datetime | None = None
    if lookback_days > 0:
        start_time = datetime.now(UTC) - timedelta(days=lookback_days)

    checked_count = 0
    enqueued_count = 0
    disputes_enqueued: list[str] = []

    # Fetch dispute summaries via the public paginator (handles host validation,
    # JSON errors, loop detection, and backoff internally).
    # max_pages is derived so we fetch at most max_items items.
    max_pages = ceil(max_items / page_size) + 1
    all_summaries = await paypal_client.list_all_disputes(
        page_size=min(page_size, max_items),
        max_pages=max_pages,
        start_time=start_time,
    )
    capped_summaries = all_summaries[:max_items]

    for summary in capped_summaries:
        checked_count += 1
        dispute_id = summary.dispute_id
        summary_fp = str(compute_dispute_fingerprint(summary))

        local_dispute = session.get(Dispute, dispute_id)
        has_synced = session.scalar(
            select(LedgerEvent.id)
            .where(
                LedgerEvent.dispute_id == dispute_id,
                LedgerEvent.event_kind == TimelineEventKind.DISPUTE_SYNCED.value,
            )
            .limit(1)
        ) is not None

        if local_dispute is None or not has_synced:
            # Missing locally, or pre-stored by the demo generator and never synced.
            needs_sync = True
        else:
            local_updated = _snapshot_update_time(local_dispute)
            # Summary fingerprints cover fewer fields than full disputes, so prefer
            # PayPal's update_time whenever the stored snapshot carries one.
            needs_sync = (
                local_updated != summary.update_time
                if local_updated is not None
                else local_dispute.state_fingerprint != summary_fp
            )

        if needs_sync:
            # Check if sync job already exists and is pending or running
            existing_job = session.execute(
                select(Job).where(
                    Job.dispute_id == dispute_id,
                    Job.kind == JobKind.SYNC_DISPUTE.value,
                    Job.status.in_([JobStatus.PENDING.value, JobStatus.RUNNING.value]),
                )
            ).scalar_one_or_none()

            if not existing_job:
                sync_job = Job(
                    kind=JobKind.SYNC_DISPUTE.value,
                    dispute_id=dispute_id,
                    status=JobStatus.PENDING.value,
                    payload={
                        "dispute_id": dispute_id,
                        "event_type": "RECONCILE",
                    },
                )
                session.add(sync_job)
                enqueued_count += 1
                disputes_enqueued.append(dispute_id)
                logger.info(
                    "Reconciler enqueued SYNC_DISPUTE for dispute %s (reason=%s)",
                    dispute_id,
                    "missing" if local_dispute is None else "fingerprint_mismatch",
                )

    session.flush()
    logger.info(
        "Reconcile cycle finished: checked %d disputes, enqueued %d sync jobs",
        checked_count,
        enqueued_count,
    )
    return ReconcileResult(
        checked_count=checked_count,
        enqueued_count=enqueued_count,
        disputes_enqueued=disputes_enqueued,
    )
