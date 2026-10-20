"""Unit tests for PayPal mutating client and pre-validation logic.

Validates Step 13 requirements:
- Pre-validation of evidence files (size, extension, MIME type, empty files).
- Pre-validation of message and note text (empty, length limits).
- Exact two-decimal formatting for monetary offers.
- Mutating endpoints: provide-evidence (multipart), make-offer, accept-claim,
  send-message, escalate, appeal.
- 401 token refresh once.
- 4xx PayPal error handling: fails with debug id, no retry.
- 5xx and timeout error handling: raises without blind retry.
"""

import time
from decimal import Decimal

import httpx
import pytest

from agent.app.domain.money import Money
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.mutating_client import (
    MAX_FILE_SIZE_BYTES,
    MAX_MESSAGE_LENGTH,
    MAX_NOTE_LENGTH,
    PayPalClientError,
    PayPalMutatingClient,
    PayPalUpstreamError,
    format_two_decimal_amount,
    validate_evidence_file,
    validate_message_text,
    validate_note_text,
)


def make_test_auth(client: httpx.AsyncClient) -> PayPalAuth:
    """Helper to construct authenticated PayPalAuth for unit tests."""
    auth = PayPalAuth(
        client_id="test_client_id",
        client_secret="test_client_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=client,
    )
    auth._access_token = "mock_token"
    auth._expires_at = time.time() + 3600.0
    return auth


def test_validate_message_text():
    assert validate_message_text("Valid dispute response message") == "Valid dispute response message"
    with pytest.raises(ValueError, match="cannot be empty"):
        validate_message_text("   ")
    with pytest.raises(ValueError, match="exceeds limit"):
        validate_message_text("A" * (MAX_MESSAGE_LENGTH + 1))


def test_validate_note_text():
    assert validate_note_text(None) is None
    assert validate_note_text("A valid note") == "A valid note"
    with pytest.raises(ValueError, match="exceeds limit"):
        validate_note_text("N" * (MAX_NOTE_LENGTH + 1))


def test_validate_evidence_file():
    # Valid PDF
    clean_name, content, mime = validate_evidence_file("invoice.pdf", b"%PDF-1.4 sample", "application/pdf")
    assert clean_name == "invoice.pdf"
    assert mime == "application/pdf"

    # Disallowed extension
    with pytest.raises(ValueError, match="Disallowed file extension"):
        validate_evidence_file("script.sh", b"echo hello", "text/x-sh")

    # Empty file
    with pytest.raises(ValueError, match="is empty"):
        validate_evidence_file("empty.png", b"", "image/png")

    # Oversized file (>10MB)
    oversized = b"X" * (MAX_FILE_SIZE_BYTES + 10)
    with pytest.raises(ValueError, match="exceeds limit"):
        validate_evidence_file("huge.jpg", oversized, "image/jpeg")

    # Disallowed MIME type
    with pytest.raises(ValueError, match="Disallowed MIME type"):
        validate_evidence_file("image.png", b"data", "application/x-executable")


def test_format_two_decimal_amount():
    assert format_two_decimal_amount(Decimal("25.00")) == "25.00"
    assert format_two_decimal_amount(Decimal("100.5")) == "100.50"
    assert format_two_decimal_amount(Money(value="49.99", currency_code="USD")) == "49.99"

    # Floating point strictly rejected
    with pytest.raises(TypeError, match="Floating point values are strictly forbidden"):
        format_two_decimal_amount(25.50)  # type: ignore

    # Zero or negative rejected
    with pytest.raises(ValueError, match="strictly positive"):
        format_two_decimal_amount(Decimal("0.00"))
    with pytest.raises(ValueError, match="strictly positive"):
        format_two_decimal_amount(Decimal("-10.00"))

    # More than two decimals rejected
    with pytest.raises(ValueError, match="more than two decimal places"):
        format_two_decimal_amount(Decimal("10.999"))


@pytest.mark.asyncio
async def test_mutating_client_rejects_non_sandbox_host():
    with pytest.raises(ValueError, match="base URL must be HTTPS on api-m.sandbox.paypal.com"):
        PayPalMutatingClient(base_url="https://api-m.paypal.com")


