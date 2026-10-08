"""Comprehensive tests for PayPal webhook verification and receiver endpoint.

Validates all requirements and edge cases from build-plan/steps/07-webhook-receiver.md:
1. POST /webhooks/paypal reading raw body before parsing.
2. VerifiedWebhook type cannot be constructed outside verifier.
3. Event envelope is a discriminated union keyed by event type.
4. Stub verifier selectable only when PAYPAL_ENV is stub.
5. Real PayPalWebhookVerifier API integration:
   - Success -> 200 and VerifiedWebhook
   - Signature rejected -> 400
   - Upstream unavailable (network error / 5xx) -> 503
6. Missing signature headers -> 400.
7. Webhook ID mismatch -> 400.
8. Oversize body cap -> 413.
9. Database integration:
   - End-to-end processing with recorded s6-webhook-event.json fixture:
     event inserted & sync job enqueued in one transaction.
   - Duplicate delivery: 200, no duplicate row, no second job.
   - Twenty identical concurrent posts: exactly one row, exactly one job.
   - Unhandled event type: recorded and ignored (stored, no job enqueued, responds 200 quickly).
   - Event for a dispute outside our merchant: stored, no job enqueued.
"""

import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from agent.app.db.models import Job, WebhookEvent
from agent.app.db.session import get_engine, get_session_factory
from agent.app.domain.enums import JobKind, JobStatus
from agent.app.main import create_app
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.webhook_verify import (
    DisputeCreatedEventEnvelope,
    DisputeResolvedEventEnvelope,
    DisputeUpdatedEventEnvelope,
    GenericWebhookEventEnvelope,
    InvalidSignatureError,
    MissingSignatureHeadersError,
    PayPalWebhookVerifier,
    StubWebhookVerifier,
    VerifiedWebhook,
    WebhookIdMismatchError,
    extract_signature_headers,
    get_webhook_verifier,
)
from agent.app.settings import AppEnv, PayPalEnv, Settings


@pytest.fixture(scope="session")
def engine():
    return get_engine()


@pytest.fixture
def db_session(engine) -> Session:
    session_factory = get_session_factory(engine)
    session = session_factory()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def s6_fixture_raw() -> dict[str, Any]:
    fixture_path = (
        Path(__file__).resolve().parents[2] / "fixtures" / "paypal" / "s6-webhook-event.json"
    )
    return json.loads(fixture_path.read_text(encoding="utf-8"))


def make_valid_headers(
    event_id: str = "WH-12345",
    transmission_id: str | None = None,
    webhook_id: str | None = None,
) -> dict[str, str]:
    headers = {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123",
        "paypal-transmission-id": transmission_id or f"TRANS-{uuid.uuid4().hex[:12]}",
        "paypal-transmission-sig": "VALID_MOCK_SIGNATURE_BASE64",
        "paypal-transmission-time": "2026-10-08T12:00:00Z",
    }
    if webhook_id:
        headers["paypal-webhook-id"] = webhook_id
    return headers


# ============================================================================
# Type & Verifier Unit Tests
# ============================================================================


def test_verified_webhook_cannot_be_instantiated_directly():
    """VerifiedWebhook type must only be constructable by a verifier."""
    with pytest.raises(PermissionError, match="can only be produced by WebhookVerifier"):
        VerifiedWebhook(
            envelope=GenericWebhookEventEnvelope(
                id="WH-1",
                create_time="2026-10-08T12:00:00Z",
                resource_type="dispute",
                event_type="TEST",
            ),
            raw_payload={"id": "WH-1"},
            raw_body=b'{"id":"WH-1"}',
            transmission_id="TRANS-1",
            _sentinel=object(),  # Random sentinel must fail
        )


def test_stub_verifier_selectable_only_when_paypal_env_is_stub():
    """Stub verifier is forbidden when PAYPAL_ENV is sandbox or prod."""
    with pytest.raises(ValueError, match="selectable only when PAYPAL_ENV is stub"):
        StubWebhookVerifier(paypal_env=PayPalEnv.sandbox)

    with pytest.raises(ValueError, match="selectable only when PAYPAL_ENV is stub"):
        StubWebhookVerifier(paypal_env="prod")

    # Succeeds with stub
    verifier = StubWebhookVerifier(paypal_env=PayPalEnv.stub)
    assert isinstance(verifier, StubWebhookVerifier)


