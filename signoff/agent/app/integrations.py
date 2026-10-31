"""Owner-only readiness: configuration is distinct from an observed successful check."""

import asyncio
import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from agent.app.db.models import IntegrationObservation, WebhookEvent
from agent.app.db.session import get_db_session
from agent.app.paypal.auth import PayPalAuth
from agent.app.settings import PayPalEnv, Settings
from agent.app.store.factory import build_store_adapter
from agent.app.store.http_adapter import HttpStoreAdapter

router = APIRouter(prefix="/api/integrations", tags=["Integration readiness"])
ReadinessState = Literal["configured", "missing", "unknown", "verified", "failed", "stale"]


class ReadinessItem(BaseModel):
    state: ReadinessState
    detail: str
    checked_at: datetime | None = None


class IntegrationStatus(BaseModel):
    merchant_id: str | None
    paypal_environment: PayPalEnv
    webhook_url: str
    paypal: ReadinessItem
    store: ReadinessItem
    webhook: ReadinessItem
    worker: ReadinessItem
    llm: ReadinessItem


def observe(db: Session, key: str, state: str, *, config_tag: str = "") -> None:
    """Upsert a shared observation; the caller owns the transaction."""
    values = {"key": key, "state": state, "checked_at": datetime.now(UTC), "config_tag": config_tag}
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    statement = insert(IntegrationObservation).values(**values)
    db.execute(statement.on_conflict_do_update(index_elements=["key"], set_=values))


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _tag(settings: Settings, name: str) -> str:
    values = (
        f"{settings.paypal_base_url}:{settings.paypal_client_id}:{settings.paypal_client_secret}"
        if name == "paypal"
        else f"{settings.public_base_url}:{settings.store_api_key}:{settings.paypal_env}"
    )
    return hmac.new(
        settings.approval_token_secret.encode(), f"readiness:{name}:{values}".encode(), hashlib.sha256
    ).hexdigest()


def _checked(db: Session, settings: Settings, key: str, configured: bool, description: str) -> ReadinessItem:
    row = db.get(IntegrationObservation, key, populate_existing=True)
    if not configured:
        return ReadinessItem(state="missing", detail=f"{description} is not configured.")
    if row is None or not hmac.compare_digest(row.config_tag, _tag(settings, key)):
        return ReadinessItem(state="configured", detail=f"{description} is configured but has not been checked.")
    checked_at = _utc(row.checked_at)
    if datetime.now(UTC) - checked_at > timedelta(minutes=15):
        return ReadinessItem(
            state="stale", detail="The last connection check is more than 15 minutes old.", checked_at=checked_at
        )
    if row.state == "verified":
        detail = (
            "PayPal accepted the sandbox credentials; dispute permissions still depend on the account."
            if key == "paypal"
            else "The configured store responded to a read-only check."
        )
        return ReadinessItem(state="verified", detail=detail, checked_at=checked_at)
    return ReadinessItem(
        state="failed",
        detail=f"The {description.lower()} check failed. Review the connection settings.",
        checked_at=checked_at,
    )


def integration_status(settings: Settings, db: Session) -> IntegrationStatus:
    webhook = db.scalar(
        select(WebhookEvent).where(WebhookEvent.verified.is_(True)).order_by(WebhookEvent.received_at.desc()).limit(1)
    )
    worker = db.scalar(
        select(IntegrationObservation)
        .where(IntegrationObservation.key.startswith("worker:"))
        .order_by(IntegrationObservation.checked_at.desc())
        .limit(1)
    )
    worker_at = _utc(worker.checked_at) if worker else None
    worker_state: ReadinessState = (
        "unknown"
        if worker_at is None
        else ("verified" if datetime.now(UTC) - worker_at < timedelta(seconds=45) else "stale")
    )
    llm_configured = bool(settings.llm_api_key and settings.llm_model and settings.llm_api_base_url)
    return IntegrationStatus(
        merchant_id=settings.paypal_merchant_id.strip() or None,
        paypal_environment=settings.paypal_env,
        webhook_url=f"{settings.public_base_url.rstrip('/')}/webhooks/paypal",
        paypal=_checked(
            db, settings, "paypal", bool(settings.paypal_client_id and settings.paypal_client_secret), "PayPal access"
        ),
        store=_checked(
            db, settings, "store", bool(settings.store_api_key) or settings.paypal_env == PayPalEnv.stub, "Store access"
        ),
        webhook=ReadinessItem(
            state="verified" if webhook else "unknown",
            detail="A verified PayPal webhook was received." if webhook else "No verified webhook has been observed.",
            checked_at=_utc(webhook.received_at) if webhook else None,
        ),
        worker=ReadinessItem(
            state=worker_state,
            detail="Worker heartbeat received." if worker_at else "No worker heartbeat has been observed.",
            checked_at=worker_at,
        ),
        llm=ReadinessItem(
            state="configured" if llm_configured else "missing",
            detail="Provider configured; live response success has not been verified here."
            if llm_configured
            else "Deterministic local test provider."
            if settings.llm_provider == "fake"
            else "Live AI provider is not configured.",
        ),
    )


@router.get("/status", response_model=IntegrationStatus)
def get_status(request: Request, db: Annotated[Session, Depends(get_db_session)]) -> IntegrationStatus:
    return integration_status(request.app.state.settings, db)


@router.post("/check", response_model=IntegrationStatus)
async def check_connections(request: Request, db: Annotated[Session, Depends(get_db_session)]) -> IntegrationStatus:
    settings: Settings = request.app.state.settings
    if settings.paypal_client_id and settings.paypal_client_secret:
        auth = PayPalAuth(
            client_id=settings.paypal_client_id,
            client_secret=settings.paypal_client_secret,
            base_url=settings.paypal_base_url,
        )
        try:
            await auth.get_access_token()
            observe(db, "paypal", "verified", config_tag=_tag(settings, "paypal"))
        except Exception:
            observe(db, "paypal", "failed", config_tag=_tag(settings, "paypal"))
        finally:
            await auth.close()
    if settings.store_api_key or settings.paypal_env == PayPalEnv.stub:
        adapter = build_store_adapter(settings, db)
        try:
            await asyncio.to_thread(adapter.get_policies)
            observe(db, "store", "verified", config_tag=_tag(settings, "store"))
        except Exception:
            observe(db, "store", "failed", config_tag=_tag(settings, "store"))
        finally:
            if isinstance(adapter, HttpStoreAdapter):
                adapter.close()
    db.commit()
    return integration_status(settings, db)
