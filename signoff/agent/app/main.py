"""Signoff Agent FastAPI application factory and core routes."""

import logging
import re
import uuid
from typing import Any

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from agent.app.db.session import check_database_health
from agent.app.errors import (
    ErrorEnvelope,
    create_error_response,
    register_error_handlers,
)
from agent.app.logging import set_correlation_id, setup_logging
from agent.app.settings import Settings

logger = logging.getLogger(__name__)

# Valid correlation id pattern: alphanumeric, hyphen, underscore, 1-64 chars
CORRELATION_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")


class RequestIdMiddleware:
    """Pure ASGI middleware ensuring validated correlation id propagation and 500 error envelopes."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        incoming_raw = headers.get(b"x-request-id") or headers.get(b"x-correlation-id") or b""
        incoming_id = incoming_raw.decode("latin1", errors="ignore").strip()

        correlation_id = incoming_id if incoming_id and CORRELATION_ID_REGEX.match(incoming_id) else str(uuid.uuid4())

        set_correlation_id(correlation_id)

        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                h = list(message.get("headers", []))
                h.append((b"x-request-id", correlation_id.encode("latin1")))
                h.append((b"x-correlation-id", correlation_id.encode("latin1")))
                message["headers"] = h
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("Unhandled exception in request pipeline")
            if not response_started:
                error_response = create_error_response(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    code="INTERNAL",
                    message="An unexpected internal error occurred. Please contact support with the correlation id.",
                )
                await error_response(scope, receive, send_wrapper)
            else:
                raise


def create_app(settings: Settings | None = None) -> FastAPI:
    """FastAPI application factory with validated settings and standardized error envelope."""
    app_settings = settings or Settings()
    setup_logging()

    standard_responses: dict[int | str, dict[str, Any]] = {
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorEnvelope,
            "description": "Bad Request",
        },
        status.HTTP_404_NOT_FOUND: {"model": ErrorEnvelope, "description": "Not Found"},
        status.HTTP_409_CONFLICT: {
            "model": ErrorEnvelope,
            "description": "Conflict or Stale Data",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ErrorEnvelope,
            "description": "Validation Failed",
        },
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "model": ErrorEnvelope,
            "description": "Rate Limited",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorEnvelope,
            "description": "Internal Server Error",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ErrorEnvelope,
            "description": "Service Unavailable or Frozen",
        },
    }

    app = FastAPI(
        title="Signoff Dispute Agent API",
        description="Autonomous PayPal dispute operations constrained by merchant charter rules.",
        version="0.1.0",
        responses=standard_responses,
    )

    app.state.settings = app_settings

    # Middleware registration: RequestId outer, CORS inner
    allowed_origins = app_settings.parsed_allowed_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins if allowed_origins else [],
        allow_credentials=bool(allowed_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)

    # Register uniform error handlers
    register_error_handlers(app)

    @app.get("/healthz", tags=["System"])
    async def healthz() -> dict[str, str]:
        """Liveness check without database dependency."""
        return {
            "status": "ok",
            "app_env": app_settings.app_env.value,
        }

    @app.get("/readyz", tags=["System"])
    async def readyz() -> dict[str, str] | Any:
        """Readiness check verifying database connectivity."""
        db_healthy = check_database_health()
        if not db_healthy:
            return create_error_response(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="UPSTREAM_UNAVAILABLE",
                message="Database connection is unavailable or failing health check",
            )
        return {
            "status": "ready",
            "database": "connected",
        }

    @app.get("/api/status", tags=["System"])
    async def api_status() -> dict[str, Any]:
        """Service status and operating environment flags."""
        return {
            "status": "ok",
            "env": app_settings.app_env.value,
            "paypal_env": app_settings.paypal_env.value,
            "demo_frozen": app_settings.demo_frozen,
        }

    return app


app = create_app()
