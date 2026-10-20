"""Mutating PayPal dispute client with strict pre-validation and write-ahead safety.

Per plan/05-resilience.md and Step 13:
- Only app/executor may import or call this client.
- Calls PayPal mutating endpoints: provide-evidence (multipart), make-offer,
  accept-claim, send-message, escalate, appeal.
- Pre-validates evidence files and message/note text before any network call.
- NEVER auto-retries mutating calls on 5xx/429/timeouts (fail closed / write-ahead).
- Single OAuth token refresh on 401.
- Records and logs PayPal-Debug-Id on every response.
"""

import json
import logging
import mimetypes
import os
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

import httpx

from agent.app.domain.actions import (
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProposedAction,
    ProvideEvidence,
    SendMessage,
)
from agent.app.domain.money import Money
from agent.app.errors import AppError, TokenInvalidError
from agent.app.paypal.auth import PayPalAuth, get_paypal_debug_id
from agent.app.settings import SANDBOX_PAYPAL_HOST, Settings

logger = logging.getLogger(__name__)

# Pre-validation limits per PayPal Disputes specification
MAX_MESSAGE_LENGTH = 2000
MAX_NOTE_LENGTH = 2000
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_FILE_EXTENSIONS = frozenset({".pdf", ".png", ".jpg", ".jpeg", ".gif"})
ALLOWED_CONTENT_TYPES = frozenset({
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/pjpeg",
    "image/gif",
})


class PayPalMutatingError(AppError):
    """Base error for mutating PayPal client operations."""

    def __init__(self, message: str, status_code: int, debug_id: str | None = None) -> None:
        super().__init__(code="PAYPAL_MUTATING_ERROR", message=message, status_code=status_code)
        self.debug_id = debug_id


class PayPalClientError(PayPalMutatingError):
    """PayPal returned 4xx client error (no retry)."""

    def __init__(self, message: str, status_code: int, debug_id: str | None = None) -> None:
        super().__init__(message=message, status_code=status_code, debug_id=debug_id)


class PayPalUpstreamError(PayPalMutatingError):
    """PayPal returned 5xx server error (ambiguous state, resolved via re-fetch)."""

    def __init__(self, message: str, status_code: int, debug_id: str | None = None) -> None:
        super().__init__(message=message, status_code=status_code, debug_id=debug_id)


