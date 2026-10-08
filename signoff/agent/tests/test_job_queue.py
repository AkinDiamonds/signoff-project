"""Comprehensive tests for Postgres-backed leased job queue and worker.

Validates all requirements and edge cases from build-plan/steps/08-job-queue.md:
1. Two workers never run the same job concurrently (skip-locked row locking).
2. Worker killed mid-job: lease expires and another worker finishes it.
3. A poison job does not block others (exponential backoff run_after in future).
4. Use database time, not worker time, for leases.
5. Graceful shutdown during a job: cleanly release lease back to PENDING.
6. Payload invalid for its kind / unknown kind: dead-letter immediately.
7. Handler registry checked for exhaustiveness.
8. Backoff table and bounded jitter.
9. Surface queue depth and dead-letter count in /api/status.
10. End-to-end: Webhook-created job processed to completion by worker.
"""

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from agent.app.db.models import Job, WebhookEvent
from agent.app.db.session import get_engine, get_session_factory
from agent.app.domain.enums import JobKind, JobStatus
from agent.app.main import create_app
from agent.app.queue import (
    ExecuteDecisionPayload,
    ExpireApprovalsPayload,
    HandlerRegistry,
    InvalidPayloadError,
    ReconcilePayload,
    RunAgentPayload,
    SyncDisputePayload,
    UnknownJobKindError,
    calculate_backoff,
    claim_job,
    create_default_registry,
    enqueue_job,
    heartbeat_job,
    parse_job_payload,
)
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.worker import Worker


@pytest.fixture(scope="session")
def engine():
    return get_engine()


@pytest.fixture
def session_factory(engine):
    return get_session_factory(engine)


@pytest.fixture
def db_session(session_factory) -> Session:
    session = session_factory()
    yield session
    session.rollback()
    session.close()


@pytest.fixture(autouse=True)
def clean_jobs(session_factory):
    """Ensure clean jobs table before and after each test."""
    with session_factory() as session:
        session.execute(delete(Job))
        session.commit()
    yield
    with session_factory() as session:
        session.execute(delete(Job))
        session.commit()


# ============================================================================
# 1. Backoff Table & Jitter Tests
# ============================================================================


def test_backoff_table_deterministic():
    """Verify exact exponential backoff values without jitter."""
    base = 1.0
    cap = 60.0

    # Table: 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped)
    expected = [1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0, 60.0]
    for idx, exp in enumerate(expected, start=1):
        actual = calculate_backoff(attempt=idx, base_seconds=base, max_seconds=cap, jitter=False)
        assert actual == pytest.approx(exp), f"Attempt {idx} expected {exp}, got {actual}"


def test_backoff_with_jitter_bounded():
    """Verify that jitter adds positive bounded delay."""
    base = 2.0
    cap = 30.0
    for attempt in range(1, 6):
        deterministic = calculate_backoff(attempt=attempt, base_seconds=base, max_seconds=cap, jitter=False)
        jittered = calculate_backoff(
            attempt=attempt,
            base_seconds=base,
            max_seconds=cap,
            jitter=True,
            jitter_ratio=0.5,
        )
        assert jittered >= deterministic
        assert jittered <= deterministic * 1.5


# ============================================================================
# 2. Typed Payloads & Exhaustiveness
# ============================================================================


def test_payload_validation_all_domain_kinds():
    """All domain kinds parse valid payloads correctly."""
    # 1. Sync dispute
    sync = parse_job_payload(JobKind.SYNC_DISPUTE, {"dispute_id": "PP-D-1", "event_id": "WH-1"})
    assert isinstance(sync, SyncDisputePayload)
    assert sync.dispute_id == "PP-D-1"

    # 2. Run agent
    agent = parse_job_payload(JobKind.RUN_AGENT, {"dispute_id": "PP-D-1", "fingerprint": "abc"})
    assert isinstance(agent, RunAgentPayload)

    # 3. Execute decision
    exec_dec = parse_job_payload(JobKind.EXECUTE_DECISION, {"decision_id": "dec-123"})
    assert isinstance(exec_dec, ExecuteDecisionPayload)

    # 4. Reconcile
    rec = parse_job_payload(JobKind.RECONCILE, {"lookback_days": 14})
    assert isinstance(rec, ReconcilePayload)
    assert rec.lookback_days == 14

    # 5. Expire approvals
    exp = parse_job_payload(JobKind.EXPIRE_APPROVALS, {})
    assert isinstance(exp, ExpireApprovalsPayload)


