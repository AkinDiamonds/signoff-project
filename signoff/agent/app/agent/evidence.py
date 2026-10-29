"""Evidence builder and strength score for not-received disputes.

Pure functions over mock-store snapshots. Nothing here calls PayPal or the
database. Output wording is deliberately plain and never says "probability" or
"win".
"""

import re
from dataclasses import dataclass
from datetime import datetime

from agent.app.domain.actions import ProvideEvidence
from agent.app.domain.enums import EvidenceStrengthLabel, TrackingStatus
from agent.app.store.models import OrderRecord, ShipmentRecord

NOT_RECEIVED_REASON = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
EVIDENCE_TYPE = "PROOF_OF_FULFILLMENT"

# Common carrier values used by PayPal evidence. Unknown values fail closed.
ALLOWED_CARRIERS = frozenset({"UPS", "USPS", "FEDEX", "DHL"})
TRACKING_PATTERN = re.compile(r"^[A-Za-z0-9-]{4,50}$")
ITEM_LABEL_PATTERN = re.compile(r"[^A-Za-z0-9 .,'-]")

HIGH_THRESHOLD = 70
MEDIUM_THRESHOLD = 40


@dataclass(frozen=True, slots=True)
class EvidenceComponent:
    name: str
    points: int
    detail: str

    def __post_init__(self) -> None:
        if self.points < 0:
            raise ValueError("Evidence component points cannot be negative")


@dataclass(frozen=True, slots=True)
class EvidenceStrength:
    score: int
    label: EvidenceStrengthLabel
    components: tuple[EvidenceComponent, ...]

    def __post_init__(self) -> None:
        if isinstance(self.score, bool) or not isinstance(self.score, int):
            raise TypeError("Evidence strength score must be an integer")
        if not 0 <= self.score <= 100:
            raise ValueError("Evidence strength score must be between 0 and 100")
        if self.label != label_for(self.score):
            raise ValueError("Evidence strength label does not match the score")


@dataclass(frozen=True, slots=True)
class BuiltEvidence:
    buildable: bool
    evidence_type: str | None
    notes: str | None
    tracking_info: tuple[dict[str, str], ...]
    reason: str
    strength: EvidenceStrength

    def __post_init__(self) -> None:
        if not self.reason.strip():
            raise ValueError("Evidence reason cannot be empty")
        if self.buildable:
            if not self.evidence_type or not self.notes:
                raise ValueError("Buildable evidence requires a type and notes")
        elif self.evidence_type is not None or self.notes is not None or self.tracking_info:
            raise ValueError("Non-buildable evidence cannot carry submission fields")
        for info in self.tracking_info:
            if set(info) != {"carrier", "tracking_number"}:
                raise ValueError("Tracking info must contain only carrier and tracking_number")


def label_for(score: int) -> EvidenceStrengthLabel:
    """Map a 0-100 score to its label, boundary inclusive at 40 and 70."""
    if isinstance(score, bool) or not isinstance(score, int):
        raise TypeError("Evidence strength score must be an integer")
    if not 0 <= score <= 100:
        raise ValueError("Evidence strength score must be between 0 and 100")
    if score >= HIGH_THRESHOLD:
        return EvidenceStrengthLabel.HIGH
    if score >= MEDIUM_THRESHOLD:
        return EvidenceStrengthLabel.MEDIUM
    return EvidenceStrengthLabel.LOW


def normalize_carrier(value: str) -> str | None:
    """Return a supported uppercase carrier, or None for an unknown value."""
    clean = value.strip().upper()
    return clean if clean in ALLOWED_CARRIERS else None


def normalize_tracking_number(value: str) -> str | None:
    """Return a clean tracking number, or None when it has odd characters/length."""
    clean = value.strip()
    if not TRACKING_PATTERN.fullmatch(clean):
        return None
    return clean.upper()


def _valid_shipments(order: OrderRecord) -> tuple[list[tuple[ShipmentRecord, str, str]], list[str]]:
    valid: list[tuple[ShipmentRecord, str, str]] = []
    ignored: list[str] = []
    for shipment in sorted(order.shipments, key=lambda item: item.event_time):
        carrier = normalize_carrier(shipment.carrier)
        tracking_number = normalize_tracking_number(shipment.tracking_number)
        if carrier is None:
            ignored.append("A shipment with an unsupported carrier was ignored.")
        elif tracking_number is None:
            ignored.append("A shipment with an invalid tracking number was ignored.")
        else:
            valid.append((shipment, carrier, tracking_number))
    return valid, ignored


def _delivered_after_order(
    shipments: list[tuple[ShipmentRecord, str, str]],
    created_at: datetime,
) -> datetime | None:
    for shipment, _, _ in shipments:
        if shipment.status == TrackingStatus.DELIVERED and shipment.event_time >= created_at:
            return shipment.event_time
    return None


def _has_early_delivery(
    shipments: list[tuple[ShipmentRecord, str, str]],
    created_at: datetime,
) -> bool:
    return any(
        shipment.status == TrackingStatus.DELIVERED and shipment.event_time < created_at
        for shipment, _, _ in shipments
    )


def _item_labels(items: tuple[dict[str, object], ...]) -> list[str]:
    labels: list[str] = []
    for item in items:
        name = item.get("name")
        if not isinstance(name, str):
            continue
        clean = ITEM_LABEL_PATTERN.sub("", name).strip()[:80]
        if clean:
            labels.append(clean)
        if len(labels) == 5:
            break
    return labels


