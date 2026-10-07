"""Tests for standard error envelope and exception handlers."""

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from agent.app.errors import (
    ConflictStaleError,
    ConflictVersionError,
    FrozenError,
    NotFoundError,
    RateLimitedError,
    TokenInvalidError,
    UpstreamUnavailableError,
)
from agent.app.main import create_app


def test_404_not_found_envelope_shape():
    app = create_app()
    client = TestClient(app)

    response = client.get("/non-existent-route-xyz")
    assert response.status_code == 404

    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "NOT_FOUND"
    assert "correlation_id" in error
    assert isinstance(error["message"], str)
    assert isinstance(error["fields"], list)


def test_422_validation_failed_envelope_shape():
    app = create_app()

    class ItemPayload(BaseModel):
        name: str
        age: int

    @app.post("/test-validation")
    async def sample_endpoint(payload: ItemPayload):
        return {"received": payload.name}

    client = TestClient(app)

    # Missing age, invalid type
    response = client.post("/test-validation", json={"name": "Alice", "age": "not-an-int"})
    assert response.status_code == 422

    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "VALIDATION_FAILED"
    assert "correlation_id" in error
    assert len(error["fields"]) > 0
    assert any("age" in f["path"] for f in error["fields"])


def test_500_unhandled_exception_envelope_no_stacktrace():
    """Unhandled exception: envelope with correlation id, no stack trace in the body."""
    app = create_app()

    @app.get("/trigger-crash")
    async def crash():
        raise RuntimeError("Secret internal database password connection crash!")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/trigger-crash")
    assert response.status_code == 500

    data = response.json()
    assert "error" in data
    error = data["error"]
    assert error["code"] == "INTERNAL"
    assert "correlation_id" in error
    # Verify no stack trace or sensitive error details leaked to the client
    assert "Secret internal database password" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text


@pytest.mark.parametrize(
    "exc_cls, expected_status, expected_code",
    [
        (NotFoundError, 404, "NOT_FOUND"),
        (ConflictStaleError, 409, "CONFLICT_STALE"),
        (ConflictVersionError, 409, "CONFLICT_VERSION"),
        (RateLimitedError, 429, "RATE_LIMITED"),
        (FrozenError, 503, "FROZEN"),
        (TokenInvalidError, 404, "TOKEN_INVALID"),
        (UpstreamUnavailableError, 503, "UPSTREAM_UNAVAILABLE"),
    ],
)
def test_custom_app_exceptions_envelope(exc_cls, expected_status, expected_code):
    app = create_app()

    @app.get(f"/test-{expected_code}")
    async def trigger():
        raise exc_cls("Custom error message for test")

    client = TestClient(app)
    response = client.get(f"/test-{expected_code}")
    assert response.status_code == expected_status

    data = response.json()
    assert data["error"]["code"] == expected_code
    assert data["error"]["message"] == "Custom error message for test"
    assert "correlation_id" in data["error"]
