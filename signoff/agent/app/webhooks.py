"""PayPal webhook receiver endpoint.

Fulfills Step 07 requirements:
- POST /webhooks/paypal reading raw body before parsing.
- Enforces body size cap (512 KB, HTTP 413).
- Signature verification (API or stub verifier).
- Missing headers -> 400, Invalid signature -> 400, Service unavailable -> 503.
- Webhook id mismatch -> 400.
- Single-transaction deduplication and job queueing.
- Duplicate delivery -> 200, no second job.
- Twenty concurrent identical posts -> one row, one job.
- Unknown/unhandled event types -> 200 and ignored (stored, no job).
- Disputes outside our merchant -> 200 (stored, no job).
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from agent.app.db.models import Job, WebhookEvent
from agent.app.db.session import get_db_session
from agent.app.domain.enums import JobKind, JobStatus, TimelineEventKind
from agent.app.ledger.service import record_ledger_event
from agent.app.paypal.webhook_verify import (
    PayloadTooLargeError,
    WebhookVerifier,
    get_webhook_verifier,
)
from agent.app.settings import Settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Webhooks"])

# 512 KB maximum payload size cap
MAX_WEBHOOK_BODY_BYTES = 512 * 1024

HANDLED_DISPUTE_EVENT_TYPES = frozenset(
    {
        "CUSTOMER.DISPUTE.CREATED",
        "CUSTOMER.DISPUTE.UPDATED",
        "CUSTOMER.DISPUTE.RESOLVED",
    }
)


@router.post(
    "/webhooks/paypal",
    status_code=status.HTTP_200_OK,
    summary="PayPal Webhook Event Ingestion",
    description=(
        "Safely ingests and verifies incoming PayPal webhook notifications, "
        "deduplicating events and enqueuing sync jobs transactionally."
    ),
)
async def paypal_webhook_receiver(
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    verifier: Annotated[WebhookVerifier, Depends(get_webhook_verifier)],
) -> dict[str, Any]:
    """Ingest, verify, deduplicate, and enqueue PayPal webhook events."""
    # 1. Enforce payload size cap before reading/parsing
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_WEBHOOK_BODY_BYTES:
                raise PayloadTooLargeError(
                    f"Content-Length exceeds maximum size of {MAX_WEBHOOK_BODY_BYTES} bytes"
                )
        except ValueError:
            pass

    raw_body = await request.body()
    if len(raw_body) > MAX_WEBHOOK_BODY_BYTES:
        raise PayloadTooLargeError(
            f"Payload body size ({len(raw_body)} bytes) exceeds maximum limit of {MAX_WEBHOOK_BODY_BYTES} bytes"
        )

    # 2. Verify signature and parse typed envelope
    verified = await verifier.verify(request.headers, raw_body)

    # 3. Check for existing event (duplicate delivery)
    existing_event = db_session.get(WebhookEvent, verified.event_id)
    if existing_event:
        logger.info(
            "Duplicate webhook delivery received; returning 200 without enqueuing job",
            extra={"event_id": verified.event_id, "event_type": verified.event_type},
        )
        return {
            "status": "ok",
            "message": "duplicate delivery",
            "event_id": verified.event_id,
        }

    # Retrieve application settings for merchant scoping check
    app_settings: Settings = request.app.state.settings
    expected_merchant = app_settings.paypal_merchant_id.strip() if app_settings.paypal_merchant_id else None

    # 4. Check if event is an outside merchant dispute
    seller_merchant_id = verified.merchant_id
    if expected_merchant and seller_merchant_id and seller_merchant_id != expected_merchant:
        # Outside merchant: store event, no job
        event_record = WebhookEvent(
            id=verified.event_id,
            transmission_id=verified.transmission_id,
            event_type=verified.event_type,
            resource_type=verified.resource_type,
            raw_payload=verified.raw_payload,
            verified=True,
        )
        db_session.add(event_record)
        try:
            db_session.commit()
        except IntegrityError:
            db_session.rollback()
        logger.info(
            "Dispute webhook event belongs to external merchant; stored without enqueuing job",
            extra={
                "event_id": verified.event_id,
                "seller_merchant_id": seller_merchant_id,
                "expected_merchant": expected_merchant,
            },
        )
        return {
            "status": "ok",
            "message": "dispute outside merchant; stored without job",
            "event_id": verified.event_id,
        }

    # 5. Check if event type is unhandled/unknown
    if verified.event_type not in HANDLED_DISPUTE_EVENT_TYPES:
        # Record event in db, do not enqueue job, respond 200 quickly
        event_record = WebhookEvent(
            id=verified.event_id,
            transmission_id=verified.transmission_id,
            event_type=verified.event_type,
            resource_type=verified.resource_type,
            raw_payload=verified.raw_payload,
            verified=True,
        )
        db_session.add(event_record)
        try:
            db_session.commit()
        except IntegrityError:
            db_session.rollback()
        logger.info(
            "Recorded unhandled webhook event type; responded 200 without job",
            extra={"event_id": verified.event_id, "event_type": verified.event_type},
        )
        return {
            "status": "ok",
            "message": "unhandled event type; stored without job",
            "event_id": verified.event_id,
        }

    # 6. Handled dispute event: in one transaction, insert event and enqueue sync job
    event_record = WebhookEvent(
        id=verified.event_id,
        transmission_id=verified.transmission_id,
        event_type=verified.event_type,
        resource_type=verified.resource_type,
        raw_payload=verified.raw_payload,
        verified=True,
    )
    try:
        db_session.add(event_record)

        dispute_id = verified.dispute_id
        if dispute_id:
            # Emit WEBHOOK_RECEIVED ledger event as the first event in the audit chain
            record_ledger_event(
                session=db_session,
                dispute_id=dispute_id,
                event_kind=TimelineEventKind.WEBHOOK_RECEIVED,
                payload={
                    "event_id": verified.event_id,
                    "event_type": verified.event_type,
                },
            )

            existing_job = db_session.execute(
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
                        "event_id": verified.event_id,
                        "event_type": verified.event_type,
                        "dispute_id": dispute_id,
                    },
                )
                db_session.add(sync_job)
        db_session.commit()
        logger.info(
            "Webhook processed successfully; sync job enqueued",
            extra={"event_id": verified.event_id, "dispute_id": dispute_id},
        )
        return {
            "status": "ok",
            "event_id": verified.event_id,
            "dispute_id": dispute_id,
        }
    except IntegrityError:
        # Handles concurrent posts of the identical event
        db_session.rollback()
        existing = db_session.execute(
            select(WebhookEvent).where(
                (WebhookEvent.id == verified.event_id)
                | (WebhookEvent.transmission_id == verified.transmission_id)
            )
        ).scalar_one_or_none()
        if existing:
            logger.info(
                "Concurrent duplicate webhook detected; deduplicated safely",
                extra={"event_id": verified.event_id},
            )
            return {
                "status": "ok",
                "message": "duplicate delivery",
                "event_id": verified.event_id,
            }
        raise
