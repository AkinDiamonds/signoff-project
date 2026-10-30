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
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from agent.app.approvals.service import DEMO_APPROVAL_LINKS
from agent.app.settings import Settings
from pydantic import BaseModel
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, Dispute, Order
from agent.app.db.session import get_db_session
from agent.app.domain.enums import DisputeReason, DisputeStatus, Verdict
from agent.app.domain.money import Money
from agent.app.errors import NotFoundError

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
        order_col = Dispute.created_at.desc() if sort_direction == "desc" else Dispute.created_at.asc()
        query = query.order_by(order_col, Dispute.id.asc())

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

    # Pre-fetch linked order codes via transaction IDs
    transaction_ids = []
    for d in paged_disputes:
        txs = (d.snapshot or {}).get("disputed_transactions", [])
        for tx in txs:
            tid = tx.get("buyer_transaction_id") or tx.get("seller_transaction_id")
            if tid:
                transaction_ids.append(tid)

    order_code_by_tx: dict[str, str] = {}
    if transaction_ids:
        orders = list(
            db_session.scalars(
                select(Order).where(Order.paypal_transaction_id.in_(transaction_ids))
            ).all()
        )
        for o in orders:
            if o.paypal_transaction_id:
                order_code_by_tx[o.paypal_transaction_id] = o.order_code

    items: list[DisputeListItem] = []
    for d in paged_disputes:
        latest_dec = latest_decisions.get(d.id)
        latest_verdict = Verdict(latest_dec.verdict) if latest_dec else None
        latest_rule_id = latest_dec.rule_id if latest_dec else None

        # Resolve order code
        order_code = None
        for tx in (d.snapshot or {}).get("disputed_transactions", []):
            tid = tx.get("buyer_transaction_id") or tx.get("seller_transaction_id")
            if tid and tid in order_code_by_tx:
                order_code = order_code_by_tx[tid]
                break

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
                order_code=order_code,
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

    # Resolve linked order
    order_code = None
    for tx in (dispute.snapshot or {}).get("disputed_transactions", []):
        tid = tx.get("buyer_transaction_id") or tx.get("seller_transaction_id")
        if tid:
            order = db_session.scalar(
                select(Order).where(Order.paypal_transaction_id == tid).limit(1)
            )
            if order:
                order_code = order.order_code
                break

    approval_url = None
    settings = getattr(request.app.state, "settings", None) if hasattr(request, "app") else Settings()
    if settings and settings.demo_show_approval_links:
        demo_links = getattr(request.app.state, "demo_approval_links", None) if hasattr(request, "app") else DEMO_APPROVAL_LINKS
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
        order_code=order_code,
        approval_url=approval_url,
    )