def _build_notes(
    order: OrderRecord,
    shipments: list[tuple[ShipmentRecord, str, str]],
    delivered_at: datetime | None,
    early_delivery: bool,
) -> str:
    parts = [
        f"Order {order.order_code} for {order.currency} {order.amount:.2f} "
        f"was placed on {order.created_at.date().isoformat()}."
    ]
    labels = _item_labels(order.items)
    if labels:
        parts.append(f"Items: {', '.join(labels)}.")

    if shipments:
        routes = "; ".join(
            f"{carrier} tracking {tracking_number}" for _, carrier, tracking_number in shipments
        )
        parts.append(f"Shipments: {routes}.")
        if delivered_at is not None:
            parts.append(f"Delivered on {delivered_at.date().isoformat()}.")
        elif early_delivery:
            parts.append("A delivery event is dated before the order and was not counted as delivery.")
        else:
            parts.append("No delivery event is recorded yet.")
    else:
        parts.append("No shipment tracking is recorded for this order.")

    return " ".join(parts)


def score_evidence(
    order: OrderRecord | None,
    *,
    shipments: list[tuple[ShipmentRecord, str, str]],
    delivered_at: datetime | None,
    buyer_prior_disputes: int,
) -> EvidenceStrength:
    components = [
        EvidenceComponent(
            name="delivered",
            points=40 if delivered_at is not None else 0,
            detail=(
                f"Delivered on {delivered_at.date().isoformat()}."
                if delivered_at is not None
                else "No on-time delivery event."
            ),
        ),
        EvidenceComponent(
            name="tracking",
            points=25 if shipments else 0,
            detail=(
                "Valid carrier and tracking number present."
                if shipments
                else "No valid shipment tracking."
            ),
        ),
    ]

    if order is None:
        history_points = 0
        history_detail = "No order record; buyer history not evaluated."
    elif buyer_prior_disputes == 0:
        history_points = 15
        history_detail = "No prior disputes."
    elif buyer_prior_disputes == 1:
        history_points = 8
        history_detail = "1 prior dispute."
    else:
        history_points = 0
        history_detail = f"{buyer_prior_disputes} prior disputes."
    components.append(EvidenceComponent("buyer_history", history_points, history_detail))

    if order is None:
        completeness_points = 0
        completeness_detail = "No order record."
    elif order.items and order.amount > 0:
        completeness_points = 20
        completeness_detail = "Order items and amount present."
    else:
        completeness_points = 10
        completeness_detail = "Order found without item details."
    components.append(EvidenceComponent("completeness", completeness_points, completeness_detail))

    score = max(0, min(100, sum(component.points for component in components)))
    return EvidenceStrength(score=score, label=label_for(score), components=tuple(components))


def build_evidence(
    order: OrderRecord | None,
    *,
    reason: str,
    transaction_id: str | None = None,
) -> BuiltEvidence:
    """Build not-received evidence, or explain why nothing can be submitted."""
    if order is None:
        strength = score_evidence(
            None,
            shipments=[],
            delivered_at=None,
            buyer_prior_disputes=0,
        )
        return BuiltEvidence(
            buildable=False,
            evidence_type=None,
            notes=None,
            tracking_info=(),
            reason=f"No order found for transaction {transaction_id or 'unknown'}; nothing was submitted.",
            strength=strength,
        )

    shipments, ignored = _valid_shipments(order)
    delivered_at = _delivered_after_order(shipments, order.created_at)
    early_delivery = _has_early_delivery(shipments, order.created_at)
    strength = score_evidence(
        order,
        shipments=shipments,
        delivered_at=delivered_at,
        buyer_prior_disputes=order.buyer_prior_disputes,
    )

    if reason != NOT_RECEIVED_REASON:
        return BuiltEvidence(
            buildable=False,
            evidence_type=None,
            notes=None,
            tracking_info=(),
            reason="Only merchandise-or-service-not-received disputes are supported; nothing was submitted.",
            strength=strength,
        )

    if order.shipments and not shipments:
        return BuiltEvidence(
            buildable=False,
            evidence_type=None,
            notes=None,
            tracking_info=(),
            reason=(
                "No shipment has a supported carrier and a valid tracking number; nothing was submitted. "
                + " ".join(ignored)
            ).strip(),
            strength=strength,
        )

    tracking_info = tuple(
        {"carrier": carrier, "tracking_number": tracking_number}
        for _, carrier, tracking_number in shipments
    )
    notes = _build_notes(order, shipments, delivered_at, early_delivery)
    reason_text = "Evidence built from the mock order and shipment records."
    if not shipments:
        reason_text = "No shipment tracking is available; submitting order notes only."
    if ignored:
        reason_text += " " + " ".join(ignored)

    return BuiltEvidence(
        buildable=True,
        evidence_type=EVIDENCE_TYPE,
        notes=notes,
        tracking_info=tracking_info,
        reason=reason_text,
        strength=strength,
    )


def to_provide_evidence(evidence: BuiltEvidence) -> ProvideEvidence | None:
    """Map built evidence to the action the gate and executor already understand."""
    if not evidence.buildable:
        return None
    return ProvideEvidence(
        evidence_type=evidence.evidence_type,
        notes=evidence.notes,
        tracking_info=evidence.tracking_info,
    )