def test_payload_validation_errors():
    """Unknown kinds and invalid payload structures raise typed exceptions."""
    with pytest.raises(UnknownJobKindError):
        parse_job_payload("non_existent_kind", {})

    with pytest.raises(InvalidPayloadError):
        parse_job_payload(JobKind.SYNC_DISPUTE, {})  # Missing required dispute_id

    with pytest.raises(InvalidPayloadError):
        parse_job_payload(JobKind.EXECUTE_DECISION, {})  # Missing decision_id and dispute_id


def test_handler_registry_exhaustiveness():
    """Registry validates that all JobKind members are covered."""
    registry = create_default_registry()
    registry.validate_exhaustiveness()  # Must not raise

    # Partial registry missing a kind raises ValueError
    partial = HandlerRegistry()
    partial.register(JobKind.SYNC_DISPUTE, lambda j, s: None)
    with pytest.raises(ValueError, match="Missing required handler for job kind"):
        partial.validate_exhaustiveness()


# ============================================================================
# 3. Leased Claiming & Database Time
# ============================================================================


def test_claim_job_uses_database_time(db_session: Session):
    """Job claiming leases using DB server time, preventing worker clock skew."""
    job = enqueue_job(
        db_session,
        kind=JobKind.SYNC_DISPUTE,
        payload={"dispute_id": "PP-D-TEST-TIME"},
    )

    db_now_before = db_session.scalar(select(func.now()))
    claimed = claim_job(db_session, worker_id="worker-clock-test", lease_seconds=45.0)
    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.status == JobStatus.RUNNING.value
    assert claimed.locked_by == "worker-clock-test"
    assert claimed.attempts == 1

    # Lease locked_until must reflect DB time + 45s
    assert claimed.locked_until is not None
    diff = (claimed.locked_until - db_now_before).total_seconds()
    assert 43.0 <= diff <= 47.0


def test_no_double_claim_while_lease_valid(db_session: Session):
    """While lease is valid, another worker cannot claim the same job."""
    enqueue_job(
        db_session,
        kind=JobKind.SYNC_DISPUTE,
        payload={"dispute_id": "PP-D-NO-DOUBLE"},
    )

    worker1_claimed = claim_job(db_session, worker_id="worker-1", lease_seconds=60.0)
    assert worker1_claimed is not None

    worker2_claimed = claim_job(db_session, worker_id="worker-2", lease_seconds=60.0)
    assert worker2_claimed is None


# ============================================================================
# 4. Multi-Worker Concurrency (SKIP LOCKED)
# ============================================================================


def test_multi_worker_concurrency_no_duplicate_processing(session_factory):
    """Multiple concurrent workers process a batch of jobs with zero conflicts."""
    num_jobs = 12
    with session_factory() as session:
        for i in range(num_jobs):
            enqueue_job(
                session,
                kind=JobKind.SYNC_DISPUTE,
                payload={"dispute_id": f"PP-D-CONCUR-{i}"},
            )

    processed_jobs: list[uuid.UUID] = []
    lock = threading.Lock()

    def worker_task(worker_name: str) -> int:
        count = 0
        reg = create_default_registry()

        def custom_sync(job: Job, s: Session) -> None:
            with lock:
                assert job.id not in processed_jobs, f"Job {job.id} double processed!"
                processed_jobs.append(job.id)

        reg.register(JobKind.SYNC_DISPUTE, custom_sync)
        worker = Worker(
            worker_id=worker_name,
            session_factory=session_factory,
            registry=reg,
            poll_interval=0.01,
        )

        while True:
            did_work = worker.run_once()
            if did_work:
                count += 1
            else:
                break
        return count

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(worker_task, f"w-{idx}") for idx in range(4)]
        counts = [f.result() for f in as_completed(futures)]

    assert sum(counts) == num_jobs
    assert len(processed_jobs) == num_jobs
    assert len(set(processed_jobs)) == num_jobs


