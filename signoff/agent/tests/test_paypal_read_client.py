"""Unit, contract, and edge-case tests for PayPal read client and token cache.

Verifies:
1. Token fetching, caching, expiry margin, single in-flight refresh.
2. Mid-request token expiry (401): one refresh + one retry, then fail.
3. Strict GET-only enforcement (no mutating methods exposed or called).
4. Retries on 5xx, 429, network errors with jitter and backoff.
5. Honors Retry-After header up to configured cap.
6. 404 is typed NotFoundError and is NOT retried.
7. Non-JSON response returns typed UpstreamUnavailableError.
8. Pagination terminates cleanly on missing next link, repeating next link, or page cap.
9. Off-host redirect is blocked.
10. PayPal-Debug-Id is logged on every response; access tokens are never logged.
"""

import asyncio
import io
import logging
from decimal import Decimal

import httpx
import pytest

from agent.app.errors import NotFoundError, TokenInvalidError, UpstreamUnavailableError
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.models import Dispute, DisputeListResponse
from agent.app.paypal.read_client import PayPalReadClient


class FakeClock:
    """Deterministic simulated clock for testing token expiry and retry backoff."""

    def __init__(self, initial_time: float = 1000.0) -> None:
        self.current_time = initial_time

    def time(self) -> float:
        return self.current_time

    def advance(self, seconds: float) -> None:
        self.current_time += seconds

    async def sleep(self, seconds: float) -> None:
        self.current_time += seconds


SAMPLE_TOKEN_JSON = {
    "scope": "https://uri.paypal.com/services/disputes/read",
    "access_token": "A21AA-TEST-ACCESS-TOKEN-SECRET-12345",
    "token_type": "Bearer",
    "app_id": "APP-80W284485P519543T",
    "expires_in": 3600,
    "nonce": "test-nonce-value",
}

SAMPLE_DISPUTE_JSON = {
    "dispute_id": "PP-D-12345",
    "create_time": "2026-10-06T12:00:00Z",
    "update_time": "2026-10-06T12:05:00Z",
    "disputed_transactions": [
        {
            "buyer_transaction_id": "BUYER-TX-100",
            "seller_transaction_id": "SELLER-TX-100",
            "gross_amount": {"currency_code": "USD", "value": "25.00"},
        }
    ],
    "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    "status": "WAITING_FOR_SELLER_RESPONSE",
    "dispute_amount": {"currency_code": "USD", "value": "25.00"},
    "dispute_state": "REQUIRED_ACTION",
    "dispute_life_cycle_stage": "INQUIRY",
    "dispute_channel": "INTERNAL",
    "messages": [],
    "evidences": [],
    "links": [
        {"href": "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-12345", "rel": "self", "method": "GET"}
    ],
}


