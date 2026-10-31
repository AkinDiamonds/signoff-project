"""Regression checks for credential isolation and destructive test database selection."""

import pytest

from scripts.e2e_stack import stack_env
from scripts.test_environment import DEFAULT_TEST_DATABASE_URL, isolate_test_environment


def test_all_settings_aliases_removed_without_removing_runtime_proxy():
    values = {
        "DATABASE_URL": "postgresql+psycopg://user:secret@shared.invalid/merchant",
        "APP_ENV": "prod",
        "PAYPAL_ENV": "stub",
        "PAYPAL_BASE_URL": "http://localhost:4010",
        "LLM_PROVIDER": "fake",
        "llm_api_key": "not-a-real-secret",
        "DEMO_HOLD_DISPUTES": "true",
        "DEMO_POOL_HOLD": "true",
        "HTTPS_PROXY": "http://proxy:8080",
    }
    isolate_test_environment(values)
    assert values == {
        "APP_ENV": "test",
        "DATABASE_URL": DEFAULT_TEST_DATABASE_URL,
        "HTTPS_PROXY": "http://proxy:8080",
    }


def test_e2e_stack_never_inherits_deployed_credentials_or_mode_aliases(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://user:fixture@shared.invalid/merchant')
    monkeypatch.setenv('DEMO_HOLD_DISPUTES', 'true')
    monkeypatch.setenv('DEMO_POOL_HOLD', 'true')
    monkeypatch.setenv('LLM_API_KEY', 'fixture-shared-key')
    monkeypatch.setenv('MERCHANT_PASSWORD_HASH', 'fixture-shared-credential')
    monkeypatch.setenv('PAYPAL_MERCHANT_ID', 'SHARED-MERCHANT')
    env = stack_env()
    assert env['DATABASE_URL'].endswith('@localhost:5432/signoff_e2e')
    assert env['APP_ENV'] == 'test' and env['PAYPAL_ENV'] == 'stub'
    assert env['DEMO_HOLD_DISPUTES'] == 'false' and 'DEMO_POOL_HOLD' not in env
    assert env['PAYPAL_MERCHANT_ID'] == 'MOCK-MERCHANT-001'
    assert 'LLM_API_KEY' not in env and 'MERCHANT_PASSWORD_HASH' not in env


def test_explicit_test_database_is_preserved():
    url = "postgresql+psycopg://signoff:signoff@127.0.0.1:5432/signoff_test_v3"
    values = {"SIGNOFF_TEST_DATABASE_URL": url}
    isolate_test_environment(values)
    assert values["DATABASE_URL"] == url


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://user:do-not-print@shared.invalid/signoff_test",
        "postgresql+psycopg://user:do-not-print@localhost/signoff",
        "postgresql+psycopg://user:do-not-print@localhost/signoff_test?host=shared.invalid",
        "sqlite:///merchant.db",
        "invalid-do-not-print",
    ],
)
def test_unsafe_database_refused_without_leaking_values(url):
    values = {"SIGNOFF_TEST_DATABASE_URL": url, "APP_ENV": "prod"}
    with pytest.raises(ValueError) as error:
        isolate_test_environment(values)
    assert url not in str(error.value)
    assert "do-not-print" not in str(error.value)
    assert values["APP_ENV"] == "prod"