# ============================================================================
# 5. Worker Killed Mid-Job & Lease Expiry Recovery
# ============================================================================


def test_worker_killed_mid_job_lease_expires_and_reclaimed(session_factory):
    """If a worker crashes mid-job, expired lease allows another worker to finish it."""
    with session_factory() as session:
        job = enqueue_job(
            session,
            kind=JobKind.SYNC_DISPUTE,
            payload={"dispute_id": "PP-D-CRASH-TEST"},
        )
        job_id = job.id

    # Worker 1 claims job with 1 second lease
    with session_factory() as session:
        claimed_w1 = claim_job(session, worker_id="worker-crash-1", lease_seconds=1.0)
        assert claimed_w1 is not None
        assert claimed_w1.id == job_id
        assert claimed_w1.attempts == 1

        # Simulate lease expiry by setting locked_until to past
        claimed_w1.locked_until = datetime.now(UTC) - timedelta(seconds=10)
        session.commit()

    # Worker 2 attempts to claim
    completed_by_w2 = False
    reg2 = create_default_registry()

    def handler_w2(j: Job, s: Session) -> None:
        nonlocal completed_by_w2
        completed_by_w2 = True

    reg2.register(JobKind.SYNC_DISPUTE, handler_w2)
    worker2 = Worker(
        worker_id="worker-survivor-2",
        session_factory=session_factory,
        registry=reg2,
    )

    did_run = worker2.run_once()
    assert did_run is True
    assert completed_by_w2 is True

    with session_factory() as session:
        final_job = session.get(Job, job_id)
        assert final_job is not None
        assert final_job.status == JobStatus.COMPLETED.value
        assert final_job.attempts == 2


# ============================================================================
# 6. Poison Job Isolation & Dead-Letter Path
# ============================================================================


def test_poison_job_does_not_block_others(session_factory):
    """Failing job retried in future does not block immediately pending jobs."""
    with session_factory() as session:
        poison_job = enqueue_job(
            session,
            kind=JobKind.SYNC_DISPUTE,
            payload={"dispute_id": "PP-D-POISON"},
        )
        good_job = enqueue_job(
            session,
            kind=JobKind.SYNC_DISPUTE,
            payload={"dispute_id": "PP-D-GOOD"},
        )
        p_id = poison_job.id
        g_id = good_job.id

    reg = create_default_registry()

    def sync_handler(j: Job, s: Session) -> None:
        if j.id == p_id:
            raise RuntimeError("Poison payload exploded!")

    reg.register(JobKind.SYNC_DISPUTE, sync_handler)
    worker = Worker(
        worker_id="worker-poison-test",
        session_factory=session_factory,
        registry=reg,
        base_delay=10.0,  # 10 seconds in the future
    )

    # 1. First run picks poison job, which fails and gets backed off 10s
    did_run_1 = worker.run_once()
    assert did_run_1 is True

    with session_factory() as session:
        p_record = session.get(Job, p_id)
        assert p_record.status == JobStatus.PENDING.value
        assert p_record.attempts == 1
        assert "Poison payload exploded!" in (p_record.last_error or "")

    # 2. Second run immediately claims good job, unblocked!
    did_run_2 = worker.run_once()
    assert did_run_2 is True

    with session_factory() as session:
        g_record = session.get(Job, g_id)
        assert g_record.status == JobStatus.COMPLETED.value


