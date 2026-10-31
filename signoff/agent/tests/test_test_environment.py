"""Regression checks for credential isolation and destructive test database selection."""

import pytest

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
