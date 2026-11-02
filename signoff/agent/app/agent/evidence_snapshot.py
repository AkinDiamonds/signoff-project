"""Typed, minimal evidence facts captured at decision time."""

import hashlib
import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from agent.app.agent.evidence import BuiltEvidence
from agent.app.store.models import OrderRecord


class SnapshotMilestone(BaseModel):
    source_id: str | None
    carrier: str
    tracking_number: str
    status: str
    event_time: datetime
    source: Literal["simulated", "unknown"]


class SnapshotComponent(BaseModel):
    name: str
    points: int
    detail: str


class EvidenceSnapshotData(BaseModel):
    version: Literal[1] = 1
    order_code: str | None
    payment_reference: str | None
    order_created_at: datetime | None
    amount: str | None
    currency: str | None
    items: list[str]
    milestones: list[SnapshotMilestone]
    buildable: bool
    evidence_type: str | None
    tracking_submission_count: int | None = None
    notes: str | None
    explanation: str
    score: int | None
    strength: str | None
    components: list[SnapshotComponent]


def build_snapshot(
    order: OrderRecord | None, evidence: BuiltEvidence | None, *, explanation: str | None = None,
) -> tuple[dict[str, object], str]:
    snapshot = EvidenceSnapshotData(
        order_code=order.order_code if order else None,
        payment_reference=order.paypal_transaction_id if order else None,
        order_created_at=order.created_at if order else None,
        amount=str(order.amount) if order else None,
        currency=order.currency if order else None,
        items=[str(item["name"]) for item in order.items if isinstance(item.get("name"), str)][:20] if order else [],
        milestones=[
            SnapshotMilestone(
                source_id=s.source_id,
                carrier=s.carrier,
                tracking_number=s.tracking_number,
                status=s.status.value,
                event_time=s.event_time,
                source="simulated" if (s.payload or {}).get("source") == "simulated" else "unknown",
            )
            for s in order.shipments
        ]
        if order
        else [],
        buildable=evidence.buildable if evidence else False,
        evidence_type=evidence.evidence_type if evidence else None,
        tracking_submission_count=len(evidence.tracking_info) if evidence else None,
        notes=evidence.notes if evidence else None,
        explanation=explanation or (evidence.reason if evidence else "No matching order evidence was available."),
        score=evidence.strength.score if evidence else None,
        strength=evidence.strength.label.value if evidence else None,
        components=[
            SnapshotComponent(name=c.name, points=c.points, detail=c.detail) for c in evidence.strength.components
        ]
        if evidence
        else [],
    )
    payload: dict[str, object] = snapshot.model_dump(mode="json")
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return payload, digest
