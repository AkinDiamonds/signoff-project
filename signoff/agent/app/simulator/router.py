"""Demo scenario endpoints: create from the pool, inspect the pool, reset, hold, and claim."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, DemoPool, DemoSession, Dispute, Job
from agent.app.db.session import get_db_session
from agent.app.domain.enums import JobKind, JobStatus
from agent.app.domain.money import Money
from agent.app.errors import AppError, FrozenError, NotFoundError
from agent.app.paypal.buyer_client import BuyerDisputeClient
from agent.app.settings import PayPalEnv
from agent.app.simulator import service
from agent.app.simulator.schemas import PoolResponse, ResetResponse, ScenarioCreated, ScenarioId

router = APIRouter(prefix="/api/demo", tags=["Demo"])


class DemoPoolDisputeItem(BaseModel):
    dispute_id: str
    state: str
    scenario_label: str | None = None
    amount: Money
    reason: str
    created_at: datetime
    seller_response_due_date: datetime | None = None
    claimed_at: datetime | None = None
    latest_verdict: str | None = None
    latest_rule_id: str | None = None


class ClaimDisputeResponse(BaseModel):
    dispute_id: str
    status: str


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


@router.get("/pool", response_model=PoolResponse | list[DemoPoolDisputeItem])
def get_pool(
    request: Request,
    db: Annotated[Session, Depends(get_db_session)],
) -> Any:
    """Return pooled disputes for demo judge flow, or scenario counts in legacy stub mode."""
    settings = request.app.state.settings
    pool_count = db.scalar(select(func.count(DemoPool.dispute_id))) or 0
    if not settings.demo_hold_disputes and pool_count == 0:
        return service.pool_snapshot(db)

    stmt = (
        select(DemoPool, Dispute)
        .outerjoin(Dispute, DemoPool.dispute_id == Dispute.id)
        .order_by(DemoPool.created_at.desc())
    )
    rows = db.execute(stmt).all()

    # Latest decision per dispute, for the finished-run verdict and rule id.
    dispute_ids = [pool_row.dispute_id for pool_row, _ in rows]
    latest_decisions: dict[str, tuple[str, str]] = {}
    if dispute_ids:
        decision_rows = db.execute(
            select(Decision.dispute_id, Decision.verdict, Decision.rule_id)
            .where(Decision.dispute_id.in_(dispute_ids))
            .order_by(Decision.created_at.asc(), Decision.id.asc())
        ).all()
        for decision_dispute_id, verdict, rule_id in decision_rows:
            latest_decisions[decision_dispute_id] = (verdict, rule_id)

    items: list[DemoPoolDisputeItem] = []
    for pool_row, dispute in rows:
        amount = (
            Money(value=dispute.amount, currency_code=dispute.currency)
            if dispute and dispute.amount is not None
            else Money(value=Decimal("0.01"), currency_code="USD")
        )
        reason = dispute.reason if dispute else "OTHER"
        due_date = dispute.seller_response_due_date if dispute else None
        label = pool_row.scenario_label
        if not label and dispute:
            label = f"{reason.replace('_', ' ').capitalize()} dispute"
        verdict, rule_id = latest_decisions.get(pool_row.dispute_id, (None, None))
        items.append(
            DemoPoolDisputeItem(
                dispute_id=pool_row.dispute_id,
                state=pool_row.state,
                scenario_label=label,
                amount=amount,
                reason=reason,
                created_at=pool_row.created_at,
                seller_response_due_date=due_date,
                claimed_at=pool_row.claimed_at,
                latest_verdict=verdict,
                latest_rule_id=rule_id,
            )
        )
    return items


@router.post("/claim/{dispute_id}", response_model=ClaimDisputeResponse)
def claim_dispute(
    dispute_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db_session)],
    demo_token: Annotated[str | None, Header(alias="X-Demo-Token")] = None,
) -> Any:
    """Claim a pooled dispute for judge evaluation, enqueuing a RUN_AGENT job."""
    settings = request.app.state.settings
    if not settings.demo_claim_token or demo_token != settings.demo_claim_token:
        raise NotFoundError("Claim endpoint is disabled or missing valid demo token")

    clean_id = dispute_id.strip()
    pool_row = db.get(DemoPool, clean_id)
    if pool_row is None:
        raise NotFoundError(f"Dispute {clean_id} not found in demo pool")

    if pool_row.state in ("claimed", "done"):
        claimed_at_str = pool_row.claimed_at.isoformat() if pool_row.claimed_at else None
        return JSONResponse(
            status_code=409,
            content={
                "code": "ALREADY_CLAIMED",
                "claimed_at": claimed_at_str,
                "error": {
                    "code": "ALREADY_CLAIMED",
                    "message": "Dispute has already been claimed",
                    "claimed_at": claimed_at_str,
                },
            },
        )

    now = datetime.now(UTC)
    stmt = (
        update(DemoPool)
        .where(DemoPool.dispute_id == clean_id, DemoPool.state == "pooled")
        .values(state="claimed", claimed_at=now)
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        db.refresh(pool_row)
        claimed_at_str = pool_row.claimed_at.isoformat() if pool_row.claimed_at else None
        return JSONResponse(
            status_code=409,
            content={
                "code": "ALREADY_CLAIMED",
                "claimed_at": claimed_at_str,
                "error": {
                    "code": "ALREADY_CLAIMED",
                    "message": "Dispute has already been claimed",
                    "claimed_at": claimed_at_str,
                },
            },
        )

    dispute = db.get(Dispute, clean_id)
    fingerprint = dispute.state_fingerprint if dispute else ""
    run_job = Job(
        kind=JobKind.RUN_AGENT.value,
        dispute_id=clean_id,
        status=JobStatus.PENDING.value,
        payload={"dispute_id": clean_id, "fingerprint": fingerprint},
    )
    db.add(run_job)
    db.commit()

    return ClaimDisputeResponse(dispute_id=clean_id, status="claimed")


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
    if settings.paypal_env != PayPalEnv.stub:
        raise AppError(
            code="DEMO_UNAVAILABLE",
            message=(
                "Simulated demo scenarios are only available with the local PayPal stub. "
                "In live sandbox mode, buy an order in the shop and open a case in PayPal."
            ),
            status_code=409,
        )

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
