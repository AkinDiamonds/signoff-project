"""PayPal Orders API client for checkout order creation and capture.

Importable ONLY by the shop package (enforced by .importlinter and architecture guard).
The agent and policy packages must never import this module.
"""

import logging
from decimal import Decimal
from typing import Any

import httpx

from agent.app.errors import AppError, NotFoundError, UpstreamUnavailableError
from agent.app.paypal.auth import PayPalAuth, get_paypal_debug_id
from agent.app.settings import SANDBOX_PAYPAL_HOST, Settings, is_allowed_paypal_url

logger = logging.getLogger(__name__)


class PayPalOrderError(AppError):
    """Base error for PayPal order operations."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        debug_id: str | None = None,
        error_code: str | None = None,
    ):
        super().__init__(code="PAYPAL_ORDER_ERROR", message=message, status_code=status_code)
        self.debug_id = debug_id
        self.error_code = error_code


class PayPalOrdersClient:
    """Client for PayPal v2 Checkout Orders (create, capture, and inspect)."""

    def __init__(
        self,
        auth: PayPalAuth | None = None,
        base_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
    ) -> None:
        settings = Settings()
        self.client_id = client_id or settings.paypal_client_id
        self.client_secret = client_secret or settings.paypal_client_secret
        self._custom_client = http_client
        self._client: httpx.AsyncClient | None = None
        self._owns_auth = auth is None
        self.auth = auth or PayPalAuth(
            client_id=self.client_id,
            client_secret=self.client_secret,
            base_url=base_url,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            http_client=http_client,
        )
        self.base_url = (base_url or settings.paypal_base_url).rstrip("/")
        if not is_allowed_paypal_url(self.base_url, settings.paypal_env):
            raise ValueError(
                f"PayPal base URL must be HTTPS on {SANDBOX_PAYPAL_HOST}, got '{self.base_url}'"
            )

    async def _get_http_client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=10.0, follow_redirects=False)
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
        if self._owns_auth:
            await self.auth.close()

    async def create_order(
        self,
        *,
        amount: Decimal,
        currency: str = "USD",
        reference_id: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Create a PayPal v2 order for customer checkout."""
        token = await self.auth.get_access_token()
        client = await self._get_http_client()
        url = f"{self.base_url}/v2/checkout/orders"

        payload: dict[str, Any] = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": reference_id or "ORDER",
                    "description": description or "Signoff Candle Order",
                    "amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}",
                    },
                }
            ],
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

        try:
            resp = await client.post(url, json=payload, headers=headers)
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.error("PayPal order create network failure: %s", exc)
            raise UpstreamUnavailableError("PayPal order creation timed out") from exc

        debug_id = get_paypal_debug_id(resp)
        if resp.status_code not in (200, 201):
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            msg = error_data.get("message") or f"Order create failed with status {resp.status_code}"
            logger.warning("PayPal order create failed: status=%s debug_id=%s msg=%s", resp.status_code, debug_id, msg)
            raise PayPalOrderError(message=msg, status_code=resp.status_code, debug_id=debug_id)

        return resp.json()

    async def capture_order(self, order_id: str) -> dict[str, Any]:
        """Capture payment for an approved PayPal v2 order."""
        token = await self.auth.get_access_token()
        client = await self._get_http_client()
        url = f"{self.base_url}/v2/checkout/orders/{order_id}/capture"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

        try:
            resp = await client.post(url, headers=headers)
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.error("PayPal order capture network failure: %s", exc)
            raise UpstreamUnavailableError("PayPal order capture timed out") from exc

        debug_id = get_paypal_debug_id(resp)
        if resp.status_code not in (200, 201):
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            details = error_data.get("details", [])
            issue = details[0].get("issue") if details else error_data.get("name")
            msg = error_data.get("message") or f"Order capture failed with status {resp.status_code}"
            logger.warning(
                "PayPal order capture failed: status=%s debug_id=%s issue=%s msg=%s",
                resp.status_code,
                debug_id,
                issue,
                msg,
            )
            if resp.status_code == 404:
                raise NotFoundError(f"PayPal order '{order_id}' not found")
            raise PayPalOrderError(message=msg, status_code=resp.status_code, debug_id=debug_id, error_code=issue)

        return resp.json()

    async def get_order(self, order_id: str) -> dict[str, Any]:
        """Fetch status and details of a PayPal v2 order."""
        token = await self.auth.get_access_token()
        client = await self._get_http_client()
        url = f"{self.base_url}/v2/checkout/orders/{order_id}"

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

        try:
            resp = await client.get(url, headers=headers)
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.error("PayPal order fetch network failure: %s", exc)
            raise UpstreamUnavailableError("PayPal order lookup timed out") from exc

        debug_id = get_paypal_debug_id(resp)
        if resp.status_code == 404:
            raise NotFoundError(f"PayPal order '{order_id}' not found")
        if resp.status_code != 200:
            msg = f"Order fetch failed with status {resp.status_code}"
            raise PayPalOrderError(message=msg, status_code=resp.status_code, debug_id=debug_id)

        return resp.json()
