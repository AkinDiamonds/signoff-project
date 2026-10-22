"""Application settings and startup validation."""

from decimal import Decimal
from enum import StrEnum
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppEnv(StrEnum):
    local = "local"
    test = "test"
    prod = "prod"


class PayPalEnv(StrEnum):
    sandbox = "sandbox"
    stub = "stub"


SANDBOX_PAYPAL_HOST = "api-m.sandbox.paypal.com"
ALLOWED_PAYPAL_URL = f"https://{SANDBOX_PAYPAL_HOST}"
STUB_PAYPAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def is_allowed_paypal_url(url: str, paypal_env: "PayPalEnv") -> bool:
    """Sandbox HTTPS in every environment; plain HTTP only to a stub host in stub mode."""
    parsed = urlparse(url)
    if paypal_env == PayPalEnv.stub and parsed.hostname in STUB_PAYPAL_HOSTS:
        return parsed.scheme in ("http", "https")
    return parsed.scheme == "https" and parsed.hostname == SANDBOX_PAYPAL_HOST


class Settings(BaseSettings):
    """Immutable application settings validated at startup."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    # Core environment
    app_env: AppEnv = Field(default=AppEnv.local, validation_alias="APP_ENV")

    # PayPal configuration
    paypal_env: PayPalEnv = Field(default=PayPalEnv.sandbox, validation_alias="PAYPAL_ENV")
    paypal_client_id: str = Field(default="", validation_alias="PAYPAL_CLIENT_ID")
    paypal_client_secret: str = Field(default="", validation_alias="PAYPAL_CLIENT_SECRET")
    paypal_webhook_id: str = Field(default="", validation_alias="PAYPAL_WEBHOOK_ID")
    paypal_merchant_id: str = Field(default="", validation_alias="PAYPAL_MERCHANT_ID")
    paypal_buyer_payer_id: str = Field(default="", validation_alias="PAYPAL_BUYER_PAYER_ID")
    paypal_base_url: str = Field(default=ALLOWED_PAYPAL_URL, validation_alias="PAYPAL_BASE_URL")

    # Database
    database_url: str = Field(
        default="postgresql+psycopg://signoff:signoff@localhost:5432/signoff",
        validation_alias="DATABASE_URL",
    )

    # LLM configuration
    llm_provider: str = Field(default="glimmer", validation_alias="LLM_PROVIDER")
    llm_model: str = Field(default="", validation_alias="LLM_MODEL")
    llm_api_key: str = Field(default="", validation_alias="LLM_API_KEY")
    llm_api_base_url: str = Field(default="", validation_alias="LLM_API_BASE_URL")
    llm_daily_budget_usd: Decimal = Field(default=Decimal("3.00"), validation_alias="LLM_DAILY_BUDGET_USD")
    use_scenario_cache: bool = Field(default=True, validation_alias="USE_SCENARIO_CACHE")
    fake_llm_fail: bool = Field(default=False, validation_alias="FAKE_LLM_FAIL")

    # Service endpoints and security
    public_base_url: str = Field(default="http://localhost:8000", validation_alias="PUBLIC_BASE_URL")
    web_base_url: str = Field(default="http://localhost:5173", validation_alias="WEB_BASE_URL")
    allowed_origins: str = Field(default="http://localhost:5173", validation_alias="ALLOWED_ORIGINS")
    approval_token_secret: str = Field(default="", validation_alias="APPROVAL_TOKEN_SECRET")
    demo_frozen: bool = Field(default=False, validation_alias="DEMO_FROZEN")

    # Demo scenario generator
    demo_pool_size_per_scenario: int = Field(default=3, ge=1, validation_alias="DEMO_POOL_SIZE_PER_SCENARIO")
    demo_scenarios_per_session_per_day: int = Field(
        default=30, ge=1, validation_alias="DEMO_SCENARIOS_PER_SESSION_PER_DAY"
    )
    demo_scenarios_per_ip_per_day: int = Field(
        default=60, ge=1, validation_alias="DEMO_SCENARIOS_PER_IP_PER_DAY"
    )
    demo_session_ttl_hours: int = Field(default=24, ge=1, validation_alias="DEMO_SESSION_TTL_HOURS")

    @field_validator("paypal_base_url")
    @classmethod
    def default_empty_base_url(cls, v: str) -> str:
        """An unset base URL means the recorded sandbox endpoint."""
        return v or ALLOWED_PAYPAL_URL

    @model_validator(mode="after")
    def validate_env_combinations(self) -> "Settings":
        """Startup invariants:
        - The PayPal base URL is sandbox HTTPS, or a localhost stub URL in stub mode.
        - Stub PayPal is forbidden in production.
        - In prod, ensure critical config is present without revealing values.
        """
        parsed = urlparse(self.paypal_base_url)
        if not is_allowed_paypal_url(self.paypal_base_url, self.paypal_env):
            if parsed.scheme != "https":
                raise ValueError(f"PayPal base URL must use HTTPS scheme, got '{parsed.scheme or 'none'}'")
            raise ValueError(
                f"Live PayPal endpoints are strictly prohibited. Host must be {SANDBOX_PAYPAL_HOST}, "
                f"got '{parsed.hostname or ''}'"
            )

        if self.app_env == AppEnv.prod and self.paypal_env == PayPalEnv.stub:
            raise ValueError("PAYPAL_ENV=stub is strictly forbidden when APP_ENV=prod")

        if self.app_env == AppEnv.prod and self.llm_provider.lower() == "fake":
            raise ValueError("LLM_PROVIDER=fake is strictly forbidden when APP_ENV=prod")

        if self.app_env == AppEnv.prod:
            missing = []
            if not self.paypal_client_id:
                missing.append("PAYPAL_CLIENT_ID")
            if not self.paypal_client_secret:
                missing.append("PAYPAL_CLIENT_SECRET")
            if not self.approval_token_secret:
                missing.append("APPROVAL_TOKEN_SECRET")
            if missing:
                raise ValueError(
                    f"Production startup failed. Missing required environment variables: {', '.join(missing)}"
                )
            if len(self.approval_token_secret) < 32:
                raise ValueError("APPROVAL_TOKEN_SECRET must be at least 32 characters long in production")

        return self

    @property
    def parsed_allowed_origins(self) -> list[str]:
        """Parse comma-separated allowed origins into a clean list."""
        if not self.allowed_origins.strip():
            return []
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
