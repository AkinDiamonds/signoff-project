"""The real product receives PayPal disputes; it never hosts buyer dispute writes."""

import pytest
from fastapi.testclient import TestClient

from agent.app.db.session import get_db_session
from agent.app.main import create_app
from agent.app.settings import AppEnv, PayPalEnv, Settings


@pytest.mark.parametrize('mode', [AppEnv.local, AppEnv.prod])
@pytest.mark.parametrize('method,path', [
    ('GET', '/api/shop/orders/ANY/dispute?email=buyer@example.test'),
    ('POST', '/api/shop/orders/ANY/dispute'),
    ('POST', '/api/shop/orders/ANY/dispute/messages'),
    ('POST', '/api/shop/orders/ANY/dispute/offer-response'),
])
def test_real_sandbox_buyer_dispute_routes_are_unavailable_before_database_access(mode, method, path, monkeypatch):
    settings = Settings().model_copy(update={'app_env': mode, 'paypal_env': PayPalEnv.sandbox})
    app = create_app(settings)
    monkeypatch.setattr('agent.app.main.prepare_production_schema', lambda _: None)

    def no_database():
        pytest.fail('A disabled buyer route must not read or mutate the database')

    app.dependency_overrides[get_db_session] = no_database
    with TestClient(app) as client:
        response = client.request(method, path, json={})
    assert response.status_code == 404
