"""Evidence builder for merchandise-or-service-not-as-described disputes.

The merchant's proof here is the order record itself: what was ordered, when,
and for how much. No tracking is needed, so this builder deliberately submits a
receipt rather than fulfillment proof.
"""

import re

from agent.app.agent.evidence import BuiltEvidence, score_evidence
from agent.app.store_mock.scenarios import OrderRecord

NOT_AS_DESCRIBED_REASON = "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
EVIDENCE_TYPE = "RECEIPT"
ITEM_LABEL_PATTERN = re.compile(r"[^A-Za-z0-9 .,'-]")


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


def build_not_as_described(
    order: OrderRecord | None,
    *,
    transaction_id: str | None = None,
) -> BuiltEvidence:
    """Build receipt evidence, or explain why it cannot be submitted."""
    if order is None:
        return BuiltEvidence(
            buildable=False,
            evidence_type=None,
            notes=None,
            tracking_info=(),
            reason=f"No order found for transaction {transaction_id or 'unknown'}; nothing was submitted.",
            strength=score_evidence(None, shipments=[], delivered_at=None, buyer_prior_disputes=0),
        )

    strength = score_evidence(
        order,
        shipments=[],
        delivered_at=None,
        buyer_prior_disputes=order.buyer_prior_disputes,
    )

    labels = _item_labels(order.items)
    if not labels or order.amount <= 0:
        return BuiltEvidence(
            buildable=False,
            evidence_type=None,
            notes=None,
            tracking_info=(),
            reason=(
                "The order has no item description or amount; not-as-described evidence "
                "cannot be built. Human review is required."
            ),
            strength=strength,
        )

    notes = (
        f"Order {order.order_code} for {order.currency} {order.amount:.2f} "
        f"was placed on {order.created_at.date().isoformat()}. "
        f"Items on the order: {', '.join(labels)}."
    )
    return BuiltEvidence(
        buildable=True,
        evidence_type=EVIDENCE_TYPE,
        notes=notes,
        tracking_info=(),
        reason="Receipt evidence built from the mock order record.",
        strength=strength,
    )
