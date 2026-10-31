"""Owner sessions protect merchant APIs, survive restarts and require CSRF on writes."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from agent.app.auth import hash_password, verify_password
from agent.app.db.base import Base
from agent.app.db.models import OwnerSession
from agent.app.db.session import get_db_session
from agent.app.main import create_app
from agent.app.settings import Settings

PASSWORD = "fictional-owner-password-123"
ORIGIN = "http://localhost:5173"


@pytest.fixture
def owner_app():
    settings = Settings(
        merchant_auth_enabled=True,
        merchant_email="owner@example.test",
        merchant_password_hash=hash_password(PASSWORD),
        approval_token_secret="fictional-session-secret-at-least-32-characters",
        allowed_origins=ORIGIN,
    )
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    app = create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db
    yield app, db, settings
    db.close()
    engine.dispose()


def sign_in(client):
    response = client.post(
        "/api/auth/login", json={"email": "owner@example.test", "password": PASSWORD}, headers={"Origin": ORIGIN}
    )
    assert response.status_code == 200
    assert "password" not in response.text
    assert response.json()["authenticated"] is True
    return response


def test_hash_roundtrip_and_wrong_password():
    encoded = hash_password(PASSWORD)
    assert PASSWORD not in encoded
    assert verify_password(PASSWORD, encoded)
    assert not verify_password("wrong", encoded)
    assert not verify_password(PASSWORD, "broken")


def test_login_protects_reads_and_requires_csrf_for_writes(owner_app):
    app, db, _ = owner_app
    with TestClient(app) as client:
        assert client.get("/api/disputes").status_code == 401
        assert client.get("/api/integrations/status").status_code == 401
        response = sign_in(client)
        assert "HttpOnly" in response.headers["set-cookie"]
        row = db.scalar(select(OwnerSession))
        assert row is not None
        assert row.token_hash not in response.text
        assert row.token_hash != client.cookies.get("signoff_session")
        protected = client.get("/api/disputes")
        assert protected.status_code == 200
        assert protected.headers["Cache-Control"] == "no-store"
        assert client.put("/api/charter", json={}).status_code == 403
        assert client.post("/api/auth/logout").status_code == 403
        csrf = response.json()["csrf_token"]
        assert client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 204
        assert client.get("/api/disputes").status_code == 401


def test_rejects_cross_origin_login_and_wrong_credentials(owner_app):
    app, _, _ = owner_app
    with TestClient(app) as client:
        assert (
            client.post(
                "/api/auth/login",
                json={"email": "owner@example.test", "password": PASSWORD},
                headers={"Origin": "https://unrelated.invalid"},
            ).status_code
            == 403
        )
        response = client.post("/api/auth/login", json={"email": "owner@example.test", "password": "wrong"})
        assert response.status_code == 401
        assert not response.headers.get("set-cookie")


def test_session_survives_api_restart_and_invalidates_after_password_change(owner_app):
    app, db, settings = owner_app
    first = TestClient(app)
    sign_in(first)
    restarted = create_app(settings)
    restarted.dependency_overrides[get_db_session] = lambda: db
    second = TestClient(restarted)
    second.cookies.update(first.cookies)
    assert second.get("/api/auth/session").json()["authenticated"] is True
    restarted.state.settings = settings.model_copy(
        update={"merchant_password_hash": hash_password("another-password-123")}
    )
    assert second.get("/api/auth/session").json()["authenticated"] is False


def test_expired_session_is_rejected(owner_app):
    app, db, _ = owner_app
    with TestClient(app) as client:
        sign_in(client)
        row = db.scalar(select(OwnerSession))
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
        assert client.get("/api/auth/session").json()["authenticated"] is False
        assert client.get("/api/disputes").status_code == 401


def test_login_rate_limit_persists_across_clients(owner_app):
    app, _, _ = owner_app
    for _ in range(5):
        response = TestClient(app).post("/api/auth/login", json={"email": "wrong@example.test", "password": "wrong"})
        assert response.status_code == 401
    assert (
        TestClient(app).post("/api/auth/login", json={"email": "wrong@example.test", "password": "wrong"}).status_code
        == 429
    )


def test_production_uses_secure_partitioned_cookie_and_cannot_disable_auth(owner_app):
    app, _, settings = owner_app
    from agent.app.settings import AppEnv

    app.state.settings = settings.model_copy(update={"app_env": AppEnv.prod, "merchant_auth_enabled": False})
    with TestClient(app, base_url="https://api.example.test") as client:
        assert client.get("/api/disputes").status_code == 401
        response = sign_in(client)
        cookie = response.headers["set-cookie"]
        assert "Secure" in cookie and "SameSite=none" in cookie and "Partitioned" in cookie
        assert "__Host-signoff_session" in cookie


def test_unprovisioned_owner_does_not_leave_merchant_access_public(owner_app):
    app, _, settings = owner_app
    app.state.settings = settings.model_copy(update={"merchant_password_hash": ""})
    with TestClient(app) as client:
        assert client.get("/api/disputes").status_code == 401
        assert client.post("/api/demo/scenarios/A").status_code == 401
        session = client.get("/api/auth/session").json()
        assert session["required"] is True and session["configured"] is False
        response = client.post("/api/auth/login", json={"email": "owner@example.test", "password": PASSWORD})
        assert response.status_code == 503
        assert "MERCHANT_PASSWORD_HASH" not in response.text


def test_readiness_distinguishes_configuration_from_checks(owner_app, monkeypatch):
    from unittest.mock import AsyncMock

    from agent.app.paypal.auth import PayPalAuth
    from agent.app.store.http_adapter import HttpStoreAdapter

    app, _, settings = owner_app
    app.state.settings = settings.model_copy(
        update={
            "paypal_client_id": "fictional-client",
            "paypal_client_secret": "fictional-secret",
            "store_api_key": "fictional-store-key",
            "paypal_merchant_id": "FICTIONAL-MERCHANT",
        }
    )
    monkeypatch.setattr(PayPalAuth, "get_access_token", AsyncMock(return_value="never-display-this-token"))
    monkeypatch.setattr(HttpStoreAdapter, "get_policies", lambda self: {"return_window_days": 30})
    with TestClient(app) as client:
        csrf = sign_in(client).json()["csrf_token"]
        before = client.get("/api/integrations/status").json()
        assert before["paypal"]["state"] == "configured"
        assert before["worker"]["state"] == "unknown"
        assert before["webhook"]["state"] == "unknown"
        assert before["merchant_id"] == "FICTIONAL-MERCHANT"
        assert client.post("/api/integrations/check").status_code == 403
        checked = client.post("/api/integrations/check", headers={"X-CSRF-Token": csrf})
        assert checked.status_code == 200
        assert checked.json()["paypal"]["state"] == "verified"
        assert checked.json()["store"]["state"] == "verified"
        assert checked.json()["paypal"]["checked_at"] is not None
        assert "never-display-this-token" not in checked.text
        assert "fictional-secret" not in checked.text
        app.state.settings = app.state.settings.model_copy(update={"paypal_client_secret": "rotated-secret"})
        assert client.get("/api/integrations/status").json()["paypal"]["state"] == "configured"


def test_failed_connection_check_is_not_reported_as_success(owner_app, monkeypatch):
    from unittest.mock import AsyncMock

    from agent.app.paypal.auth import PayPalAuth

    app, _, settings = owner_app
    app.state.settings = settings.model_copy(
        update={"paypal_client_id": "fictional", "paypal_client_secret": "fictional"}
    )
    monkeypatch.setattr(PayPalAuth, "get_access_token", AsyncMock(side_effect=RuntimeError("private-upstream-detail")))
    with TestClient(app) as client:
        csrf = sign_in(client).json()["csrf_token"]
        response = client.post("/api/integrations/check", headers={"X-CSRF-Token": csrf})
        assert response.status_code == 200
        assert response.json()["paypal"]["state"] == "failed"
        assert response.json()["webhook"]["state"] == "unknown"
        assert "private-upstream-detail" not in response.text


def test_worker_readiness_becomes_stale_and_webhook_is_observed(owner_app):
    from agent.app.db.models import IntegrationObservation, WebhookEvent
    from agent.app.integrations import observe

    app, db, _ = owner_app
    observe(db, "worker:fictional", "verified")
    db.add(
        WebhookEvent(
            id="WH-FICTIONAL",
            transmission_id="TX-FICTIONAL",
            event_type="CUSTOMER.DISPUTE.CREATED",
            raw_payload={},
            verified=True,
        )
    )
    db.commit()
    with TestClient(app) as client:
        sign_in(client)
        result = client.get("/api/integrations/status").json()
        assert result["worker"]["state"] == "verified"
        assert result["webhook"]["state"] == "verified"
        db.get(IntegrationObservation, "worker:fictional").checked_at = datetime.now(UTC) - timedelta(minutes=2)
        db.commit()
        assert client.get("/api/integrations/status").json()["worker"]["state"] == "stale"
