"""Standard error envelope and exception handlers per build-plan/contracts.md."""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from agent.app.logging import get_correlation_id

logger = logging.getLogger(__name__)


class FieldError(BaseModel):
    path: str
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    correlation_id: str
    fields: list[FieldError] = Field(default_factory=list)


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class AppError(Exception):
    """Base application exception mapped to standard error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        fields: list[FieldError] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.fields = fields or []


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(code="NOT_FOUND", message=message, status_code=status.HTTP_404_NOT_FOUND)


class ConflictStaleError(AppError):
    def __init__(self, message: str = "The resource has changed since it was loaded"):
        super().__init__(code="CONFLICT_STALE", message=message, status_code=status.HTTP_409_CONFLICT)


class ConflictVersionError(AppError):
    def __init__(self, message: str = "Version conflict detected"):
        super().__init__(
            code="CONFLICT_VERSION",
            message=message,
            status_code=status.HTTP_409_CONFLICT,
        )


class RateLimitedError(AppError):
    def __init__(self, message: str = "Too many requests. Please try again later."):
        super().__init__(
            code="RATE_LIMITED",
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


class FrozenError(AppError):
    def __init__(self, message: str = "The system is currently frozen for review or maintenance"):
        super().__init__(
            code="FROZEN",
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class TokenInvalidError(AppError):
    """Approval token invalid or expired. Uses 404 per build-plan/contracts.md to avoid leaking token existence."""

    def __init__(self, message: str = "The approval token is invalid or has expired"):
        super().__init__(code="TOKEN_INVALID", message=message, status_code=status.HTTP_404_NOT_FOUND)


class UpstreamUnavailableError(AppError):
    def __init__(self, message: str = "Upstream service is currently unavailable"):
        super().__init__(
            code="UPSTREAM_UNAVAILABLE",
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def create_error_response(
    status_code: int,
    code: str,
    message: str,
    fields: list[FieldError] | None = None,
) -> JSONResponse:
    correlation_id = get_correlation_id()
    envelope = ErrorEnvelope(
        error=ErrorDetail(
            code=code,
            message=message,
            correlation_id=correlation_id,
            fields=fields or [],
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=envelope.model_dump(),
    )


def register_error_handlers(app: FastAPI) -> None:
    """Register uniform exception handlers producing the standard error envelope."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return create_error_response(
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            fields=exc.fields,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = []
        for err in exc.errors():
            loc = err.get("loc", ())
            # format path like 'body.field' or 'query.param'
            path = ".".join(str(item) for item in loc)
            msg = err.get("msg", "Invalid field")
            fields.append(FieldError(path=path, message=msg))

        return create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            code="VALIDATION_FAILED",
            message="Request validation failed. Please check the input fields.",
            fields=fields,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code_map = {
            404: "NOT_FOUND",
            409: "CONFLICT_STALE",
            422: "VALIDATION_FAILED",
            429: "RATE_LIMITED",
            503: "UPSTREAM_UNAVAILABLE",
        }
        code = code_map.get(exc.status_code, "INTERNAL" if exc.status_code >= 500 else "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "A request error occurred."
        return create_error_response(
            status_code=exc.status_code,
            code=code,
            message=message,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception")
        # Never leak stack trace to client
        return create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL",
            message="An unexpected internal error occurred. Please contact support with the correlation id.",
        )
