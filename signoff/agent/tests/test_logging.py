"""Tests for request-id middleware and JSON structured logging."""

import json
import logging
import uuid

from fastapi.testclient import TestClient

from agent.app.logging import JSONFormatter
from agent.app.main import create_app


def test_valid_request_id_preserved():
    app = create_app()
    client = TestClient(app)

    custom_id = "req-12345-valid-id"
    response = client.get("/healthz", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == custom_id
    assert response.headers["X-Correlation-ID"] == custom_id


def test_oversized_request_id_replaced():
    """Client-supplied request id too long: replace with a fresh one."""
    app = create_app()
    client = TestClient(app)

    oversized_id = "a" * 100
    response = client.get("/healthz", headers={"X-Request-ID": oversized_id})
    assert response.status_code == 200

    issued_id = response.headers["X-Request-ID"]
    assert issued_id != oversized_id
    uuid.UUID(issued_id)


def test_odd_characters_request_id_replaced():
    """Client-supplied request id with odd characters: replace with a fresh one."""
    app = create_app()
    client = TestClient(app)

    invalid_id = "<script>alert(1)</script>"
    response = client.get("/healthz", headers={"X-Request-ID": invalid_id})
    assert response.status_code == 200

    issued_id = response.headers["X-Request-ID"]
    assert issued_id != invalid_id
    uuid.UUID(issued_id)


def test_request_id_propagation_into_logs(caplog):
    """Request id propagation into structured logs."""
    app = create_app()

    @app.get("/log-test")
    async def log_route():
        logger = logging.getLogger("test_logger")
        logger.info("Test message from inside route")
        return {"ok": True}

    client = TestClient(app)
    custom_id = "trace-uuid-999"

    with caplog.at_level(logging.INFO):
        response = client.get("/log-test", headers={"X-Request-ID": custom_id})

    assert response.status_code == 200

    route_records = [r for r in caplog.records if r.name == "test_logger"]
    assert len(route_records) >= 1
    record = route_records[0]
    assert getattr(record, "correlation_id", "") == custom_id

    # Verify JSON formatter output
    formatter = JSONFormatter()
    formatted_json = formatter.format(record)
    parsed = json.loads(formatted_json)
    assert parsed["message"] == "Test message from inside route"
    assert parsed["correlation_id"] == custom_id
    assert parsed["level"] == "INFO"
    assert "timestamp" in parsed
