"""Exhaustive reason registry mapping supported dispute reasons to builders.

Anything not in the registry is an explicit :class:`UnsupportedReason`. The
agent never guesses evidence for an unsupported reason; it stops and asks for a
human instead.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from enum import Enum
from typing import Any

from agent.app.agent.evidence import (
    NOT_RECEIVED_REASON,
    BuiltEvidence,
    build_evidence,
    score_evidence,
)
from agent.app.agent.reasons.not_as_described import (
    NOT_AS_DESCRIBED_REASON,
    build_not_as_described,
)
from agent.app.store_mock.scenarios import OrderRecord

EvidenceBuilder = Callable[..., BuiltEvidence]


@dataclass(frozen=True, slots=True)
class SupportedReason:
    """A reason the agent knows how to build evidence for."""

    reason: str
    builder: EvidenceBuilder
    requires_buildable_evidence: bool = False


@dataclass(frozen=True, slots=True)
class UnsupportedReason:
    """A distinct result for any reason outside the registry."""

    reason: str


ReasonSupport = SupportedReason | UnsupportedReason


def _build_not_received(
    order: OrderRecord | None,
    *,
    transaction_id: str | None = None,
) -> BuiltEvidence:
    return build_evidence(order, reason=NOT_RECEIVED_REASON, transaction_id=transaction_id)


REASON_REGISTRY: Mapping[str, SupportedReason] = {
    NOT_RECEIVED_REASON: SupportedReason(
        reason=NOT_RECEIVED_REASON,
        builder=_build_not_received,
    ),
    NOT_AS_DESCRIBED_REASON: SupportedReason(
        reason=NOT_AS_DESCRIBED_REASON,
        builder=build_not_as_described,
        requires_buildable_evidence=True,
    ),
}


def normalize_reason(reason: Any) -> str:
    """Return the plain string form of an enum, str, or unknown value."""
    if isinstance(reason, Enum):
        return str(reason.value)
    return str(reason)


def get_support(reason: Any) -> ReasonSupport:
    """Look a reason up in the registry; unknown values return UnsupportedReason."""
    key = normalize_reason(reason)
    return REASON_REGISTRY.get(key, UnsupportedReason(reason=key))


def is_supported(reason: Any) -> bool:
    return isinstance(get_support(reason), SupportedReason)


def build_evidence_for(
    reason: Any,
    order: OrderRecord | None,
    *,
    transaction_id: str | None = None,
) -> BuiltEvidence:
    """Build evidence for a reason, or return an explicit non-buildable result."""
    support = get_support(reason)
    if isinstance(support, UnsupportedReason):
        return BuiltEvidence(
            buildable=False,
            evidence_type=None,
            notes=None,
            tracking_info=(),
            reason=(
                f"Reason '{support.reason}' is not supported by the agent; "
                "nothing was submitted and human review is required."
            ),
            strength=_unknown_strength(order),
        )
    return support.builder(order, transaction_id=transaction_id)


def _unknown_strength(order: OrderRecord | None):
    return score_evidence(
        order,
        shipments=[],
        delivered_at=None,
        buyer_prior_disputes=order.buyer_prior_disputes if order is not None else 0,
    )


__all__ = [
    "REASON_REGISTRY",
    "EvidenceBuilder",
    "ReasonSupport",
    "SupportedReason",
    "UnsupportedReason",
    "build_evidence_for",
    "get_support",
    "is_supported",
    "normalize_reason",
]
