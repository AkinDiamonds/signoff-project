"""Tests for Settings validation and edge cases."""

import pytest
from pydantic import ValidationError

from agent.app.settings import AppEnv, PayPalEnv, Settings


def test_valid_settings_local_and_sandbox():
    settings = Settings(
        app_env=AppEnv.local,
        paypal_env=PayPalEnv.sandbox,
    )
    assert settings.app_env == AppEnv.local
    assert settings.paypal_env == PayPalEnv.sandbox
    assert settings.paypal_base_url == "https://api-m.sandbox.paypal.com"


def test_valid_settings_local_and_stub():
    settings = Settings(
        app_env=AppEnv.local,
        paypal_env=PayPalEnv.stub,
    )
    assert settings.paypal_env == PayPalEnv.stub


def test_prod_with_stub_refused():
    """Startup validation: stub is refused when APP_ENV is prod."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            app_env=AppEnv.prod,
            paypal_env=PayPalEnv.stub,
            paypal_client_id="cid",
            paypal_client_secret="csecret",
            approval_token_secret="token_secret",
        )
    assert "PAYPAL_ENV=stub is strictly forbidden when APP_ENV=prod" in str(exc_info.value)


def test_live_paypal_base_url_refused():
    """Startup validation: live PayPal URL is strictly refused."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            paypal_base_url="https://api-m.paypal.com",
        )
    assert "Live PayPal endpoints are strictly prohibited" in str(exc_info.value)


def test_paypal_base_url_requires_https():
    """Startup validation: non-HTTPS or scheme-less PayPal URL is refused."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(paypal_base_url="http://api-m.sandbox.paypal.com")
    assert "PayPal base URL must use HTTPS scheme" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info2:
        Settings(paypal_base_url="api-m.sandbox.paypal.com")
    assert "PayPal base URL must use HTTPS scheme" in str(exc_info2.value)


def test_prod_missing_required_variables_lists_names_only():
    """Missing required variables in prod: fail at startup listing names only, never values."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            app_env=AppEnv.prod,
            paypal_env=PayPalEnv.sandbox,
            paypal_client_id="",
            paypal_client_secret="",
            approval_token_secret="",
        )
    error_msg = str(exc_info.value)
    assert "PAYPAL_CLIENT_ID" in error_msg
    assert "PAYPAL_CLIENT_SECRET" in error_msg
    assert "APPROVAL_TOKEN_SECRET" in error_msg


def test_prod_short_approval_token_secret_refused():
    """Startup validation: approval token secret in prod must be at least 32 characters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            app_env=AppEnv.prod,
            paypal_env=PayPalEnv.sandbox,
            paypal_client_id="cid",
            paypal_client_secret="csecret",
            approval_token_secret="too_short_secret",
        )
    assert "APPROVAL_TOKEN_SECRET must be at least 32 characters" in str(exc_info.value)


def test_settings_is_frozen():
    """Settings object is frozen."""
    settings = Settings()
    with pytest.raises(ValidationError, match="Instance is frozen"):
        settings.app_env = AppEnv.prod


def test_extra_unknown_env_vars_ignored():
    """Unknown extra environment variables are ignored."""
    settings = Settings.model_validate({"SOME_UNKNOWN_VAR_123": "value"})
    assert not hasattr(settings, "SOME_UNKNOWN_VAR_123")


def test_empty_cors_allowlist_returns_empty_list():
    """Empty CORS allowlist produces empty list (denies all cross-origin requests)."""
    settings = Settings(allowed_origins="")
    assert settings.parsed_allowed_origins == []

    settings_whitespace = Settings(allowed_origins="   ")
    assert settings_whitespace.parsed_allowed_origins == []


def test_multiple_cors_origins_parsed():
    settings = Settings(allowed_origins="http://localhost:3000, https://signoff.example.com")
    assert settings.parsed_allowed_origins == [
        "http://localhost:3000",
        "https://signoff.example.com",
    ]
