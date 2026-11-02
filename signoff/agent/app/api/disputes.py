"""Disputes query and detail API endpoints.

Per plan/04-frontend-spec.md and Step 21:
- GET /api/disputes (filters: status, reason, due-before; cursor pagination)
- GET /api/disputes/{id} (full detail with snapshot)
- Edge cases:
  * Invalid filters return 422.
  * Page size bounds enforced (1 <= limit <= 100).
  * Due-date sorting puts nulls last.
"""

import base64
from dataclasses import replace
from datetime import UTC, datetime
from functools import partial
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from agent.app.agent.evidence_snapshot import EvidenceSnapshotData, build_snapshot
from agent.app.agent.reasons import build_evidence_for
from agent.app.agent.reasons.history import count_buyer_disputes
from agent.app.approvals.service import DEMO_APPROVAL_LINKS, build_approval_card_response
from agent.app.db.models import Approval, Decision, Dispute, EvidenceSnapshot, Execution, ReviewEvidenceSnapshot
from agent.app.db.session import get_db_session
from agent.app.domain.enums import ApprovalResolution, DisputeReason, DisputeStatus, ExecutionStatus, Verdict
from agent.app.domain.money import Money
from agent.app.errors import NotFoundError
from agent.app.paypal.models import parse_dispute
from agent.app.policy.missing_evidence import evaluate_missing_delivery
from agent.app.settings import AppEnv, Settings
from agent.app.store.local_adapter import LocalStoreAdapter
from agent.app.store.resolution import ResolutionStatus, resolve_disputed_order
from agent.app.store.scope import order_scope
from agent.app.store_mock.repository import find_order_by_paypal_transaction_id

router = APIRouter(prefix="/api/disputes", tags=["Disputes"])


class DisputeListItem(BaseModel):
    """Dispute item for dashboard list and grids."""

    id: str
    status: DisputeStatus
    reason: DisputeReason
    amount: Money
    seller_response_due_date: datetime | None = None
    state_fingerprint: str
    created_at: datetime
    updated_at: datetime
    latest_verdict: Verdict | None = None
    latest_rule_id: str | None = None
    order_code: str | None = None
    order_resolution: ResolutionStatus = "not_found"


class DisputesResponse(BaseModel):
    """Paginated dispute list response."""

    items: list[DisputeListItem]
    next_cursor: str | None = None
    total_count: int | None = None


class DisputeDetailResponse(BaseModel):
    """Complete dispute details including raw snapshot."""

    id: str
    status: DisputeStatus
    reason: DisputeReason
    amount: Money
    seller_response_due_date: datetime | None = None
    state_fingerprint: str
    snapshot: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    latest_verdict: Verdict | None = None
    latest_rule_id: str | None = None
    order_code: str | None = None
    approval_url: str | None = None
    latest_approval_resolution: ApprovalResolution | None = None
    latest_execution_status: ExecutionStatus | Literal["QUEUED"] | None = None
    order_resolution: ResolutionStatus = "not_found"


class EvidenceSnapshotResponse(BaseModel):
    run_id: str
    capture_kind: Literal["model_run", "pre_model_review", "manual_refresh"] = "model_run"
    review_reason: str | None = None
    captured_at: datetime
    content_hash: str
    evidence: EvidenceSnapshotData


