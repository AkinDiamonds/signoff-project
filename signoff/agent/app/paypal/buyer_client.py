"""Buyer-side PayPal dispute creation with an auth assertion.

Only the demo simulator and shop packages may import this module (enforced by
the import contract and the architecture guard). The agent can never create a
dispute; it only responds to one.

The buyer assertion is a compact HS256 JWT signed with the merchant's client
secret, as PayPal's ``PayPal-Auth-Assertion`` header expects.
"""

import base64
import hashlib
import hmac
import json
import logging
from decimal import Decimal
from typing import Any

import httpx

from agent.app.domain.money import Money
from agent.app.errors import AppError, TokenInvalidError, UpstreamUnavailableError
from agent.app.paypal.auth import PayPalAuth, get_paypal_debug_id
from agent.app.paypal.models import Dispute, parse_dispute
from agent.app.settings import SANDBOX_PAYPAL_HOST, Settings, is_allowed_paypal_url

logger = logging.getLogger(__name__)


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def build_buyer_assertion(client_id: str, client_secret: str, payer_id: str) -> str:
    """Build the HS256 JWT PayPal uses to act on a buyer's behalf."""
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(
        json.dumps({"iss": client_id, "payer_id": payer_id}, separators=(",", ":")).encode()
    )
    signing_input = f"{header}.{payload}"
    signature = hmac.new(
        client_secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{signing_input}.{_b64url(signature)}"


def _format_amount(amount: Decimal | Money) -> Decimal:
    value = amount.value if isinstance(amount, Money) else Decimal(amount)
    if not value.is_finite() or value <= 0:
        raise ValueError(f"Dispute amount must be finite and positive, got {value}")
    exponent = value.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise ValueError(f"Dispute amount cannot have more than two decimals, got {value}")
    return value


class BuyerDisputeClient:
    """Create disputes as the buyer would, using the sandbox API."""

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

    async def create_dispute(
        self,
        *,
        reason: str,
        amount: Decimal | Money,
        currency: str,
        seller_transaction_id: str | None,
        buyer_payer_id: str,
        buyer_email: str | None = None,
        message: str | None = None,
    ) -> Dispute:
        """Create a dispute and return PayPal's response model.

        Mutating calls are never retried: a failed create is released by the
        caller and reported with its correlation id.
        """
        if not self.client_id or not self.client_secret:
            raise TokenInvalidError("Missing PayPal credentials for buyer assertion")

        value = _format_amount(amount)
        transaction: dict[str, Any] = {
            "buyer_transaction_id": seller_transaction_id or "",
            "seller_transaction_id": seller_transaction_id,
            "buyer": {"payer_id": buyer_payer_id},
        }
        if buyer_email:
            transaction["buyer"]["email"] = buyer_email

        payload: dict[str, Any] = {
            "reason": reason,
            "dispute_amount": {"currency_code": currency.upper(), "value": f"{value:.2f}"},
            "disputed_transactions": [transaction],
        }
        if message:
            payload["messages"] = [{"posted_by": "BUYER", "content": message}]

        token = await self.auth.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "PayPal-Auth-Assertion": build_buyer_assertion(
                self.client_id, self.client_secret, buyer_payer_id
            ),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        client = await self._get_http_client()
        try:
            resp = await client.post(
                f"{self.base_url}/v1/customer/disputes", json=payload, headers=headers
            )
        except (httpx.NetworkError, httpx.TimeoutException) as exc:
            raise UpstreamUnavailableError(f"Buyer dispute creation failed: {exc}") from exc

        debug_id = get_paypal_debug_id(resp)
        if resp.status_code == 401:
            raise TokenInvalidError("PayPal rejected the buyer assertion")
        if not 200 <= resp.status_code < 300:
            raise AppError(
                code="PAYPAL_CREATE_FAILED",
                message=(
                    f"PayPal create-dispute returned HTTP {resp.status_code} "
                    f"(debug_id={debug_id})"
                ),
                status_code=502,
            )

        try:
            data = resp.json()
        except Exception as exc:
            raise UpstreamUnavailableError("PayPal returned non-JSON response") from exc
        return parse_dispute(data)

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        if self._owns_auth:
            await self.auth.close()

    async def __aenter__(self) -> "BuyerDisputeClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()
