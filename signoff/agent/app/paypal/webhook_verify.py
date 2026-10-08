"""PayPal webhook signature verification, typed event envelopes, and verified token types.

Enforces Step 07 constraints:
- Signature verification against PayPal API or deterministic stub verifier.
- Stub verifier selectable only when PAYPAL_ENV is stub.
- VerifiedWebhook type constructable only via verifier.
- Event envelope discriminated union keyed by event type.
- Missing headers -> 400, Invalid signature -> 400, Service unavailable -> 503.
- Webhook ID mismatch -> 400.
"""

import json
import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Annotated, Any, Literal

import httpx
from fastapi import Request
from pydantic import BaseModel, ConfigDict, Discriminator, Field, Tag, TypeAdapter

from agent.app.errors import AppError, UpstreamUnavailableError
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.models import Link, UtcDatetime
from agent.app.settings import PayPalEnv, Settings

logger = logging.getLogger(__name__)

# Private sentinel ensuring VerifiedWebhook cannot be constructed outside this module
_VERIFIER_SENTINEL = object()

PAYPAL_SIGNATURE_HEADERS = (
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
)


class MissingSignatureHeadersError(AppError):
    """Raised when one or more required PayPal signature headers are missing."""

    def __init__(self, message: str = "Missing required PayPal signature headers"):
        super().__init__(
            code="MISSING_SIGNATURE_HEADERS",
            message=message,
            status_code=400,
        )


class InvalidSignatureError(AppError):
    """Raised when PayPal signature verification fails."""

    def __init__(self, message: str = "Invalid PayPal webhook signature"):
        super().__init__(
            code="INVALID_SIGNATURE",
            message=message,
            status_code=400,
        )


class WebhookIdMismatchError(AppError):
    """Raised when incoming webhook ID does not match expected merchant webhook ID."""

    def __init__(self, message: str = "PayPal webhook ID mismatch"):
        super().__init__(
            code="WEBHOOK_ID_MISMATCH",
            message=message,
            status_code=400,
        )


class PayloadTooLargeError(AppError):
    """Raised when incoming webhook body exceeds size cap."""

    def __init__(self, message: str = "Webhook payload exceeds maximum allowed size"):
        super().__init__(
            code="PAYLOAD_TOO_LARGE",
            message=message,
            status_code=413,
        )


class InvalidPayloadError(AppError):
    """Raised when webhook body is not valid JSON or violates schema."""

    def __init__(self, message: str = "Malformed or unparseable webhook JSON payload"):
        super().__init__(
            code="INVALID_PAYLOAD",
            message=message,
            status_code=400,
        )


# --- Typed Event Envelopes ---