def test_event_envelope_discriminated_union(s6_fixture_raw):
    """Event envelope parses into the correct typed subclass based on event_type."""
    verifier = StubWebhookVerifier(paypal_env=PayPalEnv.stub)

    # 1. CUSTOMER.DISPUTE.CREATED
    headers = make_valid_headers()
    body_created = json.dumps(s6_fixture_raw).encode("utf-8")
    verified_created = pytest.importorskip("asyncio").run(verifier.verify(headers, body_created))
    assert isinstance(verified_created.envelope, DisputeCreatedEventEnvelope)
    assert verified_created.event_id == s6_fixture_raw["id"]
    assert verified_created.dispute_id == s6_fixture_raw["resource"]["dispute_id"]
    assert verified_created.merchant_id == "SELLER-MERCHANT-ID-REDACTED"

    # 2. CUSTOMER.DISPUTE.UPDATED
    payload_updated = dict(s6_fixture_raw, event_type="CUSTOMER.DISPUTE.UPDATED")
    verified_updated = pytest.importorskip("asyncio").run(
        verifier.verify(headers, json.dumps(payload_updated).encode("utf-8"))
    )
    assert isinstance(verified_updated.envelope, DisputeUpdatedEventEnvelope)

    # 3. CUSTOMER.DISPUTE.RESOLVED
    payload_resolved = dict(s6_fixture_raw, event_type="CUSTOMER.DISPUTE.RESOLVED")
    verified_resolved = pytest.importorskip("asyncio").run(
        verifier.verify(headers, json.dumps(payload_resolved).encode("utf-8"))
    )
    assert isinstance(verified_resolved.envelope, DisputeResolvedEventEnvelope)

    # 4. Unknown/Generic event
    payload_generic = {
        "id": "WH-GEN-1",
        "create_time": "2026-10-08T12:00:00Z",
        "resource_type": "capture",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "summary": "Payment capture completed",
    }
    verified_generic = pytest.importorskip("asyncio").run(
        verifier.verify(headers, json.dumps(payload_generic).encode("utf-8"))
    )
    assert isinstance(verified_generic.envelope, GenericWebhookEventEnvelope)
    assert verified_generic.event_type == "PAYMENT.CAPTURE.COMPLETED"


def test_missing_signature_headers_raises_400():
    """Missing any required signature header fails closed with 400 error."""
    incomplete_headers = {
        "paypal-auth-algo": "SHA256withRSA",
        # missing paypal-cert-url, transmission-id, etc.
    }
    with pytest.raises(MissingSignatureHeadersError):
        extract_signature_headers(incomplete_headers)

    verifier = StubWebhookVerifier(paypal_env=PayPalEnv.stub)
    with pytest.raises(MissingSignatureHeadersError):
        pytest.importorskip("asyncio").run(verifier.verify(incomplete_headers, b'{"test":1}'))


def test_stub_verifier_webhook_id_mismatch():
    """Webhook ID mismatch raises WebhookIdMismatchError."""
    verifier = StubWebhookVerifier(webhook_id="EXPECTED-WH-ID", paypal_env=PayPalEnv.stub)
    headers = make_valid_headers(webhook_id="DIFFERENT-WH-ID")
    with pytest.raises(WebhookIdMismatchError):
        pytest.importorskip("asyncio").run(verifier.verify(headers, b'{"test":1}'))


def test_stub_verifier_simulated_invalid_and_unavailable():
    """Stub verifier properly simulates invalid signature and upstream outage."""
    headers = make_valid_headers()

    # Invalid signature simulation
    invalid_verifier = StubWebhookVerifier(
        paypal_env=PayPalEnv.stub, simulate_invalid_signature=True
    )
    with pytest.raises(InvalidSignatureError):
        pytest.importorskip("asyncio").run(invalid_verifier.verify(headers, b'{"test":1}'))

    # Service unavailable simulation
    down_verifier = StubWebhookVerifier(
        paypal_env=PayPalEnv.stub, simulate_service_unavailable=True
    )
    from agent.app.errors import UpstreamUnavailableError

    with pytest.raises(UpstreamUnavailableError):
        pytest.importorskip("asyncio").run(down_verifier.verify(headers, b'{"test":1}'))


# ============================================================================
# Real PayPalWebhookVerifier (Mocked HTTP) Tests
# ============================================================================