def test_invalid_payload_dead_letters_immediately(session_factory):
    """Payload invalid for declared kind goes to DEAD_LETTER immediately without retry."""
    with session_factory() as session:
        # Insert raw invalid job bypassing upfront enqueue validation
        raw_job = Job(
            id=uuid.uuid4(),
            kind=JobKind.SYNC_DISPUTE.value,
            payload={"invalid_field": 123},  # Missing dispute_id
            status=JobStatus.PENDING.value,
            attempts=0,
            max_attempts=5,
        )
        session.add(raw_job)
        session.commit()
        job_id = raw_job.id

    worker = Worker(session_factory=session_factory)
    did_run = worker.run_once()
    assert did_run is True

    with session_factory() as session:
        job = session.get(Job, job_id)
        assert job is not None
        assert job.status == JobStatus.DEAD_LETTER.value
        assert job.attempts == 1  # Did not burn through 5 attempts!
        assert "Invalid payload" in (job.last_error or "")


def test_unknown_or_unregistered_kind_dead_letters_immediately(session_factory):
    """Job kind without a handler in the worker registry goes to DEAD_LETTER immediately."""
    with session_factory() as session:
        job = enqueue_job(
            session,
            kind=JobKind.RECONCILE,
            payload={"lookback_days": 14},
        )
        job_id = job.id

    # Worker with an empty registry that does not know or register this kind
    empty_registry = HandlerRegistry()
    worker = Worker(session_factory=session_factory, registry=empty_registry)
    did_run = worker.run_once()
    assert did_run is True

    with session_factory() as session:
        saved_job = session.get(Job, job_id)
        assert saved_job is not None
        assert saved_job.status == JobStatus.DEAD_LETTER.value
        assert saved_job.attempts == 1
        assert "No handler registered" in (saved_job.last_error or "")


def test_max_attempts_moves_to_dead_letter(session_factory):
    """A transiently failing job moves to DEAD_LETTER once max_attempts is reached."""
    with session_factory() as session:
        job = enqueue_job(
            session,
            kind=JobKind.SYNC_DISPUTE,
            payload={"dispute_id": "PP-D-MAX-ATTEMPTS"},
            max_attempts=2,
        )
        job_id = job.id

    reg = create_default_registry()

    def failing_handler(j: Job, s: Session) -> None:
        raise ValueError("Persistent downstream failure")

    reg.register(JobKind.SYNC_DISPUTE, failing_handler)
    worker = Worker(session_factory=session_factory, registry=reg, base_delay=0.01)

    # Attempt 1 -> PENDING retry
    worker.run_once()
    with session_factory() as session:
        j1 = session.get(Job, job_id)
        assert j1.status == JobStatus.PENDING.value
        assert j1.attempts == 1
        # Set run_after to past to allow immediate second attempt
        j1.run_after = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()

    # Attempt 2 -> DEAD_LETTER
    worker.run_once()
    with session_factory() as session:
        j2 = session.get(Job, job_id)
        assert j2.status == JobStatus.DEAD_LETTER.value
        assert j2.attempts == 2
        assert "Persistent downstream failure" in (j2.last_error or "")


# ============================================================================
# 7. Heartbeat & Graceful Shutdown
# ============================================================================


def test_heartbeat_extends_lease(db_session: Session):
    """Heartbeat updates locked_until into future."""
    job = enqueue_job(
        db_session,
        kind=JobKind.SYNC_DISPUTE,
        payload={"dispute_id": "PP-D-HB"},
    )
    claimed = claim_job(db_session, worker_id="worker-hb", lease_seconds=10.0)
    assert claimed is not None
    first_lock_until = claimed.locked_until

    # Fast forward time in heartbeat
    extended = heartbeat_job(db_session, job_id=job.id, worker_id="worker-hb", lease_seconds=60.0)
    assert extended is True

    db_session.refresh(claimed)
    assert claimed.locked_until > first_lock_until

    # Heartbeat with wrong worker id fails
    wrong_hb = heartbeat_job(db_session, job_id=job.id, worker_id="other-worker", lease_seconds=60.0)
    assert wrong_hb is False


