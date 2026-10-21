"""Demo scenario endpoints: create from the pool, inspect the pool, reset."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from agent.app.db.models import DemoSession
from agent.app.db.session import get_db_session
from agent.app.errors import FrozenError
from agent.app.paypal.buyer_client import BuyerDisputeClient
from agent.app.simulator import service
from agent.app.simulator.schemas import PoolResponse, ResetResponse, ScenarioCreated, ScenarioId

router = APIRouter(prefix="/api/demo", tags=["Demo"])


def _session(
    request: Request,
    db: Session,
    session_id: str | None,
) -> DemoSession:
    settings = request.app.state.settings
    return service.resolve_session(
        db,
        session_id,
        now=datetime.now(UTC),
        ttl_hours=settings.demo_session_ttl_hours,
    )


@router.get("/pool", response_model=PoolResponse)
def get_pool(
    db: Annotated[Session, Depends(get_db_session)],
) -> PoolResponse:
    """Return global pool availability and per-scenario counts."""
    return service.pool_snapshot(db)


@router.post("/scenarios/{scenario_id}", response_model=ScenarioCreated, status_code=201)
async def create_scenario(
    scenario_id: ScenarioId,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db_session)],
    session_id: Annotated[str | None, Header(alias="X-Demo-Session")] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ScenarioCreated:
    """Claim a pooled transaction, create the dispute, and tag it to the session."""
    settings = request.app.state.settings
    if settings.demo_frozen:
        raise FrozenError("The demo is frozen for maintenance; scenario creation is disabled.")

    session = _session(request, db, session_id)
    response.headers["X-Demo-Session"] = session.id

    cache = request.app.state.demo_idempotency
    cache_key = (session.id, scenario_id, idempotency_key) if idempotency_key else None
    if cache_key is not None and cache_key in cache:
        return cache[cache_key]

    client_ip = request.client.host if request.client else "unknown"
    request.app.state.demo_quotas.consume(session.id, client_ip, datetime.now(UTC))

    client = getattr(request.app.state, "buyer_client", None)
    owns_client = client is None
    if client is None:
        client = BuyerDisputeClient()
    try:
        created = await service.create_scenario(
            db,
            scenario_id,
            session,
            client,
            buyer_payer_id=settings.paypal_buyer_payer_id or None,
        )
    finally:
        if owns_client:
            await client.close()

    if cache_key is not None:
        cache[cache_key] = created
    return created


@router.post("/reset", response_model=ResetResponse)
def reset(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db_session)],
    session_id: Annotated[str | None, Header(alias="X-Demo-Session")] = None,
) -> ResetResponse:
    """Hide this session's disputes and issue a fresh session."""
    settings = request.app.state.settings
    now = datetime.now(UTC)

    existing = db.get(DemoSession, session_id) if session_id else None
    if existing is not None and existing.expires_at is not None:
        expiring = existing.expires_at
        if expiring.tzinfo is None:
            expiring = expiring.replace(tzinfo=UTC)
        if expiring <= now:
            existing = None

    if existing is None or not existing.is_active:
        replacement = service.new_session(db, now=now, ttl_hours=settings.demo_session_ttl_hours)
        response.headers["X-Demo-Session"] = replacement.id
        return ResetResponse(session_id=replacement.id, hidden_disputes=0)

    result = service.reset_session(db, existing, now=now, ttl_hours=settings.demo_session_ttl_hours)
    response.headers["X-Demo-Session"] = result.session_id
    return result
