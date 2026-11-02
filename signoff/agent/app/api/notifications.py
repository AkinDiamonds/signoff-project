"""Owner-only in-app notifications; reads and writes use the owner boundary."""
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agent.app.db.models import Notification
from agent.app.db.session import get_db_session
from agent.app.errors import NotFoundError

router = APIRouter(prefix='/api/notifications', tags=['Notifications'])


class NotificationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    dispute_id: str
    kind: str
    message: str
    created_at: datetime
    read_at: datetime | None


class NotificationPage(BaseModel):
    items: list[NotificationItem]
    unread_count: int
    next_offset: int | None


class NotificationReadRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    read: bool


@router.get('', response_model=NotificationPage)
def list_notifications(db: Annotated[Session, Depends(get_db_session)],
                       limit: Annotated[int, Query(ge=1, le=100)] = 25,
                       offset: Annotated[int, Query(ge=0, le=10000)] = 0) -> NotificationPage:
    # Single owner production inbox; demo-session records are not exposed here.
    scope = Notification.demo_session_id.is_(None)
    rows = list(db.scalars(select(Notification).where(scope).order_by(
        Notification.created_at.desc(), Notification.id.desc()).offset(offset).limit(limit + 1)))
    unread = db.scalar(select(func.count(Notification.id)).where(scope, Notification.read_at.is_(None))) or 0
    return NotificationPage(items=[NotificationItem.model_validate(row) for row in rows[:limit]],
                            unread_count=unread, next_offset=offset + limit if len(rows) > limit else None)


@router.post('/{notification_id}/read', response_model=NotificationItem)
def set_read(notification_id: uuid.UUID, body: NotificationReadRequest,
             db: Annotated[Session, Depends(get_db_session)]) -> NotificationItem:
    row = db.scalar(select(Notification).where(Notification.id == notification_id,
                    Notification.demo_session_id.is_(None)).with_for_update())
    if row is None:
        raise NotFoundError('Notification not found')
    if body.read and row.read_at is None:
        row.read_at = datetime.now(UTC)
    elif not body.read:
        row.read_at = None
    db.commit()
    db.refresh(row)
    return NotificationItem.model_validate(row)