def test_clean_shutdown_releases_lease_to_pending(session_factory):
    """Worker cleanly releases active lease to PENDING on shutdown."""
    with session_factory() as session:
        job = enqueue_job(
            session,
            kind=JobKind.SYNC_DISPUTE,
            payload={"dispute_id": "PP-D-SHUTDOWN"},
        )
        job_id = job.id

    worker = Worker(
        worker_id="worker-graceful",
        session_factory=session_factory,
    )

    with session_factory() as session:
        claimed = claim_job(session, worker_id=worker.worker_id, lease_seconds=30.0)
        assert claimed is not None

    worker._active_job_id = job_id
    worker.release_active_job()

    with session_factory() as session:
        released = session.get(Job, job_id)
        assert released.status == JobStatus.PENDING.value
        assert released.locked_by is None
        assert released.locked_until is None


# ============================================================================
# 8. Queue Metrics & API Status Surface
# ============================================================================


def test_api_status_surfaces_queue_depth_and_dead_letter(session_factory):
    """GET /api/status surfaces accurate queue_depth and dead_letter_count."""
    with session_factory() as session:
        enqueue_job(session, kind=JobKind.SYNC_DISPUTE, payload={"dispute_id": "PP-D-M1"})
        enqueue_job(session, kind=JobKind.SYNC_DISPUTE, payload={"dispute_id": "PP-D-M2"})

        dead_job = Job(
            id=uuid.uuid4(),
            kind=JobKind.SYNC_DISPUTE.value,
            payload={"dispute_id": "PP-D-DEAD"},
            status=JobStatus.DEAD_LETTER.value,
            attempts=5,
        )
        session.add(dead_job)
        session.commit()

    settings = Settings(app_env=AppEnv.test, paypal_env=PayPalEnv.stub)
    app = create_app(settings)
    client = TestClient(app)

    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["queue_depth"] == 2
    assert data["dead_letter_count"] == 1


# ============================================================================
# 9. Webhook Receiver to Worker End-to-End
# ============================================================================


def test_webhook_to_worker_end_to_end_execution(session_factory):
    """PayPal webhook receiver enqueues sync job, worker executes it to completion."""
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        paypal_merchant_id="MERCHANT-LOCAL-TEST",
    )
    app = create_app(settings)
    client = TestClient(app)

    dispute_id = f"PP-D-WH-E2E-{uuid.uuid4().hex[:6]}"
    event_id = f"WH-EVENT-{uuid.uuid4().hex[:8]}"

    # Clean existing webhook events for isolation
    with session_factory() as session:
        session.execute(delete(WebhookEvent))
        session.commit()

    # 1. Post webhook event
    payload = {
        "id": event_id,
        "event_version": "1.0",
        "create_time": "2026-10-08T20:00:00Z",
        "resource_type": "dispute",
        "event_type": "CUSTOMER.DISPUTE.CREATED",
        "summary": "Dispute created for local test",
        "resource": {
            "dispute_id": dispute_id,
            "seller_merchant_id": "MERCHANT-LOCAL-TEST",
        },
    }

    headers = {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123",
        "paypal-transmission-id": f"TRANS-{uuid.uuid4().hex[:12]}",
        "paypal-transmission-sig": "VALID_MOCK_SIGNATURE_BASE64",
        "paypal-transmission-time": "2026-10-08T12:00:00Z",
    }

    resp = client.post(
        "/webhooks/paypal",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    # 2. Check /api/status indicates queue_depth == 1
    status_resp = client.get("/api/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["queue_depth"] == 1

    # 3. Run worker to process the job
    worker = Worker(
        worker_id="test-e2e-worker",
        session_factory=session_factory,
    )
    did_process = worker.run_once()
    assert did_process is True

    # 4. Verify job is COMPLETED and queue_depth is now 0
    with session_factory() as session:
        job = session.execute(
            select(Job).where(
                Job.dispute_id == dispute_id,
                Job.kind == JobKind.SYNC_DISPUTE.value,
            )
        ).scalar_one()
        assert job.status == JobStatus.COMPLETED.value
        assert job.attempts == 1

    status_resp_after = client.get("/api/status")
    assert status_resp_after.json()["queue_depth"] == 0
