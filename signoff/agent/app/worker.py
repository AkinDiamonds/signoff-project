"""Background worker process with leased execution, heartbeats, and graceful shutdown.

Fulfills Step 08 requirements:
- Worker entrypoint with graceful shutdown (SIGINT/SIGTERM).
- Claims jobs using skip-locked row leasing.
- Heartbeats during active job execution to maintain lease.
- Unknown kinds and invalid payloads move immediately to dead-letter queue.
- Handled errors retry with exponential backoff and jitter.
- Shutdown cleanly releases active lease back to PENDING.
"""

import argparse
import asyncio
import contextlib
import inspect
import logging
import signal
import threading
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from agent.app.db.models import Job
from agent.app.db.session import get_session_factory
from agent.app.domain.enums import JobKind, JobStatus
from agent.app.queue import (
    HandlerRegistry,
    InvalidPayloadError,
    UnknownJobKindError,
    claim_job,
    complete_job,
    create_default_registry,
    enqueue_job,
    fail_job,
    heartbeat_job,
    parse_job_payload,
    release_job,
)
from agent.app.queue.wiring import build_registry

logger = logging.getLogger(__name__)


class Worker:
    """Queue worker managing job claiming, execution, heartbeats, and graceful shutdown."""

    def __init__(
        self,
        worker_id: str | None = None,
        session_factory: sessionmaker[Session] | None = None,
        registry: HandlerRegistry | None = None,
        lease_seconds: float = 30.0,
        heartbeat_interval: float = 10.0,
        poll_interval: float = 1.0,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        reconcile_interval: float = 0.0,
    ) -> None:
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.session_factory = session_factory or get_session_factory()
        self.registry = registry or create_default_registry()
        self.lease_seconds = lease_seconds
        self.heartbeat_interval = heartbeat_interval
        self.poll_interval = poll_interval
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.reconcile_interval = reconcile_interval

        self._stopping = threading.Event()
        self._active_job_id: uuid.UUID | None = None
        self._active_lock = threading.Lock()

    def stop(self) -> None:
        """Signal the worker to stop processing new jobs and shut down cleanly."""
        logger.info("Worker %s stopping requested", self.worker_id)
        self._stopping.set()

    def is_stopping(self) -> bool:
        """Check whether stop signal has been issued."""
        return self._stopping.is_set()

    def _heartbeat_loop(self, job_id: uuid.UUID, stop_event: threading.Event) -> None:
        """Periodically extend lease while job is executing."""
        while not stop_event.wait(self.heartbeat_interval):
            try:
                with self.session_factory() as hb_session:
                    extended = heartbeat_job(
                        hb_session,
                        job_id=job_id,
                        worker_id=self.worker_id,
                        lease_seconds=self.lease_seconds,
                    )
                    if not extended:
                        logger.warning(
                            "Worker %s lost lease for job %s during heartbeat",
                            self.worker_id,
                            job_id,
                        )
                        break
            except Exception as exc:
                logger.warning(
                    "Worker %s heartbeat failed for job %s: %s",
                    self.worker_id,
                    job_id,
                    exc,
                )

    def run_once(self) -> bool:
        """Attempt to claim and process a single job.

        Returns True if a job was claimed and processed, False if queue was empty.
        """
        if self._stopping.is_set():
            return False

        with self.session_factory() as session:
            job = claim_job(
                session,
                worker_id=self.worker_id,
                lease_seconds=self.lease_seconds,
            )
            if job is None:
                return False

            job_id = job.id
            job_kind = job.kind
            job_payload = job.payload

        with self._active_lock:
            self._active_job_id = job_id

        # If stop was signaled right after claim, release lease cleanly
        if self._stopping.is_set():
            with self.session_factory() as session:
                release_job(session, job_id, self.worker_id)
            with self._active_lock:
                self._active_job_id = None
            return False

        # Process the claimed job
        stop_hb = threading.Event()
        hb_thread = threading.Thread(
            target=self._heartbeat_loop,
            args=(job_id, stop_hb),
            daemon=True,
        )
        hb_thread.start()

        try:
            with self.session_factory() as session:
                # 1. Validate kind against known domain kinds
                if job_kind not in {k.value for k in JobKind}:
                    fail_job(
                        session,
                        job_id=job_id,
                        error=f"Unknown job kind: '{job_kind}'",
                        is_unrecoverable=True,
                    )
                    return True

                # 2. Validate payload schema
                try:
                    parse_job_payload(job_kind, job_payload)
                except (UnknownJobKindError, InvalidPayloadError) as exc:
                    fail_job(
                        session,
                        job_id=job_id,
                        error=f"Invalid payload for {job_kind}: {exc}",
                        is_unrecoverable=True,
                    )
                    return True

                # 3. Look up registered handler
                handler = self.registry.get(job_kind)
                if handler is None:
                    fail_job(
                        session,
                        job_id=job_id,
                        error=f"No handler registered for kind: '{job_kind}'",
                        is_unrecoverable=True,
                    )
                    return True

                # 4. Execute handler
                try:
                    # Refresh job instance in current session
                    current_job = session.get(Job, job_id)
                    if not current_job:
                        return True

                    if inspect.iscoroutinefunction(handler):
                        try:
                            loop = asyncio.get_running_loop()
                        except RuntimeError:
                            loop = None

                        if loop and loop.is_running():
                            import concurrent.futures

                            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                                pool.submit(asyncio.run, handler(current_job, session)).result()
                        else:
                            asyncio.run(handler(current_job, session))
                    else:
                        handler(current_job, session)

                    complete_job(session, job_id)
                except Exception as exc:
                    logger.exception("Worker %s job %s failed: %s", self.worker_id, job_id, exc)
                    # Roll back the handler's session before fail_job: the handler
                    # may have left the transaction in an aborted state (PostgreSQL
                    # aborts the whole transaction on any error), so any further
                    # operation on this session would fail or see stale data.
                    # A fresh session guarantees fail_job reads the committed
                    # attempts count and writes the correct PENDING/DEAD_LETTER status.
                    with contextlib.suppress(Exception):
                        session.rollback()
                    with self.session_factory() as fail_session:
                        fail_job(
                            fail_session,
                            job_id=job_id,
                            error=str(exc),
                            is_unrecoverable=False,
                            base_delay=self.base_delay,
                            max_delay=self.max_delay,
                        )
                return True
        finally:
            stop_hb.set()
            hb_thread.join(timeout=1.0)
            with self._active_lock:
                self._active_job_id = None

    def release_active_job(self) -> None:
        """Release active job back to queue if stopping."""
        with self._active_lock:
            if self._active_job_id is not None:
                try:
                    with self.session_factory() as session:
                        release_job(session, self._active_job_id, self.worker_id)
                except Exception as exc:
                    logger.warning("Failed to release active job on shutdown: %s", exc)
                self._active_job_id = None

    def _enqueue_reconcile_if_idle(self) -> None:
        """Enqueue one RECONCILE job unless one is already waiting or running."""
        with self.session_factory() as session:
            open_job = session.scalar(
                select(Job.id).where(
                    Job.kind == JobKind.RECONCILE.value,
                    Job.status.in_([JobStatus.PENDING.value, JobStatus.RUNNING.value]),
                )
            )
            if open_job is None:
                enqueue_job(session, JobKind.RECONCILE, {})

    def run(self, max_jobs: int | None = None) -> int:
        """Run worker loop until stopped or max_jobs processed.

        Returns total count of processed jobs.
        """
        processed_count = 0

        # Register signal handlers if in main thread
        def _handle_signal(sig: int, frame: Any) -> None:
            logger.info("Signal %d received, initiating graceful shutdown...", sig)
            self.stop()

        is_main_thread = threading.current_thread() is threading.main_thread()
        if is_main_thread:
            try:
                signal.signal(signal.SIGINT, _handle_signal)
                signal.signal(signal.SIGTERM, _handle_signal)
            except (ValueError, AttributeError):
                pass

        logger.info("Worker %s started (poll_interval=%.1fs)", self.worker_id, self.poll_interval)
        try:
            next_reconcile = time.monotonic()
            while not self._stopping.is_set():
                if self.reconcile_interval and time.monotonic() >= next_reconcile:
                    self._enqueue_reconcile_if_idle()
                    next_reconcile = time.monotonic() + self.reconcile_interval
                had_job = self.run_once()
                if had_job:
                    processed_count += 1
                    if max_jobs is not None and processed_count >= max_jobs:
                        logger.info("Worker %s reached max_jobs (%d)", self.worker_id, max_jobs)
                        break
                else:
                    self._stopping.wait(self.poll_interval)
        finally:
            self.release_active_job()
            logger.info("Worker %s stopped cleanly (processed=%d)", self.worker_id, processed_count)

        return processed_count


def main() -> None:
    """CLI entrypoint for standalone background worker."""
    parser = argparse.ArgumentParser(description="Signoff Background Job Worker")
    parser.add_argument("--worker-id", type=str, default=None, help="Unique worker identifier")
    parser.add_argument("--lease-seconds", type=float, default=30.0, help="Lease timeout in seconds")
    parser.add_argument("--poll-interval", type=float, default=1.0, help="Poll interval in seconds")
    parser.add_argument(
        "--reconcile-interval", type=float, default=0.0, help="Seconds between RECONCILE polls (0 = off)"
    )
    parser.add_argument("--max-jobs", type=int, default=None, help="Exit after processing N jobs")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    worker = Worker(
        worker_id=args.worker_id,
        registry=build_registry(),
        lease_seconds=args.lease_seconds,
        poll_interval=args.poll_interval,
        reconcile_interval=args.reconcile_interval,
    )
    worker.run(max_jobs=args.max_jobs)


if __name__ == "__main__":
    main()
