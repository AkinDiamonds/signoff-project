"""HTTP-based StoreAdapter implementation communicating with the store API."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx

from agent.app.domain.enums import OrderStatus, TrackingStatus
from agent.app.store.base import StoreUnavailable
from agent.app.store.models import OrderRecord, ShipmentRecord


def _ensure_utc(dt: Any) -> datetime:
    if dt is None:
        return datetime.now(UTC)
    if isinstance(dt, str):
        try:
            return datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return datetime.now(UTC)
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    return datetime.now(UTC)


class HttpStoreAdapter:
    """StoreAdapter implementation backed by HTTP calls to store endpoints."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._client = client
        self._owns_client = client is None

    def _get_client(self) -> httpx.Client:
        if self._client is not None:
            return self._client
        self._client = httpx.Client(timeout=10.0)
        return self._client

    def _get(self, path: str) -> httpx.Response:
        url = f"{self._base_url}{path}"
        headers = {"X-Store-Key": self._api_key}
        client = self._get_client()
        try:
            resp = client.get(url, headers=headers)
        except httpx.RequestError as exc:
            raise StoreUnavailable(f"Store connection failed: {exc}") from exc

        if resp.status_code >= 500 or resp.status_code in (401, 403):
            raise StoreUnavailable(
                f"Store service returned HTTP {resp.status_code}: {resp.text}"
            )
        return resp

    def find_order(self, transaction_id: str) -> OrderRecord | None:
        """Find an order by PayPal transaction ID, including its shipments."""
        resp = self._get(f"/api/store/orders/by-transaction/{transaction_id.strip()}")
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            raise StoreUnavailable(f"Unexpected response status {resp.status_code}")

        data = resp.json()
        order_code = data["order_code"]
        shipments = tuple(self.get_shipments(order_code))
        raw_items = data.get("items", [])
        items = tuple(item for item in raw_items if isinstance(item, dict))

        return OrderRecord(
            order_code=order_code,
            paypal_transaction_id=transaction_id.strip(),
            customer_email=data["customer_email"],
            amount=Decimal(str(data["amount"])),
            currency=data["currency"],
            status=OrderStatus(data["status"]),
            items=items,
            created_at=_ensure_utc(data["created_at"]),
            shipments=shipments,
            buyer_prior_disputes=0,
        )

    def get_shipments(self, order_code: str) -> list[ShipmentRecord]:
        """Retrieve tracking shipment events for an order code."""
        resp = self._get(f"/api/store/orders/{order_code.strip()}/shipments")
        if resp.status_code == 404:
            return []
        if resp.status_code != 200:
            raise StoreUnavailable(f"Unexpected response status {resp.status_code}")

        data = resp.json()
        results: list[ShipmentRecord] = []
        for s in data:
            results.append(
                ShipmentRecord(
                    carrier=s["carrier"],
                    tracking_number=s["tracking_number"],
                    status=TrackingStatus(s["status"]),
                    event_time=_ensure_utc(s["event_time"]),
                    payload=s.get("payload") if isinstance(s.get("payload"), dict) else None,
                )
            )
        return results

    def get_messages(self, order_code: str) -> list[dict[str, Any]]:
        """Retrieve buyer messages for an order."""
        resp = self._get(f"/api/store/orders/{order_code.strip()}/messages")
        if resp.status_code == 404:
            return []
        if resp.status_code != 200:
            raise StoreUnavailable(f"Unexpected response status {resp.status_code}")
        data = resp.json()
        return data if isinstance(data, list) else []

    def get_policies(self) -> dict[str, Any]:
        """Retrieve merchant policies."""
        resp = self._get("/api/store/policies")
        if resp.status_code != 200:
            raise StoreUnavailable(f"Unexpected response status {resp.status_code}")
        data = resp.json()
        return data if isinstance(data, dict) else {}

    def close(self) -> None:
        if self._owns_client and self._client is not None:
            self._client.close()
            self._client = None
