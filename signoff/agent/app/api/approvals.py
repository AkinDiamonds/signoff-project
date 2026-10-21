"""Merchant approval endpoints: token-based card retrieval and resolution."""

import logging
import time
from collections import defaultdict
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request, status
from sqlalchemy.orm import Session

from agent.app.approvals.schemas import ApprovalCardResponse, ResolveRequest, ResolveResponse
from agent.app.approvals.service import (
    build_approval_card_response,
    get_approval_by_token,
    resolve_approval,
)
from agent.app.db.session import get_db_session
from agent.app.errors import RateLimitedError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])

# Simple token endpoint rate limiting: max 30 requests per minute per IP
_RATE_LIMIT_WINDOW = 60.0
_MAX_REQUESTS_PER_WINDOW = 30
_request_history: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request) -> None:
    """Enforce rate limiting on approval token endpoints."""
    client_ip = request.client.host if request.client else "unknown"
    now_time = time.time()
    timestamps = _request_history[client_ip]

    # Filter timestamps within active window
    valid_timestamps = [t for t in timestamps if now_time - t < _RATE_LIMIT_WINDOW]

    if len(valid_timestamps) >= _MAX_REQUESTS_PER_WINDOW:
        logger.warning("Rate limit exceeded on approval endpoint for IP: %s", client_ip)
        _request_history[client_ip] = valid_timestamps  # keep trimmed, don't append
        raise RateLimitedError("Too many approval requests. Please slow down.")

    valid_timestamps.append(now_time)
    _request_history[client_ip] = valid_timestamps


@router.get(
    "/{token}",
    response_model=ApprovalCardResponse,
    summary="Get merchant approval card",
    description=(
        "Retrieves approval card data for a valid, unexpired, and unresolved token."
        " Returns uniform 404 otherwise."
    ),
)
async def get_approval_card(
    token: Annotated[str, Path(description="Random approval token from merchant notification", min_length=16)],
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> ApprovalCardResponse:
    check_rate_limit(request)
    now_dt = datetime.now(UTC)
    approval = get_approval_by_token(db_session, raw_token=token, now=now_dt)
    return build_approval_card_response(db_session, approval)


@router.post(
    "/{token}/resolve",
    response_model=ResolveResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve merchant approval",
    description=(
        "Resolves an approval card with approve, deny, or edit."
        " Atomic and enforces waiver rules and dispute freshness."
    ),
)
async def post_resolve_approval(
    token: Annotated[str, Path(description="Random approval token from merchant notification", min_length=16)],
    body: ResolveRequest,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> ResolveResponse:
    check_rate_limit(request)
    now_dt = datetime.now(UTC)
    return resolve_approval(db_session, raw_token=token, request=body, now=now_dt)