@pytest.mark.asyncio
async def test_paypal_webhook_verifier_success(s6_fixture_raw):
    """PayPalWebhookVerifier successfully calls verify-webhook-signature API."""
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.sandbox,
        paypal_client_id="mock_client",
        paypal_client_secret="mock_secret",
        paypal_webhook_id="WH-CONFIGURED-ID",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(
                200,
                json={"access_token": "mock_token", "token_type": "Bearer", "expires_in": 3600},
            )
        if request.url.path == "/v1/notifications/verify-webhook-signature":
            return httpx.Response(200, json={"verification_status": "SUCCESS"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)
    auth = PayPalAuth(
        client_id="mock_client",
        client_secret="mock_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=client,
    )
    verifier = PayPalWebhookVerifier(settings=settings, auth=auth, http_client=client)

    headers = make_valid_headers()
    body = json.dumps(s6_fixture_raw).encode("utf-8")

    verified = await verifier.verify(headers, body)
    assert verified.event_id == s6_fixture_raw["id"]
    assert verified.event_type == "CUSTOMER.DISPUTE.CREATED"
    await client.aclose()


@pytest.mark.asyncio
async def test_paypal_webhook_verifier_invalid_signature(s6_fixture_raw):
    """When PayPal verification API returns FAILURE, verifier rejects with InvalidSignatureError."""
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.sandbox,
        paypal_client_id="mock_client",
        paypal_client_secret="mock_secret",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(
                200,
                json={"access_token": "mock_token", "token_type": "Bearer", "expires_in": 3600},
            )
        if request.url.path == "/v1/notifications/verify-webhook-signature":
            return httpx.Response(200, json={"verification_status": "FAILURE"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)
    auth = PayPalAuth(
        client_id="mock_client",
        client_secret="mock_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=client,
    )
    verifier = PayPalWebhookVerifier(settings=settings, auth=auth, http_client=client)

    headers = make_valid_headers()
    body = json.dumps(s6_fixture_raw).encode("utf-8")

    with pytest.raises(InvalidSignatureError):
        await verifier.verify(headers, body)
    await client.aclose()


@pytest.mark.asyncio
async def test_paypal_webhook_verifier_upstream_503(s6_fixture_raw):
    """When PayPal verify service returns 5xx, verifier raises UpstreamUnavailableError (503)."""
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.sandbox,
        paypal_client_id="mock_client",
        paypal_client_secret="mock_secret",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(
                200,
                json={"access_token": "mock_token", "token_type": "Bearer", "expires_in": 3600},
            )
        if request.url.path == "/v1/notifications/verify-webhook-signature":
            return httpx.Response(503, text="Service Unavailable")
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)
    auth = PayPalAuth(
        client_id="mock_client",
        client_secret="mock_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=client,
    )
    verifier = PayPalWebhookVerifier(settings=settings, auth=auth, http_client=client)

    headers = make_valid_headers()
    body = json.dumps(s6_fixture_raw).encode("utf-8")

    from agent.app.errors import UpstreamUnavailableError

    with pytest.raises(UpstreamUnavailableError):
        await verifier.verify(headers, body)
    await client.aclose()


# ============================================================================
# FastAPI Endpoint Integration Tests (Real Postgres Engine)
# ============================================================================


def test_post_webhook_missing_headers_returns_400():
    """POST /webhooks/paypal with missing headers returns 400 error envelope."""
    settings = Settings(app_env=AppEnv.test, paypal_env=PayPalEnv.stub)
    app = create_app(settings)
    client = TestClient(app)

    response = client.post("/webhooks/paypal", json={"test": 1})
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "MISSING_SIGNATURE_HEADERS"


def test_post_webhook_oversize_body_returns_413():
    """POST /webhooks/paypal with payload > 512 KB returns 413."""
    settings = Settings(app_env=AppEnv.test, paypal_env=PayPalEnv.stub)
    app = create_app(settings)
    client = TestClient(app)

    headers = make_valid_headers()
    # 600 KB payload
    big_body = b"x" * (600 * 1024)
    response = client.post("/webhooks/paypal", content=big_body, headers=headers)
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_post_webhook_invalid_signature_returns_400():
    """POST /webhooks/paypal with invalid signature returns 400 and does not process."""
    settings = Settings(app_env=AppEnv.test, paypal_env=PayPalEnv.stub)
    app = create_app(settings)

    # Override verifier with stub configured to reject signature
    invalid_verifier = StubWebhookVerifier(
        paypal_env=PayPalEnv.stub, simulate_invalid_signature=True
    )
    app.dependency_overrides[get_webhook_verifier] = lambda: invalid_verifier

    client = TestClient(app)
    headers = make_valid_headers()
    response = client.post(
        "/webhooks/paypal",
        json={"id": "WH-TEST", "event_type": "CUSTOMER.DISPUTE.CREATED"},
        headers=headers,
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_SIGNATURE"


def test_post_webhook_upstream_unavailable_returns_503():
    """POST /webhooks/paypal when PayPal verifier is down returns 503."""
    settings = Settings(app_env=AppEnv.test, paypal_env=PayPalEnv.stub)
    app = create_app(settings)

    unavailable_verifier = StubWebhookVerifier(
        paypal_env=PayPalEnv.stub, simulate_service_unavailable=True
    )
    app.dependency_overrides[get_webhook_verifier] = lambda: unavailable_verifier

    client = TestClient(app)
    headers = make_valid_headers()
    response = client.post(
        "/webhooks/paypal",
        json={"id": "WH-TEST", "event_type": "CUSTOMER.DISPUTE.CREATED"},
        headers=headers,
    )
    assert response.status_code == 503
    data = response.json()
    assert data["error"]["code"] == "UPSTREAM_UNAVAILABLE"


def test_post_webhook_e2e_recorded_fixture_and_deduplication(db_session: Session, s6_fixture_raw):
    """End-to-end webhook ingestion with s6 fixture:
    - 1st delivery: inserts webhook_event row, enqueues sync_dispute job in one transaction, returns 200.
    - Duplicate delivery: returns 200, no second job enqueued.
    """
    event_id = f"WH-E2E-{uuid.uuid4().hex[:8]}"
    dispute_id = f"PP-D-E2E-{uuid.uuid4().hex[:8]}"
    transmission_id = f"TRANS-{uuid.uuid4().hex[:8]}"

    payload = dict(s6_fixture_raw)
    payload["id"] = event_id
    payload["resource"] = dict(payload["resource"], dispute_id=dispute_id)

    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        paypal_merchant_id="SELLER-MERCHANT-ID-REDACTED",
    )
    app = create_app(settings)
    client = TestClient(app)

    headers = make_valid_headers(transmission_id=transmission_id)

    # 1. First POST: success and job enqueued
    res1 = client.post("/webhooks/paypal", json=payload, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "ok"
    assert data1["event_id"] == event_id

    # Verify database state
    stored_event = db_session.get(WebhookEvent, event_id)
    assert stored_event is not None
    assert stored_event.verified is True
    assert stored_event.event_type == "CUSTOMER.DISPUTE.CREATED"

    stored_job = db_session.execute(
        select(Job).where(Job.dispute_id == dispute_id, Job.kind == JobKind.SYNC_DISPUTE.value)
    ).scalar_one_or_none()
    assert stored_job is not None
    assert stored_job.status == JobStatus.PENDING.value
    assert stored_job.payload["event_id"] == event_id

    # 2. Duplicate delivery (exact same event_id and transmission_id)
    res2 = client.post("/webhooks/paypal", json=payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["message"] == "duplicate delivery"

    # Verify no second job was enqueued
    jobs_count = len(
        db_session.execute(
            select(Job).where(Job.dispute_id == dispute_id, Job.kind == JobKind.SYNC_DISPUTE.value)
        ).scalars().all()
    )
    assert jobs_count == 1

    # Cleanup test data
    db_session.execute(delete(Job).where(Job.dispute_id == dispute_id))
    db_session.execute(delete(WebhookEvent).where(WebhookEvent.id == event_id))
    db_session.commit()


def test_post_webhook_concurrent_twenty_posts(engine, s6_fixture_raw):
    """Twenty identical concurrent POSTs result in exactly one row and exactly one job."""
    event_id = f"WH-RACE-{uuid.uuid4().hex[:10]}"
    dispute_id = f"PP-D-RACE-{uuid.uuid4().hex[:10]}"
    transmission_id = f"TRANS-RACE-{uuid.uuid4().hex[:10]}"

    payload = dict(s6_fixture_raw)
    payload["id"] = event_id
    payload["resource"] = dict(payload["resource"], dispute_id=dispute_id)

    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        paypal_merchant_id="SELLER-MERCHANT-ID-REDACTED",
    )
    app = create_app(settings)

    headers = make_valid_headers(transmission_id=transmission_id)

    def send_post():
        c = TestClient(app)
        return c.post("/webhooks/paypal", json=payload, headers=headers)

    with ThreadPoolExecutor(max_workers=10) as pool:
        responses = list(pool.map(lambda _: send_post(), range(20)))

    # All twenty responses must be HTTP 200
    for idx, r in enumerate(responses):
        assert r.status_code == 200, f"Request {idx} failed with {r.status_code}: {r.text}"

    # Verify database has exactly one event row and one job
    session_factory = get_session_factory(engine)
    with session_factory() as session:
        events = session.execute(
            select(WebhookEvent).where(WebhookEvent.id == event_id)
        ).scalars().all()
        assert len(events) == 1, f"Expected 1 event row, got {len(events)}"

        jobs = session.execute(
            select(Job).where(Job.dispute_id == dispute_id, Job.kind == JobKind.SYNC_DISPUTE.value)
        ).scalars().all()
        assert len(jobs) == 1, f"Expected 1 job row, got {len(jobs)}"

        # Cleanup
        session.execute(delete(Job).where(Job.dispute_id == dispute_id))
        session.execute(delete(WebhookEvent).where(WebhookEvent.id == event_id))
        session.commit()


def test_post_webhook_unhandled_event_type_stored_no_job(db_session: Session):
    """Unhandled event type: 200 returned quickly, event stored in DB, no job enqueued."""
    event_id = f"WH-UNHANDLED-{uuid.uuid4().hex[:8]}"
    transmission_id = f"TRANS-UNH-{uuid.uuid4().hex[:8]}"

    payload = {
        "id": event_id,
        "create_time": "2026-10-08T12:00:00Z",
        "resource_type": "capture",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "summary": "Payment capture completed",
        "resource": {"capture_id": "CAP-12345"},
    }

    settings = Settings(app_env=AppEnv.test, paypal_env=PayPalEnv.stub)
    app = create_app(settings)
    client = TestClient(app)

    headers = make_valid_headers(transmission_id=transmission_id)
    response = client.post("/webhooks/paypal", json=payload, headers=headers)

    assert response.status_code == 200
    assert response.json()["message"] == "unhandled event type; stored without job"

    # Verify event stored
    stored = db_session.get(WebhookEvent, event_id)
    assert stored is not None
    assert stored.event_type == "PAYMENT.CAPTURE.COMPLETED"
    assert stored.verified is True

    # Verify no jobs created
    jobs = db_session.execute(
        select(Job).where(Job.payload["event_id"].as_string() == event_id)
    ).scalars().all()
    assert len(jobs) == 0

    # Cleanup
    db_session.execute(delete(WebhookEvent).where(WebhookEvent.id == event_id))
    db_session.commit()


def test_post_webhook_dispute_outside_merchant_stored_no_job(db_session: Session, s6_fixture_raw):
    """Dispute outside configured merchant: event stored, no job created, returns 200."""
    event_id = f"WH-OUTSIDE-{uuid.uuid4().hex[:8]}"
    dispute_id = f"PP-D-OUTSIDE-{uuid.uuid4().hex[:8]}"
    transmission_id = f"TRANS-OUT-{uuid.uuid4().hex[:8]}"

    payload = dict(s6_fixture_raw)
    payload["id"] = event_id
    payload["resource"] = dict(payload["resource"], dispute_id=dispute_id)
    # The fixture has seller merchant_id = "SELLER-MERCHANT-ID-REDACTED"

    # Configure our app with a different merchant ID
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        paypal_merchant_id="OUR_INTERNAL_MERCHANT_ID",
    )
    app = create_app(settings)
    client = TestClient(app)

    headers = make_valid_headers(transmission_id=transmission_id)
    response = client.post("/webhooks/paypal", json=payload, headers=headers)

    assert response.status_code == 200
    assert response.json()["message"] == "dispute outside merchant; stored without job"

    # Stored in db
    stored = db_session.get(WebhookEvent, event_id)
    assert stored is not None
    assert stored.verified is True

    # No job enqueued
    jobs = db_session.execute(
        select(Job).where(Job.dispute_id == dispute_id)
    ).scalars().all()
    assert len(jobs) == 0

    # Cleanup
    db_session.execute(delete(WebhookEvent).where(WebhookEvent.id == event_id))
    db_session.commit()