@router.get("/{id}/evidence", response_model=list[EvidenceSnapshotResponse])
def get_evidence_snapshots(
    id: str, db_session: Annotated[Session, Depends(get_db_session)],
) -> list[EvidenceSnapshotResponse]:
    if db_session.get(Dispute, id) is None:
        raise NotFoundError(f"Dispute '{id}' not found")
    rows = db_session.scalars(select(EvidenceSnapshot).where(EvidenceSnapshot.dispute_id == id)
                              .order_by(EvidenceSnapshot.captured_at.desc()).limit(50))
    results = [EvidenceSnapshotResponse(run_id=str(row.run_id), captured_at=row.captured_at,
               content_hash=row.content_hash, evidence=EvidenceSnapshotData.model_validate(row.payload))
               for row in rows]
    reviews = db_session.scalars(select(ReviewEvidenceSnapshot).where(ReviewEvidenceSnapshot.dispute_id == id)
                                 .order_by(ReviewEvidenceSnapshot.captured_at.desc()).limit(50))
    results.extend(EvidenceSnapshotResponse(
        run_id=str(row.id), capture_kind="manual_refresh" if row.reason == "manual_refresh" else "pre_model_review",
        review_reason=row.reason, captured_at=row.captured_at,
        content_hash=row.content_hash, evidence=EvidenceSnapshotData.model_validate(row.payload),
    ) for row in reviews)
    results.sort(key=lambda row: (row.captured_at.replace(tzinfo=UTC) if row.captured_at.tzinfo is None
                                  else row.captured_at, row.run_id), reverse=True)
    return results[:50]


def refresh_evidence(id: str, db_session: Session, settings: Settings) -> EvidenceSnapshotResponse:
    """Capture current store facts against the last synced dispute without running the agent."""
    dispute = db_session.get(Dispute, id)
    if dispute is None:
        raise NotFoundError(f"Dispute '{id}' not found")
    paypal_dispute = parse_dispute(dispute.snapshot)
    adapter = LocalStoreAdapter(db_session, scope=order_scope(settings, dispute.demo_session_id))
    resolution = resolve_disputed_order(paypal_dispute.disputed_transactions or [], adapter.find_order)
    now = datetime.now(UTC)
    order = resolution.order
    if order is not None:
        history = count_buyer_disputes(db_session, paypal_dispute, now=now, fallback_count=order.buyer_prior_disputes)
        order = replace(order, buyer_prior_disputes=history.prior_disputes, buyer_history_known=history.known)
    if resolution.status in {"ambiguous", "unavailable"}:
        detail = ("Multiple orders matched; no order evidence was selected." if resolution.status == "ambiguous"
                  else "The store was unavailable; order evidence could not be checked.")
        payload, digest = build_snapshot(None, None, explanation=detail)
    elif (str(paypal_dispute.reason) == "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
          and evaluate_missing_delivery(order, "HUMAN_REVIEW", now) == "review"):
        payload, digest = build_snapshot(order, None,
                                         explanation="Delivery evidence is missing or unsafe; human review required.")
    else:
        evidence = build_evidence_for(paypal_dispute.reason, order, transaction_id=resolution.transaction_id)
        payload, digest = build_snapshot(order, evidence)
    row = ReviewEvidenceSnapshot(dispute_id=id, reason="manual_refresh", content_hash=digest,
                                 captured_at=now, payload=payload)
    db_session.add(row)
    db_session.commit()
    return EvidenceSnapshotResponse(run_id=str(row.id), capture_kind="manual_refresh", review_reason=row.reason,
                                    captured_at=now, content_hash=digest,
                                    evidence=EvidenceSnapshotData.model_validate(payload))


@router.post("/{id}/evidence/refresh", response_model=EvidenceSnapshotResponse)
def refresh_evidence_endpoint(
    id: str, request: Request, db_session: Annotated[Session, Depends(get_db_session)],
) -> EvidenceSnapshotResponse:
    return refresh_evidence(id, db_session, request.app.state.settings)


def _encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(f"offset:{offset}".encode()).decode("utf-8")


def _decode_cursor(cursor_str: str) -> int:
    try:
        raw = base64.urlsafe_b64decode(cursor_str.encode("utf-8")).decode("utf-8")
        prefix, offset_str = raw.split(":", 1)
        if prefix != "offset":
            raise ValueError
        offset = int(offset_str)
        if offset < 0:
            raise ValueError
        return offset
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid pagination cursor",
        ) from exc


