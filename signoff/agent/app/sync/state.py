"""Dispute state definitions, mappings, and evaluation predicates.

Fulfills Step 09 requirements:
- Maps PayPal dispute statuses to internal DisputeState enum.
- Handles unknown PayPal statuses with an explicit UNKNOWN value that never triggers an agent run.
- Maps DisputeState to database DisputeStatus for persistence.
- Predicates for seller response requirements and resolved state transitions.
"""

from enum import StrEnum
from typing import Any

from agent.app.domain.enums import DisputeReason, DisputeStatus


class DisputeState(StrEnum):
    """Internal domain dispute state."""

    WAITING_FOR_SELLER_RESPONSE = "WAITING_FOR_SELLER_RESPONSE"
    WAITING_FOR_BUYER_RESPONSE = "WAITING_FOR_BUYER_RESPONSE"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    OPEN = "OPEN"
    UNAVAILABLE = "UNAVAILABLE"
    UNKNOWN = "UNKNOWN"


# Mapping from PayPal raw status strings to internal DisputeState
_PAYPAL_STATUS_TO_STATE: dict[str, DisputeState] = {
    "WAITING_FOR_SELLER_RESPONSE": DisputeState.WAITING_FOR_SELLER_RESPONSE,
    "WAITING_FOR_BUYER_RESPONSE": DisputeState.WAITING_FOR_BUYER_RESPONSE,
    "UNDER_REVIEW": DisputeState.UNDER_REVIEW,
    "UNDER_PAYPAL_REVIEW": DisputeState.UNDER_REVIEW,
    "RESOLVED": DisputeState.RESOLVED,
    "CLOSED": DisputeState.RESOLVED,
    "OPEN": DisputeState.OPEN,
    "INQUIRY": DisputeState.OPEN,
    "UNAVAILABLE": DisputeState.UNAVAILABLE,
}

# Mapping from DisputeState to database DisputeStatus
_STATE_TO_DB_STATUS: dict[DisputeState, DisputeStatus] = {
    DisputeState.WAITING_FOR_SELLER_RESPONSE: DisputeStatus.WAITING_FOR_SELLER_RESPONSE,
    DisputeState.WAITING_FOR_BUYER_RESPONSE: DisputeStatus.WAITING_FOR_BUYER_RESPONSE,
    DisputeState.UNDER_REVIEW: DisputeStatus.UNDER_REVIEW,
    DisputeState.RESOLVED: DisputeStatus.RESOLVED,
    DisputeState.OPEN: DisputeStatus.OPEN,
    DisputeState.UNAVAILABLE: DisputeStatus.OTHER,
    DisputeState.UNKNOWN: DisputeStatus.OTHER,
}


def map_paypal_status_to_dispute_state(status: str | DisputeStatus | DisputeState | None) -> DisputeState:
    """Map any PayPal status string or enum into domain DisputeState.

    Exhaustive over the enum: unknown PayPal statuses map safely to DisputeState.UNKNOWN,
    never raising an exception.
    """
    if status is None:
        return DisputeState.UNKNOWN

    status_str = status.value if hasattr(status, "value") else str(status)
    status_clean = status_str.strip().upper()

    return _PAYPAL_STATUS_TO_STATE.get(status_clean, DisputeState.UNKNOWN)


def map_dispute_state_to_db_status(state: DisputeState) -> DisputeStatus:
    """Map domain DisputeState to database DisputeStatus enum."""
    return _STATE_TO_DB_STATUS.get(state, DisputeStatus.OTHER)


def map_paypal_reason(reason: str | DisputeReason | None) -> DisputeReason:
    """Map PayPal reason string to domain DisputeReason enum.

    Falls back to DisputeReason.OTHER for unknown or unhandled reasons.
    """
    if reason is None:
        return DisputeReason.OTHER

    reason_str = reason.value if hasattr(reason, "value") else str(reason)
    reason_clean = reason_str.strip().upper()

    try:
        return DisputeReason(reason_clean)
    except ValueError:
        return DisputeReason.OTHER


def requires_seller_response(state: DisputeState | str | None) -> bool:
    """Predicate determining if dispute state requires a seller response (triggers agent run).

    Returns True ONLY for WAITING_FOR_SELLER_RESPONSE.
    Returns False for UNKNOWN, UNAVAILABLE, OPEN, UNDER_REVIEW, WAITING_FOR_BUYER_RESPONSE, and RESOLVED.
    """
    if state is None:
        return False

    dispute_state = (
        state if isinstance(state, DisputeState) else map_paypal_status_to_dispute_state(state)
    )
    return dispute_state is DisputeState.WAITING_FOR_SELLER_RESPONSE


def is_dispute_resolved(state: DisputeState | str | None) -> bool:
    """Predicate determining if dispute is in a final resolved/closed state."""
    if state is None:
        return False

    dispute_state = (
        state if isinstance(state, DisputeState) else map_paypal_status_to_dispute_state(state)
    )
    return dispute_state is DisputeState.RESOLVED