class PayPalTimeoutError(PayPalMutatingError):
    """Network or timeout error during mutating call (ambiguous state, resolved via re-fetch)."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=504, debug_id=None)


@dataclass(frozen=True, slots=True)
class MutatingResult:
    """Outcome of a successful or executed mutating call."""

    status_code: int
    debug_id: str | None
    data: dict[str, Any]


def validate_message_text(text: str, field_name: str = "message", max_length: int = MAX_MESSAGE_LENGTH) -> str:
    """Pre-validate message or note text for length and content."""
    if not isinstance(text, str):
        raise ValueError(f"{field_name} must be a string, got {type(text).__name__}")
    cleaned = text.strip()
    if not cleaned:
        raise ValueError(f"{field_name} cannot be empty or blank")
    if len(cleaned) > max_length:
        raise ValueError(f"{field_name} length {len(cleaned)} exceeds limit of {max_length} characters")
    return cleaned


def validate_note_text(note: str | None, max_length: int = MAX_NOTE_LENGTH) -> str | None:
    """Pre-validate optional note text."""
    if note is None:
        return None
    if not isinstance(note, str):
        raise ValueError(f"Note must be a string, got {type(note).__name__}")
    cleaned = note.strip()
    if len(cleaned) > max_length:
        raise ValueError(f"Note length {len(cleaned)} exceeds limit of {max_length} characters")
    return cleaned


def validate_evidence_file(
    filename: str,
    content: bytes,
    content_type: str | None = None,
) -> tuple[str, bytes, str]:
    """Pre-validate evidence file size, extension, and MIME type."""
    if not filename or not filename.strip():
        raise ValueError("Evidence filename cannot be empty")
    clean_filename = filename.strip()
    _, ext = os.path.splitext(clean_filename.lower())
    if ext not in ALLOWED_FILE_EXTENSIONS:
        raise ValueError(
            f"Disallowed file extension '{ext}' for {clean_filename}. "
            f"Allowed extensions: {sorted(ALLOWED_FILE_EXTENSIONS)}"
        )

    file_size = len(content)
    if file_size <= 0:
        raise ValueError(f"Evidence file '{clean_filename}' is empty (0 bytes)")
    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"Evidence file '{clean_filename}' size ({file_size} bytes) exceeds limit "
            f"of {MAX_FILE_SIZE_BYTES} bytes (10MB)"
        )

    c_type = content_type or mimetypes.guess_type(clean_filename)[0] or "application/octet-stream"
    if c_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Disallowed MIME type '{c_type}' for {clean_filename}. Allowed types: {sorted(ALLOWED_CONTENT_TYPES)}"
        )
    return clean_filename, content, c_type


def format_two_decimal_amount(amount: Decimal | Money | float | int | str) -> str:
    """Format and validate exact two-decimal monetary amount."""
    if isinstance(amount, Money):
        dec = amount.value
    elif isinstance(amount, Decimal):
        dec = amount
    elif isinstance(amount, float):
        raise TypeError("Floating point values are strictly forbidden for money; use Decimal or Money.")
    else:
        dec = Decimal(amount)

    if not dec.is_finite():
        raise ValueError(f"Non-finite decimal value: {dec}")
    if dec <= Decimal("0.00"):
        raise ValueError(f"Amount must be strictly positive, got {dec}")
    exponent = dec.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise ValueError(f"Amount {dec} has more than two decimal places")
    return f"{dec:.2f}"


class PayPalMutatingClient:
    """Safe mutating dispute client.

    Importable and callable ONLY from agent/app/executor/.
    """

    def __init__(
        self,
        auth: PayPalAuth | None = None,
        base_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = 15.0,
    ) -> None:
        settings = Settings()
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self._custom_client = http_client
        self._client: httpx.AsyncClient | None = None
        self.auth = auth or PayPalAuth(
            base_url=base_url,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            http_client=http_client,
        )
        self.base_url = (base_url or settings.paypal_base_url).rstrip("/")

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
                ),
                follow_redirects=False,
            )
        return self._client

    async def _execute_post(
        self,
        endpoint_path: str,
        *,
        json_body: dict[str, Any] | None = None,
        files: list[tuple[str, Any]] | None = None,
        data: dict[str, Any] | None = None,
    ) -> MutatingResult:
        """Execute mutating POST call with single token refresh on 401 and no retry on failure."""
        target_url = f"{self.base_url}{endpoint_path}"
        client = await self._get_http_client()

        token_refreshed = False
        while True:
            auth_headers = await self.auth.get_auth_header()
            headers = {
                "Accept": "application/json",
                **auth_headers,
            }

            try:
                logger.info("Executing PayPal mutating POST to %s", target_url)
                if files is not None:
                    # Multipart upload: Content-Type header generated by httpx
                    resp = await client.post(
                        target_url,
                        headers=headers,
                        data=data,
                        files=files,
                    )
                else:
                    headers["Content-Type"] = "application/json"
                    resp = await client.post(
                        target_url,
                        headers=headers,
                        json=json_body,
                    )

                debug_id = get_paypal_debug_id(resp)
                logger.info(
                    "PayPal mutating POST %s finished (status=%d, debug_id=%s)",
                    target_url,
                    resp.status_code,
                    debug_id,
                )

                if resp.status_code == 401:
                    if not token_refreshed:
                        token_refreshed = True
                        logger.warning("PayPal 401 on mutating call. Refreshing token once (debug_id=%s)", debug_id)
                        await self.auth.get_access_token(force_refresh=True)
                        continue
                    raise TokenInvalidError("PayPal authentication failed on mutating call after token refresh")

                if 200 <= resp.status_code < 300:
                    payload: dict[str, Any] = {}
                    if resp.content:
                        try:
                            payload = resp.json()
                        except Exception:
                            payload = {"raw": resp.text}
                    return MutatingResult(
                        status_code=resp.status_code,
                        debug_id=debug_id,
                        data=payload,
                    )

                if 400 <= resp.status_code < 500:
                    error_msg = f"PayPal mutating call rejected with HTTP {resp.status_code}: {resp.text}"
                    logger.error("%s (debug_id=%s)", error_msg, debug_id)
                    raise PayPalClientError(
                        message=error_msg,
                        status_code=resp.status_code,
                        debug_id=debug_id,
                    )

                # 5xx server error
                error_msg = f"PayPal server error HTTP {resp.status_code}: {resp.text}"
                logger.error("%s (debug_id=%s)", error_msg, debug_id)
                raise PayPalUpstreamError(
                    message=error_msg,
                    status_code=resp.status_code,
                    debug_id=debug_id,
                )

            except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                logger.error("Network or timeout error calling PayPal mutating endpoint %s: %s", target_url, net_err)
                raise PayPalTimeoutError(f"Network or timeout during mutating call: {net_err}") from net_err

    async def provide_evidence(
        self,
        dispute_id: str,
        *,
        evidence_type: str | None = None,
        notes: str | None = None,
        files: Sequence[tuple[str, bytes, str | None]] | None = None,
        tracking_info: list[dict[str, Any]] | None = None,
    ) -> MutatingResult:
        """Submit evidence to PayPal via multipart/form-data."""
        clean_dispute_id = dispute_id.strip()
        validated_notes = validate_note_text(notes)

        multipart_files: list[tuple[str, Any]] = []
        if files:
            for item in files:
                fname, b_data, mime = item
                val_fname, val_content, val_mime = validate_evidence_file(fname, b_data, mime)
                multipart_files.append(("file", (val_fname, val_content, val_mime)))

        evidence_input: dict[str, Any] = {}
        if evidence_type:
            evidence_input["evidence_type"] = evidence_type
        if validated_notes:
            evidence_input["notes"] = validated_notes
        if tracking_info:
            evidence_input["evidence_info"] = {"tracking_info": tracking_info}

        data_fields = {"input": json.dumps(evidence_input)}
        endpoint = f"/v1/customer/disputes/{clean_dispute_id}/provide-evidence"

        files_payload = (
            multipart_files
            if multipart_files
            else [("input", (None, json.dumps(evidence_input), "application/json"))]
        )
        return await self._execute_post(
            endpoint,
            data=data_fields,
            files=files_payload,
        )

    async def make_offer(
        self,
        dispute_id: str,
        *,
        amount: Decimal | Money,
        offer_type: str = "REFUND",
        currency: str = "USD",
        note: str | None = None,
    ) -> MutatingResult:
        """Make an offer to resolve dispute (exact two decimals)."""
        clean_dispute_id = dispute_id.strip()
        formatted_amount = format_two_decimal_amount(amount)
        validated_note = validate_note_text(note)

        json_body = {
            "offer_type": offer_type,
            "offer_amount": {
                "currency_code": currency.upper().strip(),
                "value": formatted_amount,
            },
        }
        if validated_note:
            json_body["note"] = validated_note

        endpoint = f"/v1/customer/disputes/{clean_dispute_id}/make-offer"
        return await self._execute_post(endpoint, json_body=json_body)

    async def accept_claim(
        self,
        dispute_id: str,
        *,
        accept_claim_type: str = "REFUND",
        amount: Decimal | Money | None = None,
        currency: str = "USD",
        note: str | None = None,
    ) -> MutatingResult:
        """Accept customer claim and concede dispute."""
        clean_dispute_id = dispute_id.strip()
        validated_note = validate_note_text(note)

        json_body: dict[str, Any] = {
            "accept_claim_type": accept_claim_type,
        }
        if validated_note:
            json_body["note"] = validated_note
        if amount is not None:
            json_body["refund_amount"] = {
                "currency_code": currency.upper().strip(),
                "value": format_two_decimal_amount(amount),
            }

        endpoint = f"/v1/customer/disputes/{clean_dispute_id}/accept-claim"
        return await self._execute_post(endpoint, json_body=json_body)

    async def send_message(
        self,
        dispute_id: str,
        *,
        message: str,
    ) -> MutatingResult:
        """Send message to buyer via PayPal dispute thread."""
        clean_dispute_id = dispute_id.strip()
        valid_msg = validate_message_text(message)

        json_body = {"message": valid_msg}
        endpoint = f"/v1/customer/disputes/{clean_dispute_id}/send-message"
        return await self._execute_post(endpoint, json_body=json_body)

    async def escalate(
        self,
        dispute_id: str,
        *,
        note: str | None = None,
    ) -> MutatingResult:
        """Escalate dispute to PayPal claim."""
        clean_dispute_id = dispute_id.strip()
        validated_note = validate_note_text(note)

        json_body: dict[str, Any] = {}
        if validated_note:
            json_body["note"] = validated_note

        endpoint = f"/v1/customer/disputes/{clean_dispute_id}/escalate"
        return await self._execute_post(endpoint, json_body=json_body)

    async def appeal(
        self,
        dispute_id: str,
        *,
        note: str | None = None,
        evidence_type: str | None = None,
        files: Sequence[tuple[str, bytes, str | None]] | None = None,
    ) -> MutatingResult:
        """Appeal a resolved dispute decision."""
        clean_dispute_id = dispute_id.strip()
        validated_note = validate_note_text(note)

        multipart_files: list[tuple[str, Any]] = []
        if files:
            for item in files:
                fname, b_data, mime = item
                val_fname, val_content, val_mime = validate_evidence_file(fname, b_data, mime)
                multipart_files.append(("file", (val_fname, val_content, val_mime)))

        endpoint = f"/v1/customer/disputes/{clean_dispute_id}/appeal"

        if multipart_files:
            appeal_input: dict[str, Any] = {}
            if validated_note:
                appeal_input["notes"] = validated_note
            if evidence_type:
                appeal_input["evidence_type"] = evidence_type
            data_fields = {"input": json.dumps(appeal_input)}
            return await self._execute_post(endpoint, data=data_fields, files=multipart_files)

        json_body: dict[str, Any] = {}
        if validated_note:
            json_body["notes"] = validated_note
        if evidence_type:
            json_body["evidence_type"] = evidence_type
        return await self._execute_post(endpoint, json_body=json_body)

    async def execute_action(
        self,
        dispute_id: str,
        action: ProposedAction,
        evidence_files: Sequence[tuple[str, bytes, str | None]] | None = None,
    ) -> MutatingResult:
        """Dispatch proposed action to corresponding mutating method."""
        if isinstance(action, ProvideEvidence):
            return await self.provide_evidence(
                dispute_id=dispute_id,
                evidence_type=action.evidence_type,
                notes=action.notes,
                files=evidence_files,
                tracking_info=[dict(item) for item in action.tracking_info] or None,
            )
        if isinstance(action, MakeOffer):
            return await self.make_offer(
                dispute_id=dispute_id,
                amount=action.amount,
                offer_type=action.offer_type,
                currency=action.amount.currency_code,
                note=action.note,
            )
        if isinstance(action, AcceptClaim):
            return await self.accept_claim(
                dispute_id=dispute_id,
                accept_claim_type=action.accept_claim_type,
                amount=action.amount,
                currency=action.amount.currency_code if action.amount else "USD",
                note=action.note,
            )
        if isinstance(action, SendMessage):
            return await self.send_message(
                dispute_id=dispute_id,
                message=action.message,
            )
        if isinstance(action, Escalate):
            return await self.escalate(
                dispute_id=dispute_id,
                note=action.note,
            )
        if isinstance(action, Appeal):
            return await self.appeal(
                dispute_id=dispute_id,
                note=action.note,
                files=evidence_files,
            )
        raise ValueError(f"Unsupported action type: {type(action).__name__}")