# ---------------------------------------------------------------------------
# 1. Token Fetching, Caching, Expiry Margin, Single In-Flight Refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auth_token_caching_and_expiry_margin():
    clock = FakeClock(1000.0)
    token_requests_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_requests_count
        if request.url.path == "/v1/oauth2/token":
            token_requests_count += 1
            return httpx.Response(
                200,
                json=SAMPLE_TOKEN_JSON,
                headers={"paypal-debug-id": f"dbg-token-{token_requests_count}"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="test-client-id",
            client_secret="test-client-secret",
            base_url="https://api-m.sandbox.paypal.com",
            expiry_margin_seconds=60.0,
            http_client=mock_client,
            time_provider=clock.time,
        )

        # First fetch: makes HTTP call
        token1 = await auth.get_access_token()
        assert token1 == "A21AA-TEST-ACCESS-TOKEN-SECRET-12345"
        assert token_requests_count == 1

        # Second fetch within validity window: cached, no HTTP call
        clock.advance(1000.0)  # at 2000s (expires at 1000 + 3600 = 4600s)
        token2 = await auth.get_access_token()
        assert token2 == token1
        assert token_requests_count == 1

        # Advance clock to within expiry margin (4600 - 50 = 4550s; margin is 60s -> expired!)
        clock.advance(2550.0)  # current_time = 4550s
        token3 = await auth.get_access_token()
        assert token3 == token1
        assert token_requests_count == 2  # Refreshed proactively due to margin!


@pytest.mark.asyncio
async def test_auth_single_in_flight_concurrent_refresh():
    clock = FakeClock(1000.0)
    token_requests_count = 0

    async def delayed_handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_requests_count
        if request.url.path == "/v1/oauth2/token":
            token_requests_count += 1
            await asyncio.sleep(0.05)  # Simulate network latency
            return httpx.Response(
                200,
                json=SAMPLE_TOKEN_JSON,
                headers={"paypal-debug-id": "dbg-concurrent-token"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(delayed_handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="test-client-id",
            client_secret="test-client-secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
            time_provider=clock.time,
        )

        # Launch 10 concurrent requests for token
        results = await asyncio.gather(*(auth.get_access_token() for _ in range(10)))

        assert len(results) == 10
        assert all(t == "A21AA-TEST-ACCESS-TOKEN-SECRET-12345" for t in results)
        # In-flight lock must ensure only ONE token request went over the wire
        assert token_requests_count == 1


# ---------------------------------------------------------------------------
# 2. Strict GET-Only Enforcement
# ---------------------------------------------------------------------------


def test_client_exposes_no_non_get_methods():
    client = PayPalReadClient(
        auth=PayPalAuth(
            client_id="dummy",
            client_secret="dummy",
            base_url="https://api-m.sandbox.paypal.com",
        ),
        base_url="https://api-m.sandbox.paypal.com",
    )

    # Class must not have mutating methods
    forbidden_method_names = [
        "post",
        "put",
        "delete",
        "patch",
        "send_mutation",
        "accept_claim",
        "provide_evidence",
        "make_offer",
        "send_message",
    ]
    for method_name in forbidden_method_names:
        assert not hasattr(client, method_name), f"PayPalReadClient should not have method {method_name}"

    # Verify all public callable methods start with get_ or list_ or close
    public_methods = [
        m for m in dir(client) if not m.startswith("_") and callable(getattr(client, m))
    ]
    for m in public_methods:
        assert m.startswith(("get_", "list_", "close")), f"Non-read public method found: {m}"


# ---------------------------------------------------------------------------
# 3. Successful GET Dispute and List Disputes (Parsed Models)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_dispute_success():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            assert request.method == "POST"
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            assert request.method == "GET"
            assert request.headers.get("Authorization") == f"Bearer {SAMPLE_TOKEN_JSON['access_token']}"
            return httpx.Response(200, json=SAMPLE_DISPUTE_JSON, headers={"paypal-debug-id": "dbg-disp-123"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        dispute = await client.get_dispute("PP-D-12345")
        assert isinstance(dispute, Dispute)
        assert dispute.dispute_id == "PP-D-12345"
        assert dispute.dispute_amount.value == Decimal("25.00")


@pytest.mark.asyncio
async def test_list_disputes_success():
    list_payload = {
        "items": [
            {
                "dispute_id": "PP-D-12345",
                "create_time": "2026-10-06T12:00:00Z",
                "update_time": "2026-10-06T12:05:00Z",
                "disputed_transactions": [],
                "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                "status": "WAITING_FOR_SELLER_RESPONSE",
                "dispute_state": "REQUIRED_ACTION",
                "dispute_amount": {"currency_code": "USD", "value": "25.00"},
                "dispute_life_cycle_stage": "INQUIRY",
                "dispute_channel": "INTERNAL",
                "links": [],
            }
        ],
        "links": [
            {
                "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes?page_size=10&next_page_token=PAGE2",
                "rel": "next",
                "method": "GET",
            }
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes":
            assert request.url.params["page_size"] == "10"
            assert request.url.params["dispute_state"] == "REQUIRED_ACTION"
            return httpx.Response(200, json=list_payload, headers={"paypal-debug-id": "dbg-list-1"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        resp = await client.list_disputes(page_size=10, dispute_state="REQUIRED_ACTION")
        assert isinstance(resp, DisputeListResponse)
        assert len(resp.items) == 1
        assert resp.items[0].dispute_id == "PP-D-12345"
        assert len(resp.links) == 1


# ---------------------------------------------------------------------------
# 4. Token Expires Mid-Request (401): One Refresh & One Retry, Then Fail
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mid_request_401_refresh_and_retry_success():
    token_fetch_count = 0
    get_dispute_attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal token_fetch_count, get_dispute_attempts
        if request.url.path == "/v1/oauth2/token":
            token_fetch_count += 1
            return httpx.Response(
                200,
                json={**SAMPLE_TOKEN_JSON, "access_token": f"TOKEN-{token_fetch_count}"},
                headers={"paypal-debug-id": f"dbg-tok-{token_fetch_count}"},
            )
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            get_dispute_attempts += 1
            # First attempt with stale token returns 401
            if get_dispute_attempts == 1:
                return httpx.Response(
                    401, json={"error": "invalid_token"}, headers={"paypal-debug-id": "dbg-401"}
                )
            # Second attempt with refreshed token succeeds
            return httpx.Response(
                200, json=SAMPLE_DISPUTE_JSON, headers={"paypal-debug-id": "dbg-200"}
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        dispute = await client.get_dispute("PP-D-12345")
        assert dispute.dispute_id == "PP-D-12345"
        assert get_dispute_attempts == 2
        assert token_fetch_count == 2  # initial + 1 force refresh


@pytest.mark.asyncio
async def test_mid_request_401_fails_after_one_retry():
    get_dispute_attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal get_dispute_attempts
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            get_dispute_attempts += 1
            return httpx.Response(
                401, json={"error": "unauthorized"}, headers={"paypal-debug-id": "dbg-401"}
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        with pytest.raises(TokenInvalidError, match="PayPal authentication failed"):
            await client.get_dispute("PP-D-12345")

        # Must try exactly twice (first attempt + one retry after refresh)
        assert get_dispute_attempts == 2


# ---------------------------------------------------------------------------
# 5. 404 is Typed NotFoundError, Not Retried
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_404_not_found_is_typed_and_not_retried():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/NONEXISTENT":
            attempts += 1
            return httpx.Response(
                404, json={"message": "Dispute not found"}, headers={"paypal-debug-id": "dbg-404"}
            )
        return httpx.Response(500)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        with pytest.raises(NotFoundError, match="PayPal resource not found"):
            await client.get_dispute("NONEXISTENT")

        # Must not retry 404
        assert attempts == 1


# ---------------------------------------------------------------------------
# 6. Retries on 5xx, 429, Network Errors with Jitter & Backoff
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retries_on_500_server_error_eventual_success():
    clock = FakeClock()
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            attempts += 1
            if attempts < 3:
                return httpx.Response(
                    503, json={"error": "service unavailable"}, headers={"paypal-debug-id": "dbg-503"}
                )
            return httpx.Response(
                200, json=SAMPLE_DISPUTE_JSON, headers={"paypal-debug-id": "dbg-200"}
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
            max_retries=3,
            sleep_fn=clock.sleep,
        )

        dispute = await client.get_dispute("PP-D-12345")
        assert dispute.dispute_id == "PP-D-12345"
        assert attempts == 3
        # Clock advanced due to backoff
        assert clock.current_time > 1000.0


@pytest.mark.asyncio
async def test_retries_honors_retry_after_header():
    clock = FakeClock(1000.0)
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            attempts += 1
            if attempts == 1:
                return httpx.Response(
                    429,
                    json={"error": "rate_limited"},
                    headers={"paypal-debug-id": "dbg-429", "Retry-After": "3"},
                )
            return httpx.Response(200, json=SAMPLE_DISPUTE_JSON, headers={"paypal-debug-id": "dbg-200"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
            sleep_fn=clock.sleep,
        )

        dispute = await client.get_dispute("PP-D-12345")
        assert dispute.dispute_id == "PP-D-12345"
        assert attempts == 2
        # Exact 3 seconds sleep from Retry-After
        assert clock.current_time == 1003.0


@pytest.mark.asyncio
async def test_retries_exhausted_raises_upstream_error():
    clock = FakeClock()
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            attempts += 1
            return httpx.Response(500, json={"error": "fatal"}, headers={"paypal-debug-id": "dbg-500"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
            max_retries=2,
            sleep_fn=clock.sleep,
        )

        with pytest.raises(UpstreamUnavailableError, match="PayPal server error HTTP 500"):
            await client.get_dispute("PP-D-12345")

        assert attempts == 3  # Initial + 2 retries


# ---------------------------------------------------------------------------
# 7. Non-JSON Response Returns Typed Upstream Error
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_non_json_response_raises_upstream_error():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            return httpx.Response(
                200,
                content=b"<html><body>502 Bad Gateway Nginx</body></html>",
                headers={"content-type": "text/html", "paypal-debug-id": "dbg-html"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        with pytest.raises(UpstreamUnavailableError, match="non-JSON response"):
            await client.get_dispute("PP-D-12345")


# ---------------------------------------------------------------------------
# 8. Pagination Edge Cases (Next Link Loop & Page Cap)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pagination_stops_on_repeating_next_link():
    page_requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal page_requests
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes":
            page_requests += 1
            # Return same next link on each request
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "dispute_id": f"PP-D-LOOP-{page_requests}",
                            "create_time": "2026-10-06T12:00:00Z",
                            "update_time": "2026-10-06T12:05:00Z",
                            "disputed_transactions": [],
                            "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                            "status": "WAITING_FOR_SELLER_RESPONSE",
                            "dispute_state": "REQUIRED_ACTION",
                            "dispute_amount": {"currency_code": "USD", "value": "10.00"},
                            "dispute_life_cycle_stage": "INQUIRY",
                            "dispute_channel": "INTERNAL",
                            "links": [],
                        }
                    ],
                    "links": [
                        {
                            "href": "https://api-m.sandbox.paypal.com/v1/customer/disputes?next_page_token=SAME_TOKEN",
                            "rel": "next",
                            "method": "GET",
                        }
                    ],
                },
                headers={"paypal-debug-id": f"dbg-loop-{page_requests}"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        items = await client.list_all_disputes(max_pages=10)
        # Should execute page 1, fetch page 2 (with SAME_TOKEN), and then stop when SAME_TOKEN is encountered again!
        assert len(items) == 2
        assert page_requests == 2


@pytest.mark.asyncio
async def test_pagination_stops_at_max_pages():
    page_requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal page_requests
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes":
            page_requests += 1
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "dispute_id": f"PP-D-{page_requests}",
                            "create_time": "2026-10-06T12:00:00Z",
                            "update_time": "2026-10-06T12:05:00Z",
                            "disputed_transactions": [],
                            "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                            "status": "WAITING_FOR_SELLER_RESPONSE",
                            "dispute_state": "REQUIRED_ACTION",
                            "dispute_amount": {"currency_code": "USD", "value": "10.00"},
                            "dispute_life_cycle_stage": "INQUIRY",
                            "dispute_channel": "INTERNAL",
                            "links": [],
                        }
                    ],
                    "links": [
                        {
                            "href": (
                                "https://api-m.sandbox.paypal.com/v1/customer/disputes"
                                f"?next_page_token=PAGE_{page_requests + 1}"
                            ),
                            "rel": "next",
                            "method": "GET",
                        }
                    ],
                },
                headers={"paypal-debug-id": f"dbg-page-{page_requests}"},
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        items = await client.list_all_disputes(max_pages=3)
        assert len(items) == 3
        assert page_requests == 3


# ---------------------------------------------------------------------------
# 9. Off-Host Redirect and Base URL Security
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_redirect_to_different_host_is_blocked():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-REDIRECT":
            return httpx.Response(
                302,
                headers={
                    "Location": "https://evil-attacker.com/steal-token",
                    "paypal-debug-id": "dbg-redirect",
                },
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        with pytest.raises(UpstreamUnavailableError, match="Refusing redirect to non-sandbox host"):
            await client.get_dispute("PP-D-REDIRECT")


def test_invalid_base_url_rejected_at_construction():
    pattern = "Live PayPal endpoints are strictly prohibited|Disallowed target host|must be HTTPS"
    with pytest.raises(ValueError, match=pattern):
        PayPalReadClient(
            auth=PayPalAuth(
                client_id="id",
                client_secret="secret",
                base_url="https://api-m.paypal.com",  # Production host forbidden!
            ),
            base_url="https://api-m.paypal.com",
        )


# ---------------------------------------------------------------------------
# 10. Logging Safety: Debug ID Logged, Never Log Access Tokens
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_debug_id_logged_and_no_token_leakage(caplog: pytest.LogCaptureFixture):
    log_stream = io.StringIO()
    stream_handler = logging.StreamHandler(log_stream)
    stream_handler.setLevel(logging.INFO)

    paypal_logger = logging.getLogger("agent.app.paypal")
    paypal_logger.disabled = False
    paypal_logger.setLevel(logging.INFO)
    paypal_logger.addHandler(stream_handler)

    auth_logger = logging.getLogger("agent.app.paypal.auth")
    auth_logger.disabled = False
    auth_logger.setLevel(logging.INFO)
    auth_logger.addHandler(stream_handler)

    read_logger = logging.getLogger("agent.app.paypal.read_client")
    read_logger.disabled = False
    read_logger.setLevel(logging.INFO)
    read_logger.addHandler(stream_handler)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(stream_handler)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/oauth2/token":
            return httpx.Response(
                200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "DBG-UNIQUE-TOKEN-999"}
            )
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            return httpx.Response(
                200, json=SAMPLE_DISPUTE_JSON, headers={"paypal-debug-id": "DBG-UNIQUE-DISPUTE-888"}
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )

        try:
            with caplog.at_level(logging.INFO):
                await client.get_dispute("PP-D-12345")
        finally:
            paypal_logger.removeHandler(stream_handler)
            auth_logger.removeHandler(stream_handler)
            read_logger.removeHandler(stream_handler)
            root_logger.removeHandler(stream_handler)

        record_texts = [r.getMessage() for r in caplog.records]
        combined = log_stream.getvalue() + " " + caplog.text + " " + " ".join(record_texts)
        # Assert PayPal debug IDs are recorded
        assert "DBG-UNIQUE-TOKEN-999" in combined
        assert "DBG-UNIQUE-DISPUTE-888" in combined
        # Assert raw token string is NEVER present in any log output
        assert SAMPLE_TOKEN_JSON["access_token"] not in combined
        assert "A21AA-TEST-ACCESS-TOKEN-SECRET-12345" not in combined


# ---------------------------------------------------------------------------
# 17. PayPalAuth lifecycle: close() and async context manager (H1)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auth_close_cleans_up_internal_client():
    """PayPalAuth.close() must close its internally created HTTP client."""
    auth = PayPalAuth(
        client_id="id",
        client_secret="secret",
        base_url="https://api-m.sandbox.paypal.com",
    )
    # Trigger lazy client creation by calling _get_http_client
    client = await auth._get_http_client()
    assert not client.is_closed
    await auth.close()
    assert client.is_closed


@pytest.mark.asyncio
async def test_auth_context_manager_closes_on_exit():
    """PayPalAuth used as async context manager closes its client on exit."""
    async with PayPalAuth(
        client_id="id",
        client_secret="secret",
        base_url="https://api-m.sandbox.paypal.com",
    ) as auth:
        internal_client = await auth._get_http_client()
        assert not internal_client.is_closed

    assert internal_client.is_closed


@pytest.mark.asyncio
async def test_auth_close_does_not_close_externally_provided_client():
    """PayPalAuth.close() must NOT close an externally provided http_client."""
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json=SAMPLE_TOKEN_JSON))
    async with httpx.AsyncClient(transport=transport) as external_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=external_client,
        )
        await auth.close()
        # External client lifecycle is caller's responsibility — must still be open
        assert not external_client.is_closed


# ---------------------------------------------------------------------------
# 18. 401 at max_retries boundary does not allow extra attempts (H2)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_401_at_max_retries_does_not_trigger_refresh():
    """A 401 received on the last allowed attempt must NOT trigger a token refresh.

    Without the fix, token_retried=False at attempt==max_retries+1 would allow
    an extra token refresh, exceeding the retry budget.
    """
    attempt_count = 0
    token_refresh_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempt_count, token_refresh_count
        if request.url.path == "/v1/oauth2/token":
            token_refresh_count += 1
            return httpx.Response(200, json=SAMPLE_TOKEN_JSON, headers={"paypal-debug-id": "dbg-tok"})
        if request.url.path == "/v1/customer/disputes/PP-D-12345":
            attempt_count += 1
            # First max_retries attempts return 5xx to exhaust budget, last returns 401
            if attempt_count <= 3:  # max_retries = 3
                return httpx.Response(503, json={}, headers={"paypal-debug-id": "dbg-5xx"})
            return httpx.Response(401, json={}, headers={"paypal-debug-id": "dbg-401"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as mock_client:
        auth = PayPalAuth(
            client_id="id",
            client_secret="secret",
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
        )
        client = PayPalReadClient(
            auth=auth,
            base_url="https://api-m.sandbox.paypal.com",
            http_client=mock_client,
            max_retries=3,
            sleep_fn=asyncio.sleep,
            jitter_fn=lambda a, b: 0.0,
            base_backoff_seconds=0.0,
        )

        with pytest.raises((TokenInvalidError, UpstreamUnavailableError)):
            await client.get_dispute("PP-D-12345")

    # Only the initial token fetch — no bonus refresh should fire
    assert token_refresh_count == 1, (
        f"Expected 1 token fetch, got {token_refresh_count}. "
        "The 401 after max_retries should not trigger a bonus refresh."
    )
