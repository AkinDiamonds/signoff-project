"""API endpoints for merchant authority charter management."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from agent.app.db.session import get_db_session
from agent.app.policy.charter import (
    CharterResponse,
    UpdateCharterRequest,
    get_charter_by_version,
    get_charter_history,
    get_or_seed_charter,
    to_charter_response,
    update_charter,
)

router = APIRouter(prefix="/api/charter", tags=["Charter"])


@router.get(
    "",
    response_model=CharterResponse,
    summary="Get active or historical charter",
    description="Retrieves active charter, seeds default v1 if uninitialized, or returns a specific version.",
)
async def get_charter(
    db_session: Annotated[Session, Depends(get_db_session)],
    version: Annotated[int | None, Query(description="Specific charter version to retrieve", ge=1)] = None,
) -> CharterResponse:
    if version is not None:
        charter = get_charter_by_version(db_session, version=version)
    else:
        charter = get_or_seed_charter(db_session)
    return to_charter_response(charter)


@router.put(
    "",
    response_model=CharterResponse,
    summary="Update charter with optimistic concurrency control",
    description="Creates a new immutable version based on base_version. Returns 409 conflict if stale.",
)
async def put_charter(
    payload: UpdateCharterRequest,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> CharterResponse:
    is_frozen = bool(getattr(request.app.state.settings, "demo_frozen", False))
    new_charter = update_charter(
        session=db_session,
        update=payload,
        is_frozen=is_frozen,
    )
    db_session.commit()
    return to_charter_response(new_charter)


@router.get(
    "/history",
    response_model=list[CharterResponse],
    summary="Get complete charter version history",
    description="Returns all charter versions ordered newest first.",
)
async def list_charter_history(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> list[CharterResponse]:
    history = get_charter_history(db_session)
    return [to_charter_response(c) for c in history]
