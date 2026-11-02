"""Owner-only, CSRF-protected opt-in; no public/demo subscription capability."""

import hashlib
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agent.app.db.models import Dispute, Notification, NotificationOutbox, PushDelivery, PushSubscription
from agent.app.db.session import get_db_session
from agent.app.errors import AppError
from agent.app.notifications.push import configured, validate_endpoint, validate_keys
from agent.app.settings import Settings

router = APIRouter(prefix='/api/push', tags=['Phone notifications'])


class PushConfig(BaseModel):
    available: bool
    public_key: str | None
    pending_deliveries: int = 0
    failed_deliveries: int = 0


class SubscriptionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', hide_input_in_errors=True)
    endpoint: str = Field(max_length=2048)
    p256dh: str = Field(max_length=128)
    auth: str = Field(max_length=64)

    @field_validator('endpoint')
    @classmethod
    def valid_endpoint(cls, value: str) -> str:
        return validate_endpoint(value)

    @model_validator(mode='after')
    def valid_keys(self) -> 'SubscriptionRequest':
        validate_keys(self.p256dh, self.auth)
        return self


class SubscriptionResult(BaseModel):
    id: uuid.UUID
    active: bool


class RemoveSubscriptionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    endpoint: str = Field(max_length=2048)


class PhoneTestRequest(RemoveSubscriptionRequest):
    dispute_id: str = Field(min_length=1, max_length=100)
    request_id: uuid.UUID


@router.post('/test', status_code=202)
def queue_phone_test(body: PhoneTestRequest, request: Request,
                     db: Annotated[Session, Depends(get_db_session)]) -> dict[str, bool]:
    settings: Settings = request.app.state.settings
    if not configured(settings):
        raise AppError('PUSH_UNAVAILABLE', 'Phone notifications need server setup', status_code=503)
    dispute = db.scalar(select(Dispute).where(Dispute.id == body.dispute_id, Dispute.demo_session_id.is_(None)))
    digest = hashlib.sha256(body.endpoint.encode()).hexdigest()
    subscription = db.scalar(select(PushSubscription).where(
        PushSubscription.endpoint_hash == digest, PushSubscription.active.is_(True),
        PushSubscription.vapid_key == settings.web_push_vapid_public_key,
    ).with_for_update())
    if dispute is None or subscription is None:
        raise AppError('NOT_FOUND', 'Dispute or notification device not found', status_code=404)
    key = hashlib.sha256(f'owner:phone-test:{subscription.id}:{body.request_id}'.encode()).hexdigest()
    if db.scalar(select(Notification.id).where(Notification.dedupe_key == key)) is not None:
        return {'queued': True}
    from datetime import UTC, datetime, timedelta

    recent = db.scalar(select(Notification.id).join(PushDelivery, Notification.id == PushDelivery.notification_id)
                       .where(PushDelivery.subscription_id == subscription.id, Notification.kind == 'phone_test',
                              Notification.created_at > datetime.now(UTC) - timedelta(minutes=1)).limit(1))
    if recent is not None:
        raise AppError('PUSH_RATE_LIMIT', 'Wait a minute before sending another phone test', status_code=429)
    item = Notification(dispute_id=dispute.id, kind='phone_test', dedupe_key=key,
                        message='Phone notification test for this dispute.')
    db.add(item)
    db.flush()
    # Deliberately targets only this opted-in device; no PayPal/job/executor path.
    db.add(PushDelivery(notification_id=item.id, subscription_id=subscription.id, state='pending', attempts=0))
    db.add(NotificationOutbox(notification_id=item.id, state='expanded', attempts=0))
    db.commit()
    return {'queued': True}


@router.post('/subscriptions/remove', status_code=204)
def remove_subscription(body: RemoveSubscriptionRequest,
                        db: Annotated[Session, Depends(get_db_session)]) -> None:
    # Browser storage can be cleared independently of a PushManager subscription.
    # Revoke by endpoint hash without re-enabling or exposing another device.
    digest = hashlib.sha256(body.endpoint.encode()).hexdigest()
    row = db.scalar(select(PushSubscription).where(PushSubscription.endpoint_hash == digest).with_for_update())
    if row is not None:
        row.active = False
        row.endpoint, row.p256dh, row.auth = '', '', ''
        db.commit()


@router.get('/config', response_model=PushConfig)
def get_config(request: Request, db: Annotated[Session, Depends(get_db_session)]) -> PushConfig:
    settings: Settings = request.app.state.settings
    available = configured(settings)
    pending = db.scalar(select(func.count(PushDelivery.id)).where(
        PushDelivery.state.in_(['pending', 'delivering']))) or 0
    failed = db.scalar(select(func.count(PushDelivery.id)).where(PushDelivery.state == 'failed')) or 0
    return PushConfig(available=available, public_key=settings.web_push_vapid_public_key if available else None,
                      pending_deliveries=pending, failed_deliveries=failed)


@router.post('/subscriptions', response_model=SubscriptionResult)
def subscribe(body: SubscriptionRequest, request: Request,
              db: Annotated[Session, Depends(get_db_session)]) -> SubscriptionResult:
    settings: Settings = request.app.state.settings
    if not configured(settings):
        raise AppError('PUSH_UNAVAILABLE', 'Phone notifications need server setup', status_code=503)
    digest = hashlib.sha256(body.endpoint.encode()).hexdigest()
    # Serializes duplicate browser requests across API instances, without logging endpoint URLs.
    if db.get_bind().dialect.name == 'postgresql':
        db.execute(select(func.pg_advisory_xact_lock(func.hashtext('push:' + digest))))
    row = db.scalar(select(PushSubscription).where(PushSubscription.endpoint_hash == digest).with_for_update())
    if row is None:
        count = db.scalar(select(func.count(PushSubscription.id)).where(PushSubscription.active.is_(True))) or 0
        if count >= 20:
            raise AppError('PUSH_LIMIT', 'Too many notification devices; remove an old device first', status_code=409)
        row = PushSubscription(endpoint_hash=digest, endpoint=body.endpoint,
                               p256dh=body.p256dh, auth=body.auth, vapid_key=settings.web_push_vapid_public_key)
        db.add(row)
    else:
        row.endpoint, row.p256dh, row.auth = body.endpoint, body.p256dh, body.auth
        row.vapid_key, row.active = settings.web_push_vapid_public_key, True
        # Re-opt-in must not cause a backlog of notifications from a prior opt-in.
        row.created_at = func.now()
    db.commit()
    db.refresh(row)
    return SubscriptionResult(id=row.id, active=row.active)


@router.delete('/subscriptions/{subscription_id}', status_code=204)
def unsubscribe(subscription_id: uuid.UUID, db: Annotated[Session, Depends(get_db_session)]) -> None:
    row = db.get(PushSubscription, subscription_id)
    if row is not None:
        row.active = False
        row.endpoint, row.p256dh, row.auth = '', '', ''
        db.commit()
