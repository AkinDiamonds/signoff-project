"""Single-owner login, durable opaque sessions and CSRF protection for merchant APIs."""

import hashlib
import hmac
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from agent.app.db.models import LoginAttempt, OwnerSession
from agent.app.db.session import get_db_session
from agent.app.errors import AppError
from agent.app.settings import AppEnv, Settings

SESSION_HOURS = 8
router = APIRouter(prefix="/api/auth", tags=["Owner access"])


def hash_password(password: str) -> str:
    """Create an scrypt credential for secure server configuration, never a public signup."""
    if not 12 <= len(password) <= 1024:
        raise ValueError("Use a password between 12 and 1024 characters")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=5, dklen=32)
    return f"scrypt$16384$8$5${salt.hex()}${digest.hex()}"


def _parse_hash(encoded: str) -> tuple[bytes, bytes] | None:
    try:
        algorithm, n, r, p, salt, digest = encoded.split("$")
        if (algorithm, n, r, p) != ("scrypt", "16384", "8", "5"):
            return None
        salt_bytes, digest_bytes = bytes.fromhex(salt), bytes.fromhex(digest)
        if len(salt_bytes) != 16 or len(digest_bytes) != 32:
            return None
        return salt_bytes, digest_bytes
    except ValueError:
        return None


def verify_password(password: str, encoded: str) -> bool:
    parsed = _parse_hash(encoded)
    if parsed is None or len(password) > 1024:
        return False
    salt, expected = parsed
    actual = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=5, dklen=32)
    return hmac.compare_digest(actual, expected)


def owner_configured(settings: Settings) -> bool:
    return bool(
        re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", settings.merchant_email.strip())
        and _parse_hash(settings.merchant_password_hash)
        and len(settings.approval_token_secret) >= 32
    )


def _sign(settings: Settings, purpose: str, value: str) -> str:
    return hmac.new(
        settings.approval_token_secret.encode(), f"signoff:{purpose}:{value}".encode(), hashlib.sha256
    ).hexdigest()


def _cookie_name(settings: Settings) -> str:
    return "__Host-signoff_session" if settings.app_env == AppEnv.prod else "signoff_session"


def _cookie(response: Response, settings: Settings, value: str, max_age: int) -> None:
    secure = settings.app_env == AppEnv.prod
    response.set_cookie(
        _cookie_name(settings),
        value,
        max_age=max_age,
        path="/",
        secure=secure,
        httponly=True,
        samesite="none" if secure else "lax",
    )
    if secure:
        # CHIPS lets Android Chrome use an HttpOnly API cookie across Render origins.
        # Python 3.12's Morsel does not expose the Partitioned attribute yet.
        response.headers["set-cookie"] += "; Partitioned"
    response.headers["Cache-Control"] = "no-store"


def _origin(request: Request, settings: Settings) -> None:
    origin = request.headers.get("origin")
    same_origin = str(request.base_url).rstrip("/")
    if origin and origin not in [*settings.parsed_allowed_origins, same_origin]:
        raise AppError("FORBIDDEN", "This request origin is not permitted", status_code=403)


def _session(request: Request, db: Session) -> OwnerSession | None:
    settings: Settings = request.app.state.settings
    raw = request.cookies.get(_cookie_name(settings), "")
    if not raw or not owner_configured(settings):
        return None
    row = db.get(OwnerSession, hashlib.sha256(raw.encode()).hexdigest())
    if row is None:
        return None
    expiry = row.expires_at.replace(tzinfo=UTC) if row.expires_at.tzinfo is None else row.expires_at
    if (
        expiry <= datetime.now(UTC)
        or row.email != settings.merchant_email.strip().casefold()
        or not hmac.compare_digest(row.credential_tag, _sign(settings, "credential", settings.merchant_password_hash))
    ):
        return None
    return row