class _BaseDisputeEventEnvelope(BaseModel):
    """Shared base for dispute webhook envelopes — contains common fields and property extraction logic.

    Subclasses must override ``event_type`` with a ``Literal`` annotation.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    create_time: UtcDatetime
    resource_type: str = "dispute"
    summary: str | None = None
    resource: dict[str, Any] = Field(default_factory=dict)
    links: list[Link] = Field(default_factory=list)

    @property
    def dispute_id(self) -> str | None:
        return self.resource.get("dispute_id")

    @property
    def merchant_id(self) -> str | None:
        """Walk disputed_transactions[0].seller.merchant_id."""
        txns = self.resource.get("disputed_transactions")
        if isinstance(txns, list) and txns:
            seller = txns[0].get("seller")
            if isinstance(seller, dict):
                return seller.get("merchant_id")
        return None


class DisputeCreatedEventEnvelope(_BaseDisputeEventEnvelope):
    """Envelope for CUSTOMER.DISPUTE.CREATED webhook notifications."""

    event_type: Literal["CUSTOMER.DISPUTE.CREATED"] = "CUSTOMER.DISPUTE.CREATED"


class DisputeUpdatedEventEnvelope(_BaseDisputeEventEnvelope):
    """Envelope for CUSTOMER.DISPUTE.UPDATED webhook notifications."""

    event_type: Literal["CUSTOMER.DISPUTE.UPDATED"] = "CUSTOMER.DISPUTE.UPDATED"


class DisputeResolvedEventEnvelope(_BaseDisputeEventEnvelope):
    """Envelope for CUSTOMER.DISPUTE.RESOLVED webhook notifications."""

    event_type: Literal["CUSTOMER.DISPUTE.RESOLVED"] = "CUSTOMER.DISPUTE.RESOLVED"


class GenericWebhookEventEnvelope(BaseModel):
    """Fallback envelope for all other or unhandled PayPal webhook event types."""

    model_config = ConfigDict(extra="ignore")

    id: str
    create_time: UtcDatetime
    resource_type: str = "unknown"
    event_type: str
    summary: str | None = None
    resource: dict[str, Any] | None = None
    links: list[Link] = Field(default_factory=list)

    @property
    def dispute_id(self) -> str | None:
        if isinstance(self.resource, dict):
            return self.resource.get("dispute_id")
        return None

    @property
    def merchant_id(self) -> str | None:
        if isinstance(self.resource, dict):
            txns = self.resource.get("disputed_transactions")
            if isinstance(txns, list) and txns:
                seller = txns[0].get("seller")
                if isinstance(seller, dict):
                    return seller.get("merchant_id")
        return None


def _discriminate_event_type(v: Any) -> str:
    """Determine discriminator tag based on event_type field."""
    et = v.get("event_type") if isinstance(v, dict) else getattr(v, "event_type", None)
    if et in {
        "CUSTOMER.DISPUTE.CREATED",
        "CUSTOMER.DISPUTE.UPDATED",
        "CUSTOMER.DISPUTE.RESOLVED",
    }:
        return str(et)
    return "GENERIC"


WebhookEventEnvelopeUnion = Annotated[
    Annotated[DisputeCreatedEventEnvelope, Tag("CUSTOMER.DISPUTE.CREATED")]
    | Annotated[DisputeUpdatedEventEnvelope, Tag("CUSTOMER.DISPUTE.UPDATED")]
    | Annotated[DisputeResolvedEventEnvelope, Tag("CUSTOMER.DISPUTE.RESOLVED")]
    | Annotated[GenericWebhookEventEnvelope, Tag("GENERIC")],
    Discriminator(_discriminate_event_type),
]

_envelope_adapter = TypeAdapter(WebhookEventEnvelopeUnion)


# --- VerifiedWebhook Type ---


class VerifiedWebhook:
    """Cryptographically or stub-verified PayPal webhook payload.

    Can only be constructed by a WebhookVerifier implementation.
    """

    def __init__(
        self,
        envelope: WebhookEventEnvelopeUnion,
        raw_payload: dict[str, Any],
        raw_body: bytes,
        transmission_id: str,
        _sentinel: object = None,
    ) -> None:
        if _sentinel is not _VERIFIER_SENTINEL:
            raise PermissionError("VerifiedWebhook can only be produced by WebhookVerifier.verify()")
        self._envelope = envelope
        self._raw_payload = raw_payload
        self._raw_body = raw_body
        self._transmission_id = transmission_id

    @property
    def envelope(self) -> WebhookEventEnvelopeUnion:
        return self._envelope

    @property
    def raw_payload(self) -> dict[str, Any]:
        return self._raw_payload

    @property
    def raw_body(self) -> bytes:
        return self._raw_body

    @property
    def transmission_id(self) -> str:
        return self._transmission_id

    @property
    def event_id(self) -> str:
        return self._envelope.id

    @property
    def event_type(self) -> str:
        return self._envelope.event_type

    @property
    def resource_type(self) -> str:
        return self._envelope.resource_type

    @property
    def dispute_id(self) -> str | None:
        return self._envelope.dispute_id

    @property
    def merchant_id(self) -> str | None:
        return self._envelope.merchant_id


# --- Verifier Implementations ---


def extract_signature_headers(headers: Mapping[str, str]) -> dict[str, str]:
    """Extract and validate all required PayPal webhook signature headers (case-insensitive)."""
    normalized: dict[str, str] = {}
    missing: list[str] = []

    # Map lower-cased header names
    lower_map = {k.lower(): v for k, v in headers.items()}

    for h in PAYPAL_SIGNATURE_HEADERS:
        val = lower_map.get(h)
        if not val or not val.strip():
            missing.append(h)
        else:
            normalized[h] = val.strip()

    if missing:
        raise MissingSignatureHeadersError(f"Missing required PayPal signature headers: {', '.join(missing)}")

    return normalized


class WebhookVerifier(ABC):
    """Abstract interface for webhook signature verification."""

    @abstractmethod
    async def verify(
        self,
        headers: Mapping[str, str],
        raw_body: bytes,
    ) -> VerifiedWebhook:
        """Verify request signature and return a VerifiedWebhook instance."""
        ...


class PayPalWebhookVerifier(WebhookVerifier):
    """Verifies PayPal webhook signatures using PayPal's verify-webhook-signature API."""

    def __init__(
        self,
        settings: Settings | None = None,
        auth: PayPalAuth | None = None,
        http_client: httpx.AsyncClient | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
    ) -> None:
        self.settings = settings or Settings()
        self.auth = auth or PayPalAuth(
            client_id=self.settings.paypal_client_id,
            client_secret=self.settings.paypal_client_secret,
            base_url=self.settings.paypal_base_url,
        )
        self._custom_client = http_client
        self._client: httpx.AsyncClient | None = None
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout

    async def _get_client(self) -> httpx.AsyncClient:
        if self._custom_client is not None:
            return self._custom_client
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.read_timeout, connect=self.connect_timeout),
            )
        return self._client

    async def close(self) -> None:
        """Close managed HTTP client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def verify(
        self,
        headers: Mapping[str, str],
        raw_body: bytes,
    ) -> VerifiedWebhook:
        sig_headers = extract_signature_headers(headers)
        lower_headers = {k.lower(): v for k, v in headers.items()}

        # Verify webhook_id if supplied in headers or configured
        header_webhook_id = lower_headers.get("paypal-webhook-id") or lower_headers.get("x-paypal-webhook-id")
        if (
            header_webhook_id
            and self.settings.paypal_webhook_id
            and header_webhook_id.strip() != self.settings.paypal_webhook_id.strip()
        ):
            raise WebhookIdMismatchError(
                f"Incoming webhook ID '{header_webhook_id}' does not match "
                f"configured '{self.settings.paypal_webhook_id}'"
            )

        # Parse raw json body
        try:
            raw_payload = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise InvalidPayloadError(f"Malformed JSON body: {exc}") from exc

        if not isinstance(raw_payload, dict):
            raise InvalidPayloadError("Webhook body must be a JSON object")

        # Build verification request for PayPal API
        webhook_id = self.settings.paypal_webhook_id
        verify_body = {
            "auth_algo": sig_headers["paypal-auth-algo"],
            "cert_url": sig_headers["paypal-cert-url"],
            "transmission_id": sig_headers["paypal-transmission-id"],
            "transmission_sig": sig_headers["paypal-transmission-sig"],
            "transmission_time": sig_headers["paypal-transmission-time"],
            "webhook_id": webhook_id,
            "webhook_event": raw_payload,
        }

        token = await self.auth.get_access_token()
        client = await self._get_client()
        url = f"{self.settings.paypal_base_url.rstrip('/')}/v1/notifications/verify-webhook-signature"

        try:
            resp = await client.post(
                url,
                json=verify_body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.error("Network failure connecting to PayPal webhook verification service: %s", exc)
            raise UpstreamUnavailableError("PayPal webhook verification service unavailable") from exc
        except Exception as exc:
            logger.error("Unexpected error contacting PayPal webhook verification service: %s", exc)
            raise UpstreamUnavailableError("PayPal webhook verification service unavailable") from exc

        if resp.status_code >= 500:
            logger.error(
                "PayPal webhook verification service responded with status %d: %s",
                resp.status_code,
                resp.text,
            )
            raise UpstreamUnavailableError("PayPal webhook verification service returned 5xx")

        if resp.status_code != 200:
            logger.warning(
                "PayPal webhook verification rejected with status %d: %s",
                resp.status_code,
                resp.text,
            )
            raise InvalidSignatureError(f"PayPal rejected webhook signature verification (HTTP {resp.status_code})")

        try:
            result = resp.json()
        except Exception as exc:
            raise UpstreamUnavailableError("Invalid JSON from PayPal verification service") from exc

        verification_status = result.get("verification_status")
        if verification_status != "SUCCESS":
            logger.warning(
                "PayPal signature verification failed",
                extra={
                    "verification_status": verification_status,
                    "transmission_id": sig_headers["paypal-transmission-id"],
                },
            )
            raise InvalidSignatureError(f"PayPal webhook signature invalid (status: {verification_status})")

        # Parse typed envelope
        try:
            envelope = _envelope_adapter.validate_python(raw_payload)
        except Exception as exc:
            raise InvalidPayloadError(f"Failed to parse webhook event envelope: {exc}") from exc

        return VerifiedWebhook(
            envelope=envelope,
            raw_payload=raw_payload,
            raw_body=raw_body,
            transmission_id=sig_headers["paypal-transmission-id"],
            _sentinel=_VERIFIER_SENTINEL,
        )


class StubWebhookVerifier(WebhookVerifier):
    """Deterministic stub verifier for testing and offline development.

    Only selectable when PAYPAL_ENV is stub.
    """

    def __init__(
        self,
        webhook_id: str = "",
        paypal_env: PayPalEnv | str = PayPalEnv.stub,
        simulate_invalid_signature: bool = False,
        simulate_service_unavailable: bool = False,
    ) -> None:
        env_val = paypal_env.value if isinstance(paypal_env, PayPalEnv) else paypal_env
        if env_val != PayPalEnv.stub.value:
            raise ValueError("Stub webhook verifier is selectable only when PAYPAL_ENV is stub")
        self.webhook_id = webhook_id
        self.simulate_invalid_signature = simulate_invalid_signature
        self.simulate_service_unavailable = simulate_service_unavailable

    async def verify(
        self,
        headers: Mapping[str, str],
        raw_body: bytes,
    ) -> VerifiedWebhook:
        sig_headers = extract_signature_headers(headers)
        lower_headers = {k.lower(): v for k, v in headers.items()}

        if self.simulate_service_unavailable:
            raise UpstreamUnavailableError("PayPal webhook verification service unavailable (simulated)")

        if self.simulate_invalid_signature or sig_headers["paypal-transmission-sig"] == "INVALID":
            logger.warning(
                "Stub verifier rejected invalid signature",
                extra={"transmission_id": sig_headers["paypal-transmission-id"]},
            )
            raise InvalidSignatureError("PayPal webhook signature invalid (stub)")

        header_webhook_id = lower_headers.get("paypal-webhook-id") or lower_headers.get("x-paypal-webhook-id")
        if header_webhook_id and self.webhook_id and header_webhook_id.strip() != self.webhook_id.strip():
            raise WebhookIdMismatchError(
                f"Incoming webhook ID '{header_webhook_id}' does not match expected '{self.webhook_id}'"
            )

        try:
            raw_payload = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise InvalidPayloadError(f"Malformed JSON body: {exc}") from exc

        if not isinstance(raw_payload, dict):
            raise InvalidPayloadError("Webhook body must be a JSON object")

        try:
            envelope = _envelope_adapter.validate_python(raw_payload)
        except Exception as exc:
            raise InvalidPayloadError(f"Failed to parse webhook event envelope: {exc}") from exc

        return VerifiedWebhook(
            envelope=envelope,
            raw_payload=raw_payload,
            raw_body=raw_body,
            transmission_id=sig_headers["paypal-transmission-id"],
            _sentinel=_VERIFIER_SENTINEL,
        )


def get_webhook_verifier(request: Request) -> WebhookVerifier:
    """Dependency provider selecting real or stub verifier based on PAYPAL_ENV."""
    s = getattr(request.app.state, "settings", None) or Settings()
    if s.paypal_env == PayPalEnv.stub:
        return StubWebhookVerifier(webhook_id=s.paypal_webhook_id, paypal_env=s.paypal_env)
    return PayPalWebhookVerifier(settings=s)
