"""Dispute state fingerprint computation.

Computes a deterministic, stable SHA-256 state fingerprint strictly from the
inputs defined in build-plan/contracts.md:
  Included: status, dispute_state, life-cycle stage, reason, disputed amount,
            due date, evidence types and sources, allowed response option sets,
            offer count, message count.
  Excluded: link URLs, create and update timestamps, ordering of lists.
"""

import hashlib
import json
from datetime import UTC
from typing import Any

from agent.app.paypal.models import Dispute, DisputeSummary


class Fingerprint(str):
    """Distinct string type representing a SHA-256 dispute state fingerprint."""

    def __repr__(self) -> str:
        return f"Fingerprint('{super().__str__()}')"


def compute_dispute_fingerprint(dispute: Dispute | DisputeSummary) -> Fingerprint:
    """Compute a stable state fingerprint for a dispute.

    Uses exactly the 10 inputs specified in build-plan/contracts.md.
    Order-independent for links, evidence lists, and allowed options.
    """
    # 1. status
    status_str = dispute.status.value if hasattr(dispute.status, "value") else str(dispute.status)

    # 2. dispute_state
    dispute_state_str = dispute.dispute_state

    # 3. life-cycle stage
    stage_str = dispute.dispute_life_cycle_stage

    # 4. reason
    reason_str = dispute.reason.value if hasattr(dispute.reason, "value") else str(dispute.reason)

    # 5. disputed amount
    amount = dispute.dispute_amount
    amount_payload = {
        "currency_code": amount.currency_code,
        "value": f"{amount.value:.2f}",
    }

    # 6. due date (UTC normalized, None if absent)
    due_date_str: str | None = None
    if dispute.seller_response_due_date is not None:
        utc_dt = dispute.seller_response_due_date.astimezone(UTC)
        due_date_str = utc_dt.isoformat()

    # 7. evidence types and sources (sorted pairs so list ordering does not matter)
    evidence_pairs: list[dict[str, str]] = []
    evidences = getattr(dispute, "evidences", None) or []
    for ev in evidences:
        evidence_pairs.append({
            "evidence_type": str(ev.evidence_type),
            "source": str(ev.source),
        })
    evidence_pairs.sort(key=lambda x: (x["evidence_type"], x["source"]))

    # 8. allowed response option sets (sorted values so order does not matter)
    allowed_opts: dict[str, list[str]] = {}
    options = getattr(dispute, "allowed_response_options", None)
    if options is not None:
        if options.accept_claim and options.accept_claim.accept_claim_types:
            allowed_opts["accept_claim"] = sorted(options.accept_claim.accept_claim_types)
        if options.make_offer and options.make_offer.offer_types:
            allowed_opts["make_offer"] = sorted(options.make_offer.offer_types)

    # 9. offer count per build-plan/contracts.md
    # PayPal's active dispute model has a single offer object (or None),
    # but we support list, object, or dict forms defensively so any offer change is captured.
    offer = getattr(dispute, "offer", None)
    offer_count = 0
    if offer is not None:
        if isinstance(offer, list):
            offer_count = len(offer)
        elif getattr(offer, "buyer_requested_amount", None) is not None:
            offer_count = 1
        elif isinstance(offer, dict):
            offer_count = len(offer.get("history", [])) if "history" in offer else (1 if offer else 0)
        else:
            offer_count = 1

    # 10. message count
    messages = getattr(dispute, "messages", None) or []
    message_count = len(messages)

    canonical_payload: dict[str, Any] = {
        "allowed_response_option_sets": allowed_opts,
        "dispute_state": dispute_state_str,
        "disputed_amount": amount_payload,
        "due_date": due_date_str,
        "evidence_types_and_sources": evidence_pairs,
        "life_cycle_stage": stage_str,
        "message_count": message_count,
        "offer_count": offer_count,
        "reason": reason_str,
        "status": status_str,
    }

    canonical_json = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    return Fingerprint(digest)
