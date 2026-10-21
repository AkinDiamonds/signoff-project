"""In-memory deterministic state and fixtures for the PayPal stub."""

import copy
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "paypal"

# Fixed clock: every mutation advances one second, so responses are reproducible.
CLOCK_START = datetime(2026, 10, 5, 16, 21, 13, tzinfo=UTC)

EVENT_SUMMARIES = {
    "CUSTOMER.DISPUTE.CREATED": "Dispute created",
    "CUSTOMER.DISPUTE.UPDATED": "Dispute updated",
    "CUSTOMER.DISPUTE.RESOLVED": "Dispute resolved",
}

# Links point at the sandbox host recorded in fixtures; the stub never calls them.
STUB_BASE_URL = "https://api-m.sandbox.paypal.com"


# Functions allowed once a dispute is resolved; everything else is an illegal transition.
ALLOWED_AFTER_RESOLUTION = frozenset({"appeal"})


def load_fixture(name: str) -> dict[str, Any]:
    """Load a recorded PayPal fixture by file name."""
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


LIST_FIELDS = (
    "dispute_id",
    "create_time",
    "update_time",
    "disputed_transactions",
    "reason",
    "status",
    "dispute_state",
    "dispute_amount",
    "dispute_life_cycle_stage",
    "dispute_channel",
    "seller_response_due_date",
    "links",
)


def summary_view(dispute: dict[str, Any]) -> dict[str, Any]:
    """Project a full dispute into the list/webhook summary shape recorded in fixtures."""
    item = {key: dispute[key] for key in LIST_FIELDS if key in dispute}
    item["disputed_transactions"] = [
        {
            "buyer_transaction_id": transaction.get("buyer_transaction_id"),
            "buyer": {"payer_id": (transaction.get("buyer") or {}).get("payer_id")},
            "seller": {"merchant_id": (transaction.get("seller") or {}).get("merchant_id")},
        }
        for transaction in dispute.get("disputed_transactions", [])
    ]
    item["links"] = [
        {
            "href": f"https://api-m.sandbox.paypal.com/v1/customer/disputes/{dispute['dispute_id']}",
            "rel": "self",
            "method": "GET",
        }
    ]
    return item


def iso(dt: datetime) -> str:
    """Format as PayPal's millisecond UTC timestamp."""
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@dataclass
class FaultConfig:
    """Fault-injection switches for webhook delivery and API calls."""

    duplicate_delivery: bool = False
    out_of_order: bool = False
    delivery_delay_seconds: float = 0.0
    fail_next_calls: int = 0
    latency_ms: int = 0


