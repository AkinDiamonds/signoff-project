"""Safe, GET-only PayPal read client with token caching, retries, and contract parsing."""

import asyncio
import email.utils
import logging
import random
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

from agent.app.errors import AppError, NotFoundError, TokenInvalidError, UpstreamUnavailableError
from agent.app.paypal.auth import PayPalAuth, get_paypal_debug_id
from agent.app.paypal.models import (
    Dispute,
    DisputeListResponse,
    DisputeSummary,
    parse_dispute,
    parse_dispute_list,
)
from agent.app.settings import SANDBOX_PAYPAL_HOST, Settings, is_allowed_paypal_url

logger = logging.getLogger(__name__)


def _parse_retry_after(header_value: str | None) -> float | None:
    """Parse HTTP Retry-After header as integer/float seconds or HTTP date."""
    if not header_value:
        return None
    header_clean = header_value.strip()
    try:
        return float(header_clean)
    except ValueError:
        pass
    try:
        parsed_date = email.utils.parsedate_to_datetime(header_clean)
        delta = (parsed_date.timestamp() - time.time())
        return max(0.0, delta)
    except Exception:
        logger.debug("Could not parse Retry-After header value: %r", header_value)
        return None


class PayPalReadClient:
    """Read-only (GET only) client for PayPal disputes and summaries.

    Security & Reliability:
    - Exposes strictly GET methods (no mutating endpoints).
    - Validates target host to strictly prevent SSRF / off-host redirects.
    - Automatic token refresh and single retry on 401.
    - Bounded exponential backoff with jitter on 5xx, 429, and network timeouts.
    - Honors Retry-After headers up to a configured cap.
    - Typed error handling (404 -> NotFoundError, non-JSON -> UpstreamUnavailableError).
    - Logs PayPal-Debug-Id on every response without logging credentials/tokens.
    """

    def __init__(
        self,
        auth: PayPalAuth | None = None,
        base_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
        max_retries: int = 3,
        base_backoff_seconds: float = 0.5,
        max_retry_after_seconds: float = 10.0,
        sleep_fn: Callable[[float], Awaitable[None]] | None = None,
        jitter_fn: Callable[[float, float], float] | None = None,
    ) -> None:
        settings = Settings()
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.max_retries = max_retries
        self.base_backoff_seconds = base_backoff_seconds
        self.max_retry_after_seconds = max_retry_after_seconds
        self._sleep_fn = sleep_fn or asyncio.sleep
        self._jitter_fn = jitter_fn or random.uniform
        self._custom_client = http_client
        self._client: httpx.AsyncClient | None = None
        self._owns_auth = auth is None
        self.auth = auth or PayPalAuth(
            base_url=base_url,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            http_client=http_client,
        )
        self.base_url = (base_url or str(settings.paypal_base_url)).rstrip("/")
        self.paypal_env = settings.paypal_env

        if not is_allowed_paypal_url(self.base_url, self.paypal_env):
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

    def _validate_safe_url(self, url: str) -> str:
        """Ensure the URL targets the allowed PayPal sandbox host over HTTPS."""
        if url.startswith("/"):
            return f"{self.base_url}{url}"
        parsed = urlparse(url)
        if not is_allowed_paypal_url(url, self.paypal_env):
            raise ValueError(
                f"Disallowed target host: '{parsed.hostname or 'unknown'}'. "
                f"Must be HTTPS on {SANDBOX_PAYPAL_HOST}"
            )
        return url

    async def _execute_get(self, url: str, params: dict[str, Any] | None = None) -> httpx.Response:
        """Execute a GET request with retries, 401 refresh, and bounded backoff."""
        target_url = self._validate_safe_url(url)
        client = await self._get_http_client()

        token_retried = False
        attempt = 0

        while True:
            attempt += 1
            auth_headers = await self.auth.get_auth_header()
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                **auth_headers,
            }

            try:
                logger.debug("Executing PayPal GET %s (attempt %d)", target_url, attempt)
                resp = await client.get(target_url, params=params, headers=headers)
                debug_id = get_paypal_debug_id(resp)
                logger.info(
                    "PayPal GET %s completed (status=%d, debug_id=%s)",
                    target_url,
                    resp.status_code,
                    debug_id,
                )

                # Check for 3xx redirect
                if 300 <= resp.status_code < 400:
                    redirect_location = resp.headers.get("Location")
                    if redirect_location:
                        parsed_loc = urlparse(redirect_location)
                        if parsed_loc.hostname and parsed_loc.hostname != SANDBOX_PAYPAL_HOST:
                            logger.error(
                                "Blocked off-host redirect to %s (debug_id=%s)",
                                redirect_location,
                                debug_id,
                            )
                            raise UpstreamUnavailableError(
                                f"Refusing redirect to non-sandbox host: {parsed_loc.hostname}"
                            )
                    # We do not follow redirects automatically for read client
                    raise UpstreamUnavailableError(
                        f"Unexpected redirect HTTP {resp.status_code} from PayPal"
                    )

                # Handle 401 Unauthorized: refresh token once and retry if under max_retries
                if resp.status_code == 401:
                    if not token_retried and attempt <= self.max_retries:
                        token_retried = True
                        logger.warning(
                            "PayPal returned 401 Unauthorized (debug_id=%s). Refreshing token and retrying once.",
                            debug_id,
                        )
                        await self.auth.get_access_token(force_refresh=True)
                        continue
                    logger.error(
                        "PayPal 401 Unauthorized persisted after token refresh or max retries exceeded (debug_id=%s)",
                        debug_id,
                    )
                    raise TokenInvalidError("PayPal authentication failed after token refresh")

                # Handle 404 Not Found: typed error, do NOT retry
                if resp.status_code == 404:
                    raise NotFoundError("PayPal resource not found")

                # Handle other 4xx client errors (400, 422, etc.) - do NOT retry (except 429)
                if 400 <= resp.status_code < 500 and resp.status_code != 429:
                    raise AppError(
                        code="VALIDATION_FAILED" if resp.status_code in (400, 422) else "UPSTREAM_UNAVAILABLE",
                        message=f"PayPal client error: HTTP {resp.status_code}",
                        status_code=resp.status_code,
                    )

                # Handle 429 Too Many Requests or 5xx Server Errors (retriable)
                if resp.status_code == 429 or resp.status_code >= 500:
                    if attempt > self.max_retries:
                        if resp.status_code == 429:
                            raise UpstreamUnavailableError(
                                f"PayPal rate limit exceeded after {attempt} attempts (debug_id={debug_id})"
                            )
                        raise UpstreamUnavailableError(
                            f"PayPal server error HTTP {resp.status_code} "
                            f"after {attempt} attempts (debug_id={debug_id})"
                        )

                    # Calculate backoff delay
                    retry_after_val = _parse_retry_after(resp.headers.get("Retry-After"))
                    if retry_after_val is not None:
                        delay = min(retry_after_val, self.max_retry_after_seconds)
                    else:
                        exp_delay = self.base_backoff_seconds * (2 ** (attempt - 1))
                        jitter = self._jitter_fn(0.0, 0.1)
                        delay = min(exp_delay + jitter, self.max_retry_after_seconds)

                    logger.warning(
                        "PayPal returned HTTP %d (debug_id=%s). Backing off for %.2fs (attempt %d/%d)",
                        resp.status_code,
                        debug_id,
                        delay,
                        attempt,
                        self.max_retries + 1,
                    )
                    await self._sleep_fn(delay)
                    continue

                return resp

            except (httpx.NetworkError, httpx.TimeoutException) as exc:
                if attempt > self.max_retries:
                    logger.error("PayPal network error after %d attempts: %s", attempt, exc)
                    raise UpstreamUnavailableError(f"PayPal network failure: {exc}") from exc

                exp_delay = self.base_backoff_seconds * (2 ** (attempt - 1))
                jitter = self._jitter_fn(0.0, 0.1)
                delay = min(exp_delay + jitter, self.max_retry_after_seconds)
                logger.warning(
                    "PayPal network error (%s). Backing off for %.2fs (attempt %d/%d)",
                    exc,
                    delay,
                    attempt,
                    self.max_retries + 1,
                )
                await self._sleep_fn(delay)

    async def get_dispute(self, dispute_id: str) -> Dispute:
        """Fetch a single dispute by ID from PayPal.

        Returns:
            Dispute: Validated dispute model.

        Raises:
            NotFoundError: When the dispute does not exist (404).
            UpstreamUnavailableError: On unrecoverable upstream failures or non-JSON response.
        """
        if not dispute_id or not dispute_id.strip():
            raise NotFoundError("Dispute ID cannot be empty")

        url = f"{self.base_url}/v1/customer/disputes/{dispute_id.strip()}"
        resp = await self._execute_get(url)

        try:
            data = resp.json()
        except Exception as exc:
            raise UpstreamUnavailableError("PayPal returned non-JSON response") from exc

        return parse_dispute(data)

    async def get_dispute_by_url(self, url: str) -> Dispute:
        """Fetch a single dispute using a full HATEOAS URL reference.

        Validates host safety before making the request.
        """
        resp = await self._execute_get(url)
        try:
            data = resp.json()
        except Exception as exc:
            raise UpstreamUnavailableError("PayPal returned non-JSON response") from exc

        return parse_dispute(data)

    async def list_disputes(
        self,
        page_size: int = 10,
        start_time: datetime | None = None,
        dispute_state: str | None = None,
        status: str | None = None,
        next_page_token: str | None = None,
    ) -> DisputeListResponse:
        """Fetch a single page of disputes from PayPal.

        Returns:
            DisputeListResponse: Paginated items and HATEOAS links.
        """
        url = f"{self.base_url}/v1/customer/disputes"
        params: dict[str, Any] = {"page_size": page_size}
        if start_time:
            params["start_time"] = start_time.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        if dispute_state:
            params["dispute_state"] = dispute_state
        if status:
            params["status"] = status
        if next_page_token:
            params["next_page_token"] = next_page_token

        resp = await self._execute_get(url, params=params)
        try:
            data = resp.json()
        except Exception as exc:
            raise UpstreamUnavailableError("PayPal returned non-JSON response") from exc

        return parse_dispute_list(data)

    async def list_all_disputes(
        self,
        page_size: int = 20,
        max_pages: int = 10,
        start_time: datetime | None = None,
        dispute_state: str | None = None,
        status: str | None = None,
    ) -> list[DisputeSummary]:
        """Fetch and aggregate all dispute summaries across pages up to max_pages.

        Safely stops when no next link exists or when pagination loops.
        """
        all_items: list[DisputeSummary] = []
        seen_urls: set[str] = set()
        current_page = 0

        # Initial page request
        current_resp = await self.list_disputes(
            page_size=page_size,
            start_time=start_time,
            dispute_state=dispute_state,
            status=status,
        )
        all_items.extend(current_resp.items)
        current_page += 1

        # current_page counts fetched pages (already incremented to 1 after initial fetch).
        # Loop runs while current_page < max_pages, giving max_pages total pages.
        while current_page < max_pages:
            next_link = next((link.href for link in current_resp.links if link.rel == "next"), None)
            if not next_link:
                break

            if next_link in seen_urls:
                logger.warning("Detected repeating next link in pagination: %s. Stopping.", next_link)
                break
            seen_urls.add(next_link)

            resp = await self._execute_get(next_link)
            try:
                data = resp.json()
            except Exception as exc:
                raise UpstreamUnavailableError("PayPal returned non-JSON response") from exc

            current_resp = parse_dispute_list(data)
            all_items.extend(current_resp.items)
            current_page += 1

        return all_items

    async def close(self) -> None:
        """Close underlying HTTP client and owned auth instance if created internally."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        if self._owns_auth:
            await self.auth.close()

    async def __aenter__(self) -> "PayPalReadClient":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()
