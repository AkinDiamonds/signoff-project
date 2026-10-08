"""Postgres-backed leased job queue with skip-locked claiming and heartbeats.

Fulfills Step 08 requirements:
1. Claim jobs with row locking that skips locked rows (FOR UPDATE SKIP LOCKED).
2. Uses database time (SELECT func.now()), not worker clock, for lease evaluations.
3. Leases with expiry and heartbeat.
4. Retries with exponential backoff and jitter; max attempts or unrecoverable errors move to dead-letter.
5. Surfaces queue depth and dead-letter count.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from agent.app.db.models import Job
from agent.app.domain.enums import JobKind, JobStatus
from agent.app.queue.backoff import calculate_backoff
from agent.app.queue.payloads import parse_job_payload

logger = logging.getLogger(__name__)


def enqueue_job(
    session: Session,
    kind: JobKind | str,
    payload: dict[str, Any] | BaseModel | None = None,
    dispute_id: str | None = None,
    run_after: datetime | None = None,
    max_attempts: int = 5,
    commit: bool = True,
) -> Job:
    """Enqueue a new job with schema validation against domain kinds."""
    kind_value = kind.value if isinstance(kind, JobKind) else str(kind)

    # Convert BaseModel to dict if needed
    raw_payload = payload.model_dump(mode="json") if isinstance(payload, BaseModel) else payload

    # Validate payload upfront to fail fast on invalid jobs
    parse_job_payload(kind_value, raw_payload)

    # Extract dispute_id if present in payload and not explicitly passed
    resolved_dispute_id = dispute_id
    if resolved_dispute_id is None and isinstance(raw_payload, dict):
        resolved_dispute_id = raw_payload.get("dispute_id")

    job = Job(
        id=uuid.uuid4(),
        kind=kind_value,
        dispute_id=resolved_dispute_id,
        status=JobStatus.PENDING.value,
        payload=raw_payload,
        attempts=0,
        max_attempts=max_attempts,
        run_after=run_after if run_after is not None else func.now(),
    )
    session.add(job)
    if commit:
        session.commit()
        session.refresh(job)
    else:
        session.flush()

    logger.info(
        "Enqueued job %s (kind=%s, dispute_id=%s)",
        job.id,
        job.kind,
        job.dispute_id,
    )
    return job


def claim_job(
    session: Session,
    worker_id: str,
    lease_seconds: float = 30.0,
) -> Job | None:
    """Claim a pending or lease-expired job using row-level skip-locked locking.

    Uses database time (SELECT func.now()) to guarantee synchronization across workers.
    """
    db_now = session.scalar(select(func.now()))
    if db_now is None:
        db_now = datetime.now(UTC)

    # Claimable condition:
    # 1. PENDING jobs where run_after <= db_now
    # 2. RUNNING jobs whose lease expired (locked_until < db_now)
    claimable_cond = or_(
        and_(Job.status == JobStatus.PENDING.value, Job.run_after <= db_now),
        and_(
            Job.status == JobStatus.RUNNING.value,
            Job.locked_until.is_not(None),
            Job.locked_until < db_now,
        ),
    )

    query = (
        select(Job)
        .where(claimable_cond)
        .order_by(Job.run_after.asc(), Job.created_at.asc())
        .limit(1)
    )

    # Use FOR UPDATE SKIP LOCKED on PostgreSQL, fallback to FOR UPDATE on SQLite/others
    if session.bind and session.bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)
    elif session.bind and session.bind.dialect.name != "sqlite":
        query = query.with_for_update()

    job = session.scalar(query)
    if job is None:
        session.rollback()
        return None

    # Claim the job and advance lease
    job.status = JobStatus.RUNNING.value
    job.locked_by = worker_id
    job.locked_until = db_now + timedelta(seconds=lease_seconds)
    job.attempts += 1

    session.commit()
    session.refresh(job)

    logger.info(
        "Claimed job %s (kind=%s, attempt=%d) by worker %s until %s",
        job.id,
        job.kind,
        job.attempts,
        worker_id,
        job.locked_until,
    )
    return job


def heartbeat_job(
    session: Session,
    job_id: uuid.UUID,
    worker_id: str,
    lease_seconds: float = 30.0,
) -> bool:
    """Extend the lease of an actively running job using database time."""
    db_now = session.scalar(select(func.now()))
    if db_now is None:
        db_now = datetime.now(UTC)

    stmt = select(Job).where(
        Job.id == job_id,
        Job.locked_by == worker_id,
        Job.status == JobStatus.RUNNING.value,
    )
    if session.bind and session.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    job = session.scalar(stmt)
    if not job:
        session.rollback()
        return False

    job.locked_until = db_now + timedelta(seconds=lease_seconds)
    session.commit()
    return True


def complete_job(
    session: Session,
    job_id: uuid.UUID,
) -> bool:
    """Mark a job as successfully completed and release its lease."""
    job = session.get(Job, job_id)
    if not job:
        session.rollback()
        return False

    job.status = JobStatus.COMPLETED.value
    job.locked_by = None
    job.locked_until = None
    job.last_error = None
    session.commit()

    logger.info("Completed job %s (kind=%s)", job.id, job.kind)
    return True


def fail_job(
    session: Session,
    job_id: uuid.UUID,
    error: str,
    is_unrecoverable: bool = False,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
) -> JobStatus:
    """Fail a job with exponential backoff and jitter, or move to dead-letter queue."""
    job = session.get(Job, job_id)
    if not job:
        session.rollback()
        return JobStatus.FAILED

    db_now = session.scalar(select(func.now()))
    if db_now is None:
        db_now = datetime.now(UTC)

    if is_unrecoverable or job.attempts >= job.max_attempts:
        # Move immediately to dead-letter queue
        job.status = JobStatus.DEAD_LETTER.value
        job.last_error = error
        job.locked_by = None
        job.locked_until = None
        session.commit()
        logger.warning(
            "Job %s moved to DEAD_LETTER (attempts=%d/%d, unrecoverable=%s): %s",
            job.id,
            job.attempts,
            job.max_attempts,
            is_unrecoverable,
            error,
        )
        return JobStatus.DEAD_LETTER

    # Schedule retry with exponential backoff and jitter
    delay_seconds = calculate_backoff(
        attempt=job.attempts,
        base_seconds=base_delay,
        max_seconds=max_delay,
        jitter=jitter,
    )
    job.status = JobStatus.PENDING.value
    job.run_after = db_now + timedelta(seconds=delay_seconds)
    job.last_error = error
    job.locked_by = None
    job.locked_until = None
    session.commit()

    logger.info(
        "Job %s scheduled for retry in %.2fs (attempt %d/%d): %s",
        job.id,
        delay_seconds,
        job.attempts,
        job.max_attempts,
        error,
    )
    return JobStatus.PENDING


def release_job(
    session: Session,
    job_id: uuid.UUID,
    worker_id: str,
) -> bool:
    """Cleanly release a lease back to PENDING when worker shuts down during job execution."""
    stmt = select(Job).where(
        Job.id == job_id,
        Job.locked_by == worker_id,
        Job.status == JobStatus.RUNNING.value,
    )
    if session.bind and session.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    job = session.scalar(stmt)
    if not job:
        session.rollback()
        return False

    job.status = JobStatus.PENDING.value
    job.locked_by = None
    job.locked_until = None
    # Revert attempts increment so shutdown does not penalize retry count
    if job.attempts > 0:
        job.attempts -= 1
    session.commit()

    logger.info("Cleanly released lease for job %s back to PENDING", job.id)
    return True


def get_queue_stats(session: Session) -> dict[str, int]:
    """Retrieve queue depth (PENDING), dead-letter count, and running jobs count."""
    try:
        stmt = (
            select(Job.status, func.count(Job.id))
            .where(
                Job.status.in_(
                    [
                        JobStatus.PENDING.value,
                        JobStatus.DEAD_LETTER.value,
                        JobStatus.RUNNING.value,
                    ]
                )
            )
            .group_by(Job.status)
        )
        rows = session.execute(stmt).all()
        counts = {str(status_val): int(count) for status_val, count in rows}
        return {
            "queue_depth": counts.get(JobStatus.PENDING.value, 0),
            "dead_letter_count": counts.get(JobStatus.DEAD_LETTER.value, 0),
            "running_count": counts.get(JobStatus.RUNNING.value, 0),
        }
    except Exception as exc:
        logger.warning("Failed to query queue stats from database: %s", exc)
        return {
            "queue_depth": 0,
            "dead_letter_count": 0,
            "running_count": 0,
        }