def require_merchant(
    request: Request, response: Response, db: Annotated[Session, Depends(get_db_session)]
) -> OwnerSession | None:
    response.headers["Cache-Control"] = "no-store"
    settings: Settings = request.app.state.settings
    if not settings.merchant_auth_required:
        return None
    row = _session(request, db)
    if row is None:
        raise AppError("UNAUTHENTICATED", "Sign in to access your merchant account", status_code=401)
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        _origin(request, settings)
        if not hmac.compare_digest(request.headers.get("X-CSRF-Token", ""), _sign(settings, "csrf", row.token_hash)):
            raise AppError("FORBIDDEN", "Refresh this page before trying again", status_code=403)
    return row


class SessionView(BaseModel):
    required: bool
    configured: bool
    authenticated: bool
    email: str | None = None
    csrf_token: str | None = None
    expires_at: datetime | None = None


def _view(settings: Settings, row: OwnerSession | None) -> SessionView:
    expiry = row.expires_at if row else None
    if expiry is not None and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=UTC)
    return SessionView(
        required=settings.merchant_auth_required,
        configured=owner_configured(settings),
        authenticated=row is not None,
        email=row.email if row else None,
        csrf_token=_sign(settings, "csrf", row.token_hash) if row else None,
        expires_at=expiry,
    )


@router.get("/session", response_model=SessionView)
def session_status(
    request: Request, response: Response, db: Annotated[Session, Depends(get_db_session)]
) -> SessionView:
    response.headers["Cache-Control"] = "no-store"
    settings: Settings = request.app.state.settings
    return _view(settings, _session(request, db) if settings.merchant_auth_required else None)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=1024)


@router.post("/login", response_model=SessionView)
def login(
    payload: LoginRequest, request: Request, response: Response, db: Annotated[Session, Depends(get_db_session)]
) -> SessionView:
    settings: Settings = request.app.state.settings
    _origin(request, settings)
    if not owner_configured(settings):
        raise AppError(
            "SIGN_IN_UNAVAILABLE", "Sign-in is temporarily unavailable. Contact the store owner.", status_code=503
        )
    now = datetime.now(UTC)
    client_hash = _sign(settings, "login-client", request.client.host if request.client else "unknown")
    if db.get_bind().dialect.name == "postgresql":
        db.execute(select(func.pg_advisory_xact_lock(func.hashtext(client_hash))))
    failures = (
        db.scalar(
            select(func.count(LoginAttempt.id)).where(
                LoginAttempt.client_hash == client_hash,
                LoginAttempt.created_at > now - timedelta(minutes=15),
            )
        )
        or 0
    )
    if failures >= 5:
        raise AppError("RATE_LIMITED", "Too many sign-in attempts. Try again in 15 minutes.", status_code=429)
    password_ok = verify_password(payload.password.get_secret_value(), settings.merchant_password_hash)
    email_ok = hmac.compare_digest(
        payload.email.strip().casefold().encode(), settings.merchant_email.strip().casefold().encode()
    )
    if not password_ok or not email_ok:
        db.add(LoginAttempt(client_hash=client_hash, created_at=now))
        db.commit()
        raise AppError("INVALID_CREDENTIALS", "Email or password is incorrect", status_code=401)
    old = _session(request, db)
    if old:
        db.delete(old)
    db.execute(delete(LoginAttempt).where(LoginAttempt.client_hash == client_hash))
    raw = secrets.token_urlsafe(32)
    row = OwnerSession(
        token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        email=settings.merchant_email.strip().casefold(),
        credential_tag=_sign(settings, "credential", settings.merchant_password_hash),
        created_at=now,
        expires_at=now + timedelta(hours=SESSION_HOURS),
    )
    db.add(row)
    db.commit()
    _cookie(response, settings, raw, SESSION_HOURS * 3600)
    return _view(settings, row)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db_session)],
    row: Annotated[OwnerSession | None, Depends(require_merchant)],
) -> None:
    if row:
        db.delete(row)
        db.commit()
    _cookie(response, request.app.state.settings, "", 0)
