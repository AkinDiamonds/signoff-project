"""PayPal OAuth2 client credentials authentication with in-flight locking and caching."""

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any
from urllib.parse import urlparse

import httpx

from agent.app.errors import TokenInvalidError, UpstreamUnavailableError
from agent.app.paypal.models import TokenResponse, parse_token_response
from agent.app.settings import SANDBOX_PAYPAL_HOST, Settings

logger = logging.getLogger(__name__)


def get_paypal_debug_id(resp: httpx.Response) -> str:
    """Extract paypal-debug-id header safely with fallback."""
    return resp.headers.get("paypal-debug-id") or resp.headers.get("Paypal-Debug-Id") or "none"


class PayPalAuth:
    """Manages PayPal OAuth2 access tokens with caching, expiry margin, and concurrency safety.

    Guarantees:
    - Never logs access tokens.
    - Single in-flight token refresh under concurrency.
    - Refresh margin (default 60s) before token expires.
    - Pluggable time provider for deterministic testing.
    - Async context manager and close() support for connection cleanup.
    """

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        base_url: str | None = None,
        expiry_margin_seconds: float = 60.0,
        http_client: httpx.AsyncClient | None = None,
        time_provider: Callable[[], float] | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
    ) -> None:
        settings = Settings()
        self.client_id = client_id or settings.paypal_client_id
        self.client_secret = client_secret or settings.paypal_client_secret
        self.base_url = (base_url or str(settings.paypal_base_url)).rstrip("/")
        self.expiry_margin_seconds = expiry_margin_seconds
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self._custom_client = http_client
        self._client: httpx.AsyncClient | None = None
        self._time_provider = time_provider or time.time
        self._access_token: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

        # Validate host safety
        parsed = urlparse(self.base_url)
        if parsed.scheme != "https" or parsed.hostname != SANDBOX_PAYPAL_HOST:
            raise ValueError(
                f"PayPal base URL must be HTTPS on {SANDBOX_PAYPAL_HOST}, got '{self.base_url}'"
            )

    async def _get_http_client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=self.connect_timeout,
                    read=self.read_timeout,
                    write=self.connect_timeout,
                    pool=self.connect_timeout,
                )
            )
        return self._client

    async def close(self) -> None:
        """Close underlying HTTP client if owned."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    async def __aenter__(self) -> "PayPalAuth":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()

    @property
    def is_token_valid(self) -> bool:
        """Check if cached token exists and is not within expiry margin."""
        if not self._access_token:
            return False
        current_time = self._time_provider()
        return (current_time + self.expiry_margin_seconds) < self._expires_at

    def invalidate_token(self) -> None:
        """Explicitly invalidate current cached token."""
        self._access_token = None
        self._expires_at = 0.0

    async def get_access_token(self, force_refresh: bool = False) -> str:
        """Retrieve a valid access token, refreshing if necessary or forced.

        Uses an async lock to ensure exactly one in-flight refresh request
        when multiple concurrent coroutines request a token.
        """
        if not force_refresh and self.is_token_valid and self._access_token is not None:
            return self._access_token

        async with self._lock:
            # Double check inside lock in case another coroutine refreshed it while we waited
            if not force_refresh and self.is_token_valid and self._access_token is not None:
                return self._access_token

            token_resp = await self._fetch_token()
            self._access_token = token_resp.access_token
            self._expires_at = self._time_provider() + float(token_resp.expires_in)
            return self._access_token

    async def get_auth_header(self, force_refresh: bool = False) -> dict[str, str]:
        """Return Authorization header dictionary for PayPal API requests."""
        token = await self.get_access_token(force_refresh=force_refresh)
        return {"Authorization": f"Bearer {token}"}

    async def _fetch_token(self) -> TokenResponse:
        """Execute OAuth2 client credentials grant request against PayPal sandbox."""
        if not self.client_id or not self.client_secret:
            raise TokenInvalidError("Missing PayPal client_id or client_secret for authentication")

        token_url = f"{self.base_url}/v1/oauth2/token"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en_US",
        }
        data = {"grant_type": "client_credentials"}

        client = await self._get_http_client()

        try:
            logger.info("Requesting PayPal OAuth access token")
            resp = await client.post(
                token_url,
                data=data,
                headers=headers,
                auth=(self.client_id, self.client_secret),
            )
            debug_id = get_paypal_debug_id(resp)
            logger.info("PayPal OAuth response received (status=%d, debug_id=%s)", resp.status_code, debug_id)

            if resp.status_code == 401 or resp.status_code == 400:
                logger.error("PayPal OAuth credentials rejected (status=%d, debug_id=%s)", resp.status_code, debug_id)
                raise TokenInvalidError(f"PayPal OAuth authentication failed: HTTP {resp.status_code}")

            if resp.status_code >= 500:
                logger.error("PayPal OAuth server error (status=%d, debug_id=%s)", resp.status_code, debug_id)
                raise UpstreamUnavailableError(f"PayPal OAuth service unavailable: HTTP {resp.status_code}")

            if resp.status_code != 200:
                logger.error("PayPal OAuth unexpected response (status=%d, debug_id=%s)", resp.status_code, debug_id)
                raise UpstreamUnavailableError(f"PayPal OAuth returned unexpected status HTTP {resp.status_code}")

            try:
                payload: dict[str, Any] = resp.json()
            except Exception as exc:
                raise UpstreamUnavailableError("PayPal OAuth returned non-JSON response") from exc

            return parse_token_response(payload)

        except (httpx.NetworkError, httpx.TimeoutException) as exc:
            logger.error("PayPal OAuth network failure: %s", exc)
            raise UpstreamUnavailableError(f"PayPal OAuth network failure: {exc}") from exc