@dataclass
class StubState:
    """All mutable stub data. `reset()` restores the recorded fixtures exactly."""

    disputes: dict[str, dict[str, Any]] = field(default_factory=dict)
    orders: dict[str, dict[str, Any]] = field(default_factory=dict)
    config: FaultConfig = field(default_factory=FaultConfig)
    _tick: int = 0
    _event_seq: int = 0
    _order_seq: int = 0
    _dispute_seq: int = 0

    def __post_init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.disputes = {
            dispute["dispute_id"]: dispute
            for dispute in (
                load_fixture("s5-get-dispute.json"),
                load_fixture("scenario-d-dispute.json"),
                load_fixture("scenario-e-dispute.json"),
            )
        }
        self.orders = {}
        self.config = FaultConfig()
        self._tick = 0
        self._event_seq = 0
        self._order_seq = 0
        self._dispute_seq = 0

    def now(self) -> datetime:
        self._tick += 1
        return CLOCK_START + timedelta(seconds=self._tick)

    def now_iso(self) -> str:
        return iso(self.now())

    def next_event_id(self, event_type: str) -> str:
        self._event_seq += 1
        short = event_type.rsplit(".", 1)[-1]
        return f"WH-STUB-{short}-{self._event_seq:04d}"

    def next_order_id(self) -> str:
        self._order_seq += 1
        return f"STUB-ORDER-{self._order_seq:04d}"

    def next_dispute_id(self) -> str:
        self._dispute_seq += 1
        return f"PP-STUB-{self._dispute_seq:04d}"

    def get_dispute(self, dispute_id: str) -> dict[str, Any] | None:
        return self.disputes.get(dispute_id)

    def touch(self, dispute: dict[str, Any]) -> None:
        dispute["update_time"] = self.now_iso()

    def is_resolved(self, dispute: dict[str, Any]) -> bool:
        return dispute.get("status") == "RESOLVED"

    def link(self, dispute_id: str, rel: str = "detail") -> dict[str, str]:
        return {
            "href": f"{STUB_BASE_URL}/v1/customer/disputes/{dispute_id}",
            "rel": rel,
            "method": "GET",
        }

    def add_evidence(
        self, dispute: dict[str, Any], evidence_type: str, notes: str | None
    ) -> dict[str, Any]:
        evidence = {
            "evidence_type": evidence_type or "PROOF_OF_FULFILLMENT",
            "source": "SUBMITTED_BY_SELLER",
            "date": self.now_iso(),
            "dispute_life_cycle_stage": dispute.get("dispute_life_cycle_stage", "INQUIRY"),
        }
        if notes:
            evidence["notes"] = notes
        dispute.setdefault("evidences", []).append(evidence)
        self.touch(dispute)
        return {"links": [self.link(dispute["dispute_id"])]}

    def make_offer(
        self, dispute: dict[str, Any], offer_type: str, amount: dict[str, Any], note: str | None
    ) -> dict[str, Any]:
        dispute["offer"] = {**dispute.get("offer", {}), "type": offer_type, "amount": amount}
        if note:
            dispute["offer"]["note"] = note
        dispute["status"] = "WAITING_FOR_BUYER_RESPONSE"
        dispute["dispute_state"] = "REQUIRED_ACTION"
        self.touch(dispute)
        return {"links": [self.link(dispute["dispute_id"])]}

    def accept_claim(
        self, dispute: dict[str, Any], claim_type: str, amount: dict[str, Any] | None
    ) -> dict[str, Any]:
        dispute["status"] = "RESOLVED"
        dispute["dispute_state"] = "RESOLVED"
        dispute["allowed_response_options"] = {}
        dispute["refund_details"] = {
            "allowed_refund_amount": amount or dispute["dispute_amount"]
        }
        self.touch(dispute)
        return {"links": [self.link(dispute["dispute_id"])]}

    def send_message(self, dispute: dict[str, Any], message: str) -> dict[str, Any]:
        dispute.setdefault("messages", []).append(
            {"posted_by": "SELLER", "time_posted": self.now_iso(), "content": message}
        )
        self.touch(dispute)
        return {"links": [self.link(dispute["dispute_id"])]}

    def escalate(self, dispute: dict[str, Any]) -> dict[str, Any]:
        dispute["status"] = "UNDER_REVIEW"
        dispute["dispute_state"] = "UNDER_REVIEW"
        self.touch(dispute)
        return {"links": [self.link(dispute["dispute_id"])]}

    def create_dispute(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a dispute from the buyer-side shape, reusing the scenario-D template."""
        dispute = copy.deepcopy(self.disputes.get("PP-D-4001") or load_fixture("scenario-d-dispute.json"))
        now = self.now_iso()
        amount = payload.get("dispute_amount") or dispute["dispute_amount"]
        reason = payload.get("reason") or dispute["reason"]

        dispute.update(
            {
                "dispute_id": self.next_dispute_id(),
                "create_time": now,
                "update_time": now,
                "reason": reason,
                "status": "WAITING_FOR_SELLER_RESPONSE",
                "dispute_state": "REQUIRED_ACTION",
                "dispute_amount": amount,
                "offer": {"buyer_requested_amount": amount},
                "messages": [],
                "evidences": [],
                "seller_response_due_date": iso(self.now() + timedelta(days=10)),
            }
        )
        transactions = payload.get("disputed_transactions")
        if isinstance(transactions, list) and transactions:
            dispute["disputed_transactions"] = transactions
        messages = payload.get("messages")
        if isinstance(messages, list) and messages:
            dispute["messages"] = [
                {
                    "posted_by": "BUYER",
                    "time_posted": now,
                    "content": str(message.get("content", "")),
                }
                for message in messages
                if isinstance(message, dict) and message.get("content")
            ]
        dispute["links"] = [self.link(dispute["dispute_id"], "self")]
        self.disputes[dispute["dispute_id"]] = dispute
        return dispute

    def create_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        order_id = self.next_order_id()
        amount = _order_amount(payload)
        order = {
            "id": order_id,
            "status": "CREATED",
            "purchase_units": [{"amount": amount}],
            "links": [
                {"href": f"{STUB_BASE_URL}/v2/checkout/orders/{order_id}", "rel": "self", "method": "GET"},
                {
                    "href": f"{STUB_BASE_URL}/v2/checkout/orders/{order_id}/capture",
                    "rel": "capture",
                    "method": "POST",
                },
            ],
        }
        self.orders[order_id] = order
        return order

    def capture_order(self, order_id: str) -> dict[str, Any] | None:
        order = self.orders.get(order_id)
        if order is None:
            return None
        order["status"] = "COMPLETED"
        order["purchase_units"][0]["payments"] = {
            "captures": [
                {
                    "id": f"STUB-CAPTURE-{order_id.rsplit('-', 1)[-1]}",
                    "status": "COMPLETED",
                    "amount": order["purchase_units"][0]["amount"],
                }
            ]
        }
        return order

    def build_event(self, dispute_id: str, event_type: str) -> dict[str, Any] | None:
        dispute = self.get_dispute(dispute_id)
        if dispute is None:
            return None
        event_id = self.next_event_id(event_type)
        return {
            "id": event_id,
            "event_version": "1.0",
            "create_time": self.now_iso(),
            "resource_type": "dispute",
            "event_type": event_type,
            "summary": EVENT_SUMMARIES.get(event_type, "Dispute event"),
            "resource": summary_view(dispute),
            "links": [
                {
                    "href": f"{STUB_BASE_URL}/v1/notifications/webhooks-events/{event_id}",
                    "rel": "self",
                    "method": "GET",
                }
            ],
        }


def _order_amount(payload: dict[str, Any]) -> dict[str, str]:
    units = payload.get("purchase_units")
    if isinstance(units, list) and units and isinstance(units[0].get("amount"), dict):
        return units[0]["amount"]
    return {"currency_code": "USD", "value": "10.00"}
