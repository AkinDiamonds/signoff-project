"""Dispute decision ledger and audit timeline API endpoints."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from agent.app.db.session import get_db_session
from agent.app.domain.enums import TimelineEventKind
from agent.app.ledger.service import get_decisions, get_timeline_events

router = APIRouter(prefix="/api/disputes", tags=["Timeline & Decisions"])


# --- Timeline Event Schemas ---


class BaseTimelineEvent(BaseModel):
    id: str
    dispute_id: str
    sequence_number: int
    created_at: str
    is_truncated: bool = False


class WebhookReceivedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.WEBHOOK_RECEIVED] = TimelineEventKind.WEBHOOK_RECEIVED
    payload: dict[str, Any] = Field(default_factory=dict)


class DisputeSyncedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.DISPUTE_SYNCED] = TimelineEventKind.DISPUTE_SYNCED
    status: str


class RunStartedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.RUN_STARTED] = TimelineEventKind.RUN_STARTED
    run_id: str


class EvidenceBuiltTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.EVIDENCE_BUILT] = TimelineEventKind.EVIDENCE_BUILT
    evidence_strength: str


class PlanProposedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.PLAN_PROPOSED] = TimelineEventKind.PLAN_PROPOSED
    action_type: str


class GateDecidedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.GATE_DECIDED] = TimelineEventKind.GATE_DECIDED
    verdict: str
    rule_id: str


class ApprovalRequestedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.APPROVAL_REQUESTED] = TimelineEventKind.APPROVAL_REQUESTED
    token_hash: str


class ApprovalResolvedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.APPROVAL_RESOLVED] = TimelineEventKind.APPROVAL_RESOLVED
    resolution: str


class ExecutionIntendedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.EXECUTION_INTENDED] = TimelineEventKind.EXECUTION_INTENDED
    action_type: str


class ExecutionSentTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.EXECUTION_SENT] = TimelineEventKind.EXECUTION_SENT
    payload: dict[str, Any] = Field(default_factory=dict)


class ExecutionConfirmedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.EXECUTION_CONFIRMED] = TimelineEventKind.EXECUTION_CONFIRMED
    external_id: str


class ExecutionFailedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.EXECUTION_FAILED] = TimelineEventKind.EXECUTION_FAILED
    error_message: str


class InjectionFlaggedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.INJECTION_FLAGGED] = TimelineEventKind.INJECTION_FLAGGED
    rule_id: str


class NoActionTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.NO_ACTION] = TimelineEventKind.NO_ACTION
    reason: str


class RunFailedTimelineEvent(BaseTimelineEvent):
    kind: Literal[TimelineEventKind.RUN_FAILED] = TimelineEventKind.RUN_FAILED
    error: str


class UnknownTimelineEvent(BaseTimelineEvent):
    kind: str
    payload: dict[str, Any] = Field(default_factory=dict)


TimelineEvent = Annotated[
    WebhookReceivedTimelineEvent
    | DisputeSyncedTimelineEvent
    | RunStartedTimelineEvent
    | EvidenceBuiltTimelineEvent
    | PlanProposedTimelineEvent
    | GateDecidedTimelineEvent
    | ApprovalRequestedTimelineEvent
    | ApprovalResolvedTimelineEvent
    | ExecutionIntendedTimelineEvent
    | ExecutionSentTimelineEvent
    | ExecutionConfirmedTimelineEvent
    | ExecutionFailedTimelineEvent
    | InjectionFlaggedTimelineEvent
    | NoActionTimelineEvent
    | RunFailedTimelineEvent
    | UnknownTimelineEvent,
    Field(),
]


class TimelineResponse(BaseModel):
    items: list[TimelineEvent]
    next_cursor: str | None = None


# --- Decisions Schemas ---


class DecisionItem(BaseModel):
    id: str
    dispute_id: str
    action_type: str
    action_payload: dict[str, Any] | None = None
    verdict: str
    rule_id: str
    reason: str
    also_triggered: list[str] = Field(default_factory=list)
    action_hash: str
    dispute_fingerprint: str
    charter_version: int
    created_at: str
    is_truncated: bool = False


class DecisionsResponse(BaseModel):
    items: list[DecisionItem]
    next_cursor: str | None = None


# --- Endpoints ---


@router.get(
    "/{id}/timeline",
    response_model=TimelineResponse,
    summary="Get dispute timeline events",
    description="Returns strictly ordered timeline events by sequence number with cursor pagination.",
)
async def get_dispute_timeline(
    id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit")] = 50,
    cursor: Annotated[str | None, Query(description="Opaque pagination cursor")] = None,
) -> TimelineResponse:
    items, next_cursor = get_timeline_events(
        session=db_session,
        dispute_id=id,
        limit=limit,
        cursor=cursor,
    )
    return TimelineResponse(items=items, next_cursor=next_cursor)


@router.get(
    "/{id}/decisions",
    response_model=DecisionsResponse,
    summary="Get dispute gate decisions",
    description="Returns decisions recorded for a dispute with cursor pagination.",
)
async def get_dispute_decisions(
    id: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit")] = 50,
    cursor: Annotated[str | None, Query(description="Cursor opaque string")] = None,
) -> DecisionsResponse:
    items, next_cursor = get_decisions(
        session=db_session,
        dispute_id=id,
        limit=limit,
        cursor=cursor,
    )
    return DecisionsResponse(items=items, next_cursor=next_cursor)