@router.get(
    "",
    response_model=DisputesResponse,
    summary="List and filter disputes",
    description=(
        "Returns a paginated list of disputes filtered by status, reason, or due-date. "
        "Due-date sorting puts nulls last."
    ),
)
async def list_disputes(
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    status_filter: Annotated[DisputeStatus | None, Query(alias="status", description="Filter by status")] = None,
    reason_filter: Annotated[DisputeReason | None, Query(alias="reason", description="Filter by reason")] = None,
    due_before: Annotated[
        str | None,
        Query(alias="due-before", description="Filter disputes due before this timestamp"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Page size limit")] = 50,
    cursor: Annotated[str | None, Query(description="Pagination cursor")] = None,
    sort_by: Annotated[
        str,
        Query(pattern="^(due_date|created_at|amount)$", description="Field to sort by"),
    ] = "due_date",
    sort_direction: Annotated[
        str,
        Query(pattern="^(asc|desc)$", description="Sort direction (asc or desc)"),
    ] = "asc",
) -> DisputesResponse:
    parsed_due_before: datetime | None = None
    if due_before is not None:
        try:
            normalized = due_before.strip().replace(" ", "+")
            if normalized.endswith("Z"):
                normalized = normalized[:-1] + "+00:00"
            parsed_due_before = datetime.fromisoformat(normalized)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid datetime format for due-before: {due_before}",
            ) from exc

    query = select(Dispute)

    if status_filter is not None:
        query = query.where(Dispute.status == status_filter.value)
    if reason_filter is not None:
        query = query.where(Dispute.reason == reason_filter.value)
    if parsed_due_before is not None:
        query = query.where(
            Dispute.seller_response_due_date.is_not(None),
            Dispute.seller_response_due_date < parsed_due_before,
        )

    # Sorting with nulls last for due_date
    if sort_by == "due_date":
        null_case = case((Dispute.seller_response_due_date.is_(None), 1), else_=0)
        if sort_direction == "desc":
            query = query.order_by(null_case.asc(), Dispute.seller_response_due_date.desc(), Dispute.id.desc())
        else:
            query = query.order_by(null_case.asc(), Dispute.seller_response_due_date.asc(), Dispute.id.asc())
    elif sort_by == "amount":
        order_col = Dispute.amount.desc() if sort_direction == "desc" else Dispute.amount.asc()
        query = query.order_by(order_col, Dispute.id.asc())
    else:  # created_at
        created_order_col = Dispute.created_at.desc() if sort_direction == "desc" else Dispute.created_at.asc()
        query = query.order_by(created_order_col, Dispute.id.asc())

    offset = _decode_cursor(cursor) if cursor else 0

    # Fetch total count matching filters
    all_matching = list(db_session.scalars(query).all())
    total_count = len(all_matching)

    paged_disputes = all_matching[offset : offset + limit]

    dispute_ids = [d.id for d in paged_disputes]

    # Pre-fetch latest decisions
    latest_decisions: dict[str, Decision] = {}
    if dispute_ids:
        decisions = list(
            db_session.scalars(
                select(Decision)
                .where(Decision.dispute_id.in_(dispute_ids))
                .order_by(Decision.created_at.desc())
            ).all()
        )
        for dec in decisions:
            if dec.dispute_id not in latest_decisions:
                latest_decisions[dec.dispute_id] = dec

    items: list[DisputeListItem] = []
    for d in paged_disputes:
        scope = order_scope(request.app.state.settings, d.demo_session_id)
        latest_dec = latest_decisions.get(d.id)
        latest_verdict = Verdict(latest_dec.verdict) if latest_dec else None
        latest_rule_id = latest_dec.rule_id if latest_dec else None

        resolution = resolve_disputed_order(
            (d.snapshot or {}).get("disputed_transactions"),
            partial(find_order_by_paypal_transaction_id, db_session, scope=scope),
        )

        items.append(
            DisputeListItem(
                id=d.id,
                status=DisputeStatus(d.status),
                reason=DisputeReason(d.reason),
                amount=Money(currency_code=d.currency, value=d.amount),
                seller_response_due_date=d.seller_response_due_date,
                state_fingerprint=d.state_fingerprint,
                created_at=d.created_at,
                updated_at=d.updated_at,
                latest_verdict=latest_verdict,
                latest_rule_id=latest_rule_id,
                order_code=resolution.order.order_code if resolution.order else None,
                order_resolution=resolution.status,
            )
        )

    next_cursor = None
    if offset + limit < total_count:
        next_cursor = _encode_cursor(offset + limit)

    return DisputesResponse(
        items=items,
        next_cursor=next_cursor,
        total_count=total_count,
    )


@router.get(
    "/{id}",
    response_model=DisputeDetailResponse,
    summary="Get dispute details",
    description="Returns full dispute details, snapshot payload, latest verdict, and linked order code.",
)
async def get_dispute_by_id(
    id: str,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> DisputeDetailResponse:
    dispute = db_session.get(Dispute, id)
    if dispute is None:
        raise NotFoundError(f"Dispute '{id}' not found")

    latest_dec = db_session.scalar(
        select(Decision)
        .where(Decision.dispute_id == id)
        .order_by(Decision.created_at.desc())
        .limit(1)
    )
    latest_verdict = Verdict(latest_dec.verdict) if latest_dec else None
    latest_rule_id = latest_dec.rule_id if latest_dec else None
    latest_approval = db_session.scalar(
        select(Approval).where(Approval.dispute_id == id)
        .order_by(Approval.created_at.desc(), Approval.id.desc()).limit(1)
    )
    execution_state = None
    if latest_approval is not None:
        state = build_approval_card_response(db_session, latest_approval).execution_state.upper()
        execution_state = None if state == "NOT_RECORDED" else state
    else:
        latest_execution = db_session.scalar(
            select(Execution).where(Execution.dispute_id == id)
            .order_by(Execution.created_at.desc(), Execution.id.desc()).limit(1)
        )
        execution_state = latest_execution.status if latest_execution else None

    scope = order_scope(request.app.state.settings, dispute.demo_session_id)
    resolution = resolve_disputed_order(
        (dispute.snapshot or {}).get("disputed_transactions"),
        lambda identifier: find_order_by_paypal_transaction_id(db_session, identifier, scope=scope),
    )

    approval_url = None
    pending_approval = db_session.scalar(
        select(Approval).join(Decision, Approval.decision_id == Decision.id).where(
            Approval.dispute_id == dispute.id,
            Approval.resolution == ApprovalResolution.PENDING.value,
            Approval.expires_at > datetime.now(UTC),
            Decision.dispute_fingerprint == dispute.state_fingerprint,
        ).order_by(Approval.created_at.desc(), Approval.id.desc()).limit(1)
    )
    if pending_approval is not None:
        approval_url = f"/app/approvals/{pending_approval.id}"
    settings = getattr(request.app.state, "settings", None) if hasattr(request, "app") else Settings()
    if (approval_url is None and settings and settings.app_env != AppEnv.prod
            and settings.demo_show_approval_links):
        demo_links = (
            getattr(request.app.state, "demo_approval_links", None)
            if hasattr(request, "app")
            else DEMO_APPROVAL_LINKS
        )
        if demo_links is None:
            demo_links = DEMO_APPROVAL_LINKS
        raw_token = demo_links.get(dispute.id)
        if raw_token:
            approval_url = f"{settings.web_base_url.rstrip('/')}/approve/{raw_token}"

    return DisputeDetailResponse(
        id=dispute.id,
        status=DisputeStatus(dispute.status),
        reason=DisputeReason(dispute.reason),
        amount=Money(currency_code=dispute.currency, value=dispute.amount),
        seller_response_due_date=dispute.seller_response_due_date,
        state_fingerprint=dispute.state_fingerprint,
        snapshot=dispute.snapshot,
        created_at=dispute.created_at,
        updated_at=dispute.updated_at,
        latest_verdict=latest_verdict,
        latest_rule_id=latest_rule_id,
        order_code=resolution.order.order_code if resolution.order else None,
        order_resolution=resolution.status,
        approval_url=approval_url,
        latest_approval_resolution=ApprovalResolution(latest_approval.resolution) if latest_approval else None,
        latest_execution_status=("QUEUED" if execution_state == "QUEUED" else
                                 ExecutionStatus(execution_state) if execution_state else None),
    )
