"""Tests for system health and readiness endpoints."""

from agent.app.main import create_app
from agent.app.settings import AppEnv, PayPalEnv, Settings
from fastapi.testclient import TestClient


def test_healthz_endpoint():
    settings = Settings(app_env=AppEnv.local)
    app = create_app(settings)
    client = TestClient(app)

    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app_env"] == "local"


def test_readyz_endpoint():
    app = create_app()
    client = TestClient(app)

    response = client.get("/readyz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "stubbed"


def test_api_status_endpoint():
    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        demo_frozen=True,
    )
    app = create_app(settings)
    client = TestClient(app)

    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["env"] == "test"
    assert data["paypal_env"] == "stub"
    assert data["demo_frozen"] is True