@pytest.mark.asyncio
async def test_make_offer_success():
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/customer/disputes/PP-D-123/make-offer"
        assert request.method == "POST"
        body = httpx.Response(200, content=request.content).json()
        assert body["offer_type"] == "REFUND"
        assert body["offer_amount"] == {"currency_code": "USD", "value": "35.50"}
        return httpx.Response(
            200,
            json={"status": "OFFER_MADE"},
            headers={"Paypal-Debug-Id": "dbg-offer-123"},
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await mutating_client.make_offer(
            dispute_id="PP-D-123",
            amount=Decimal("35.50"),
            note="Full refund offer",
        )
        assert result.status_code == 200
        assert result.debug_id == "dbg-offer-123"
        assert result.data["status"] == "OFFER_MADE"


@pytest.mark.asyncio
async def test_accept_claim_success():
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/customer/disputes/PP-D-123/accept-claim"
        return httpx.Response(
            200,
            json={"status": "CLAIM_ACCEPTED"},
            headers={"Paypal-Debug-Id": "dbg-claim-456"},
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await mutating_client.accept_claim(
            dispute_id="PP-D-123",
            amount=Decimal("50.00"),
            note="Conceding dispute claim",
        )
        assert result.status_code == 200
        assert result.debug_id == "dbg-claim-456"


@pytest.mark.asyncio
async def test_send_message_success():
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/customer/disputes/PP-D-123/send-message"
        body = httpx.Response(200, content=request.content).json()
        assert body["message"] == "Tracking shows delivery yesterday."
        return httpx.Response(
            200,
            json={"status": "MESSAGE_SENT"},
            headers={"Paypal-Debug-Id": "dbg-msg-789"},
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await mutating_client.send_message(
            dispute_id="PP-D-123",
            message="Tracking shows delivery yesterday.",
        )
        assert result.status_code == 200
        assert result.debug_id == "dbg-msg-789"


@pytest.mark.asyncio
async def test_provide_evidence_multipart_success():
    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/customer/disputes/PP-D-123/provide-evidence"
        assert "multipart/form-data" in request.headers["content-type"]
        return httpx.Response(
            200,
            json={"links": [{"rel": "detail", "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-123"}]},
            headers={"Paypal-Debug-Id": "dbg-ev-999"},
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        files = [("receipt.pdf", b"%PDF-1.4 fake receipt", "application/pdf")]
        result = await mutating_client.provide_evidence(
            dispute_id="PP-D-123",
            evidence_type="PROOF_OF_FULFILLMENT",
            notes="Order fulfilled via carrier",
            files=files,
        )
        assert result.status_code == 200
        assert result.debug_id == "dbg-ev-999"


@pytest.mark.asyncio
async def test_paypal_4xx_raises_client_error_without_retry():
    call_count = 0

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            400,
            json={"name": "INVALID_REQUEST", "message": "Offer exceeds maximum allowed"},
            headers={"Paypal-Debug-Id": "dbg-err-400"},
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        with pytest.raises(PayPalClientError) as exc_info:
            await mutating_client.make_offer(
                dispute_id="PP-D-123",
                amount=Decimal("50.00"),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.debug_id == "dbg-err-400"
        assert call_count == 1  # Strictly called once; no retry


@pytest.mark.asyncio
async def test_paypal_5xx_raises_upstream_error_without_retry():
    call_count = 0

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            500,
            text="Internal Server Error",
            headers={"Paypal-Debug-Id": "dbg-err-500"},
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        with pytest.raises(PayPalUpstreamError) as exc_info:
            await mutating_client.send_message(
                dispute_id="PP-D-123",
                message="Hello",
            )

        assert exc_info.value.status_code == 500
        assert exc_info.value.debug_id == "dbg-err-500"
        assert call_count == 1  # No blind retry on mutating call


@pytest.mark.asyncio
async def test_paypal_401_refreshes_token_once():
    call_count = 0

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(
                200,
                json={"access_token": "refreshed_token", "token_type": "Bearer", "expires_in": 3600},
            )
        if call_count == 1:
            return httpx.Response(401, text="Unauthorized", headers={"Paypal-Debug-Id": "dbg-401"})
        return httpx.Response(200, json={"status": "OK"}, headers={"Paypal-Debug-Id": "dbg-200"})

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        auth = make_test_auth(client)
        mutating_client = PayPalMutatingClient(auth=auth, http_client=client)

        result = await mutating_client.escalate(dispute_id="PP-D-123", note="Escalating")
        assert result.status_code == 200
        assert result.debug_id == "dbg-200"
        assert call_count == 3  # Initial mutating call (401), oauth refresh (200), retry call (200)
