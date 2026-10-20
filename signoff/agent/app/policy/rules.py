"""Gate policy rules, rule registry, and individual check implementations.

Per plan/03-gate-spec.md and build-plan/steps/11-gate-core.md.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from agent.app.domain.actions import (
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProvideEvidence,
    SendMessage,
)
from agent.app.domain.enums import ActionType, DisputeStatus, Verdict
from agent.app.paypal.models import Dispute

# Money-guarding actions concede funds and are therefore subject to Step 3 limits.
MONEY_ACTIONS = (ActionType.MAKE_OFFER, ActionType.ACCEPT_CLAIM)

# Per ADR-007 / plan/03-gate-spec.md: approval may waive steps 3-5 only.
WAIVABLE_STEPS = frozenset({3, 4, 5})
NEVER_WAIVABLE_STEPS = frozenset({0, 1, 2, 6})


@dataclass(frozen=True, slots=True)
class RuleDefinition:
    """Metadata describing a gate rule from the specification."""

    rule_id: str
    step: int
    default_verdict: Verdict
    description: str


@dataclass(frozen=True, slots=True)
class RuleResult:
    """Outcome of evaluating a single rule against a gate input."""

    rule_id: str
    step: int
    verdict: Verdict
    reason: str


# Canonical, exhaustive registry of rule definitions per plan/03-gate-spec.md
# Guarantees no duplicate rule IDs exist.
RULE_REGISTRY: dict[str, RuleDefinition] = {
    # Step 0: Fail-closed fallback
    "G0-00": RuleDefinition("G0-00", 0, Verdict.NEEDS_APPROVAL, "Anything unexpected (fail closed)"),
    # Step 1: PayPal options
    "G1-01": RuleDefinition("G1-01", 1, Verdict.DENY, "Action not in allowed_response_options or HATEOAS links"),
    "G1-02": RuleDefinition("G1-02", 1, Verdict.DENY, "Offer type / claim type not in PayPal's allowed list"),
    # Step 2: State and time
    "G2-01": RuleDefinition(
        "G2-01",
        2,
        Verdict.DENY,
        "Status not WAITING_FOR_SELLER_RESPONSE (or other state that permits the action)",
    ),
    "G2-02": RuleDefinition("G2-02", 2, Verdict.DENY, "seller_response_due_date passed"),
    # Step 3: Amount
    "G3-01": RuleDefinition("G3-01", 3, Verdict.NEEDS_APPROVAL, "Offer amount > auto_offer_max"),
    "G3-02": RuleDefinition("G3-02", 3, Verdict.NEEDS_APPROVAL, "Accept amount > auto_accept_max"),
    "G3-03": RuleDefinition("G3-03", 3, Verdict.DENY, "Currency mismatch or non-positive amount"),
    "G3-04": RuleDefinition("G3-04", 3, Verdict.DENY, "Offer exceeds disputed amount"),
    # Step 4: Reason
    "G4-01": RuleDefinition("G4-01", 4, Verdict.NEEDS_APPROVAL, "Reason in never_auto_reasons"),
    "G4-02": RuleDefinition("G4-02", 4, Verdict.NEEDS_APPROVAL, "Action in never_auto_actions"),
    # Step 5: History
    "G5-01": RuleDefinition(
        "G5-01",
        5,
        Verdict.NEEDS_APPROVAL,
        "Buyer disputes in window >= repeat_disputer_threshold",
    ),
    "G5-02": RuleDefinition("G5-02", 5, Verdict.DENY, "Content-injection flag raised by the input screener"),
    # Step 6: Idempotency
    "G6-01": RuleDefinition(
        "G6-01",
        6,
        Verdict.DENY,
        "An execution already exists for (dispute, state fingerprint, action type)",
    ),
    # Step 7: Defaults
    "G7-01": RuleDefinition(
        "G7-01",
        7,
        Verdict.ALLOW,
        "All checks passed; action is auto-permitted by charter flag",
    ),
    # Merchant Approval
    "A-01": RuleDefinition("A-01", 8, Verdict.ALLOW, "Approved by merchant"),
}


KNOWN_ACTION_TYPES = (
    ActionType.PROVIDE_EVIDENCE,
    ActionType.SEND_MESSAGE,
    ActionType.MAKE_OFFER,
    ActionType.ACCEPT_CLAIM,
    ActionType.ESCALATE,
    ActionType.APPEAL,
)

KNOWN_ACTION_CLASSES = (
    ProvideEvidence,
    SendMessage,
    MakeOffer,
    AcceptClaim,
    Escalate,
    Appeal,
)


def check_g0_00(action: Any) -> RuleResult | None:
    """G0-00: Fail-closed fallback on unknown or unexpected action type."""
    if not isinstance(action, KNOWN_ACTION_CLASSES):
        return RuleResult(
            rule_id="G0-00",
            step=0,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=f"Unknown or unexpected action class: {type(action).__name__}",
        )
    action_type = getattr(action, "action_type", None)
    if action_type not in KNOWN_ACTION_TYPES:
        return RuleResult(
            rule_id="G0-00",
            step=0,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=f"Unknown action type reaching gate: {action_type!r}",
        )
    return None


def check_g1_01(action: Any, dispute: Dispute) -> RuleResult | None:
    """G1-01: DENY if action not in allowed_response_options or HATEOAS links."""
    action_type = getattr(action, "action_type", None)
    if action_type not in KNOWN_ACTION_TYPES:
        return None

    links = getattr(dispute, "links", None) or []
    link_rels = {link.rel.lower() for link in links if hasattr(link, "rel") and link.rel}
    options = getattr(dispute, "allowed_response_options", None)

    is_permitted = False

    if action_type == ActionType.PROVIDE_EVIDENCE:
        is_permitted = bool({"provide_evidence", "provide-evidence"} & link_rels)
    elif action_type == ActionType.SEND_MESSAGE:
        is_permitted = bool({"send_message", "send-message"} & link_rels)
    elif action_type == ActionType.ESCALATE:
        is_permitted = bool({"escalate", "escalate-dispute"} & link_rels)
    elif action_type == ActionType.APPEAL:
        is_permitted = bool({"appeal", "appeal-dispute"} & link_rels)
    elif action_type == ActionType.MAKE_OFFER:
        has_option = bool(options and options.make_offer and options.make_offer.offer_types)
        has_link = bool({"make_offer", "make-offer"} & link_rels)
        is_permitted = has_option or has_link
    elif action_type == ActionType.ACCEPT_CLAIM:
        has_option = bool(options and options.accept_claim and options.accept_claim.accept_claim_types)
        has_link = bool({"accept_claim", "accept-claim"} & link_rels)
        is_permitted = has_option or has_link

    if not is_permitted:
        return RuleResult(
            rule_id="G1-01",
            step=1,
            verdict=Verdict.DENY,
            reason=f"Action '{action_type}' not permitted by PayPal allowed_response_options or links",
        )
    return None


def check_g1_02(action: Any, dispute: Dispute) -> RuleResult | None:
    """G1-02: DENY if offer type or claim type not in PayPal's allowed list."""
    action_type = getattr(action, "action_type", None)
    options = getattr(dispute, "allowed_response_options", None)

    if action_type == ActionType.MAKE_OFFER:
        offer_opts = options.make_offer if options else None
        allowed_offer_types = offer_opts.offer_types if offer_opts else []
        offer_type = getattr(action, "offer_type", None)
        if offer_type not in allowed_offer_types:
            return RuleResult(
                rule_id="G1-02",
                step=1,
                verdict=Verdict.DENY,
                reason=f"Offer type '{offer_type}' not in allowed offer types {allowed_offer_types}",
            )

    elif action_type == ActionType.ACCEPT_CLAIM:
        claim_opts = options.accept_claim if options else None
        allowed_claim_types = claim_opts.accept_claim_types if claim_opts else []
        claim_type = getattr(action, "accept_claim_type", None)
        if claim_type not in allowed_claim_types:
            return RuleResult(
                rule_id="G1-02",
                step=1,
                verdict=Verdict.DENY,
                reason=f"Accept claim type '{claim_type}' not in allowed claim types {allowed_claim_types}",
            )

    return None


def check_g2_01(action: Any, dispute: Dispute) -> RuleResult | None:
    """G2-01: DENY if status not WAITING_FOR_SELLER_RESPONSE."""
    status_val = dispute.status.value if hasattr(dispute.status, "value") else str(dispute.status)
    if status_val != DisputeStatus.WAITING_FOR_SELLER_RESPONSE.value:
        return RuleResult(
            rule_id="G2-01",
            step=2,
            verdict=Verdict.DENY,
            reason=f"Dispute status is '{status_val}', expected WAITING_FOR_SELLER_RESPONSE",
        )
    return None


def check_g2_02(action: Any, dispute: Dispute, now: datetime) -> RuleResult | None:
    """G2-02: DENY if seller_response_due_date passed."""
    if now.tzinfo is None:
        raise ValueError("Timezone-naive now is rejected; must be timezone-aware UTC")

    due_date = getattr(dispute, "seller_response_due_date", None)
    if due_date is not None:
        if due_date.tzinfo is None:
            raise ValueError("Timezone-naive seller_response_due_date is rejected; must be timezone-aware UTC")
        # Boundary: allowed at or before the due time, denied strictly after
        if now > due_date:
            return RuleResult(
                rule_id="G2-02",
                step=2,
                verdict=Verdict.DENY,
                reason=f"Seller response deadline passed: {due_date.isoformat()} < {now.isoformat()}",
            )
    return None


# ===========================================================================
# Step 3: Amount rules (G3-01 .. G3-04)
#
# Money is handled exclusively through Decimal helpers. No float arithmetic or
# float literals appear anywhere in this module (enforced by a scan test).
# ===========================================================================


def _money_parts(money: Any) -> tuple[Decimal, str] | None:
    """Extract (value, currency) from a Money-like object, or None if unusable.

    Amounts that are not exactly a Decimal with a currency string are unusable
    and cause the caller to fail closed.
    """
    if money is None:
        return None
    raw_value = getattr(money, "value", None)
    currency = getattr(money, "currency_code", None)
    if raw_value is None or not isinstance(currency, str):
        return None
    if isinstance(raw_value, bool) or not isinstance(raw_value, (Decimal, int, str)):
        # Floats (and anything non-decimal) are never trusted for money.
        return None
    if isinstance(raw_value, Decimal):
        value = raw_value
    elif isinstance(raw_value, int):
        value = Decimal(raw_value)
    else:
        try:
            value = Decimal(raw_value)
        except ArithmeticError:
            return None
    if not value.is_finite():
        return None
    return value, currency


def _exceeds_two_decimals(value: Decimal) -> bool:
    """True when a Decimal carries more than two fractional digits."""
    exponent = value.as_tuple().exponent
    return isinstance(exponent, int) and exponent < -2


def _limit_value(limit: Any) -> Decimal | None:
    """Extract the Decimal value from a charter MoneyLimit-like object."""
    parts = _money_parts(limit)
    if parts is None:
        return None
    return parts[0]


def check_g3_01(action: Any, dispute: Dispute, charter: Any) -> RuleResult | None:
    """G3-01: NEEDS_APPROVAL when what the merchant concedes exceeds standing authority.

    Applies to money-conceding actions only. Triggers when the proposed offer is
    strictly greater than ``auto_offer_max``, or when the dispute itself is larger
    than ``auto_act_max_dispute_amount`` (the largest dispute the agent may act on
    autonomously at all). Exactly at a limit is allowed.
    """
    if getattr(action, "action_type", None) != ActionType.MAKE_OFFER:
        return None

    parts = _money_parts(getattr(action, "amount", None))
    if parts is None:
        return RuleResult(
            rule_id="G3-01",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason="Offer amount is missing or unusable; merchant approval required",
        )
    offer_value, _offer_currency = parts

    offer_max = _limit_value(getattr(charter, "auto_offer_max", None))
    if offer_max is None:
        return RuleResult(
            rule_id="G3-01",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason="Charter auto_offer_max is missing or unusable; merchant approval required",
        )
    if offer_value > offer_max:
        return RuleResult(
            rule_id="G3-01",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=f"Offer {offer_value} exceeds auto_offer_max {offer_max}",
        )

    dispute_parts = _money_parts(getattr(dispute, "dispute_amount", None))
    act_max = _limit_value(getattr(charter, "auto_act_max_dispute_amount", None))
    if dispute_parts is not None and act_max is not None and dispute_parts[0] > act_max:
        return RuleResult(
            rule_id="G3-01",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=(
                f"Dispute amount {dispute_parts[0]} exceeds "
                f"auto_act_max_dispute_amount {act_max}"
            ),
        )
    return None


def check_g3_02(action: Any, dispute: Dispute, charter: Any) -> RuleResult | None:
    """G3-02: NEEDS_APPROVAL when the accepted amount exceeds standing authority.

    A missing accept amount means accepting the full claim, so the dispute amount
    is used. Exactly at ``auto_accept_max`` is allowed; one cent above is not.
    """
    if getattr(action, "action_type", None) != ActionType.ACCEPT_CLAIM:
        return None

    parts = _money_parts(getattr(action, "amount", None))
    if parts is None:
        parts = _money_parts(getattr(dispute, "dispute_amount", None))
    if parts is None:
        return RuleResult(
            rule_id="G3-02",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason="Accept amount is missing or unusable; merchant approval required",
        )
    accept_value, _accept_currency = parts

    accept_max = _limit_value(getattr(charter, "auto_accept_max", None))
    if accept_max is None:
        return RuleResult(
            rule_id="G3-02",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason="Charter auto_accept_max is missing or unusable; merchant approval required",
        )
    if accept_value > accept_max:
        return RuleResult(
            rule_id="G3-02",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=f"Accept amount {accept_value} exceeds auto_accept_max {accept_max}",
        )

    dispute_parts = _money_parts(getattr(dispute, "dispute_amount", None))
    act_max = _limit_value(getattr(charter, "auto_act_max_dispute_amount", None))
    if dispute_parts is not None and act_max is not None and dispute_parts[0] > act_max:
        return RuleResult(
            rule_id="G3-02",
            step=3,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=(
                f"Dispute amount {dispute_parts[0]} exceeds "
                f"auto_act_max_dispute_amount {act_max}"
            ),
        )
    return None


def check_g3_03(action: Any, dispute: Dispute) -> RuleResult | None:
    """G3-03: DENY for currency mismatch, non-positive amount, or >2 decimals.

    Precision is validated *before* any comparison so that a malformed amount can
    never be silently compared against a limit.

    Note: AcceptClaim.amount=None is intentional ("accept full claim") and is NOT
    rejected here; G3-02 handles it by falling back to dispute.dispute_amount.
    """
    action_type = getattr(action, "action_type", None)
    if action_type not in MONEY_ACTIONS:
        return None

    amount = getattr(action, "amount", None)
    # AcceptClaim with no amount means "accept the full disputed amount";
    # that is a valid request handled by G3-02, not a malformed amount.
    if amount is None and action_type == ActionType.ACCEPT_CLAIM:
        return None

    parts = _money_parts(amount)
    if parts is None:
        return RuleResult(
            rule_id="G3-03",
            step=3,
            verdict=Verdict.DENY,
            reason="Amount is missing, not a decimal, or has no currency; refusing to compare",
        )
    value, currency = parts

    if _exceeds_two_decimals(value):
        return RuleResult(
            rule_id="G3-03",
            step=3,
            verdict=Verdict.DENY,
            reason=f"Amount {value} has more than two decimal places",
        )

    dispute_parts = _money_parts(getattr(dispute, "dispute_amount", None))
    if dispute_parts is None:
        return RuleResult(
            rule_id="G3-03",
            step=3,
            verdict=Verdict.DENY,
            reason="Dispute amount is unavailable; cannot validate the proposed amount",
        )
    _dispute_value, dispute_currency = dispute_parts

    if currency != dispute_currency:
        return RuleResult(
            rule_id="G3-03",
            step=3,
            verdict=Verdict.DENY,
            reason=f"Currency mismatch: action is {currency}, dispute is {dispute_currency}",
        )

    if value <= Decimal("0"):
        return RuleResult(
            rule_id="G3-03",
            step=3,
            verdict=Verdict.DENY,
            reason=f"Amount must be strictly positive, got {value}",
        )
    return None


def check_g3_04(action: Any, dispute: Dispute) -> RuleResult | None:
    """G3-04: DENY when a proposed offer exceeds the disputed amount."""
    if getattr(action, "action_type", None) != ActionType.MAKE_OFFER:
        return None

    parts = _money_parts(getattr(action, "amount", None))
    dispute_parts = _money_parts(getattr(dispute, "dispute_amount", None))
    if parts is None or dispute_parts is None:
        return RuleResult(
            rule_id="G3-04",
            step=3,
            verdict=Verdict.DENY,
            reason="Offer or dispute amount is unavailable; cannot compare",
        )

    offer_value, _offer_currency = parts
    dispute_value, _dispute_currency = dispute_parts
    if offer_value > dispute_value:
        return RuleResult(
            rule_id="G3-04",
            step=3,
            verdict=Verdict.DENY,
            reason=f"Offer {offer_value} exceeds disputed amount {dispute_value}",
        )
    return None


# ===========================================================================
# Step 4: Reason rules (G4-01, G4-02)
# ===========================================================================


def _as_plain_str(value: Any) -> str:
    """Normalize a StrEnum/enum/str into its plain string form."""
    inner = getattr(value, "value", value)
    return inner if isinstance(inner, str) else str(inner)


def _charter_list(charter: Any, attr: str) -> list[str]:
    items = getattr(charter, attr, None)
    if not isinstance(items, (list, tuple)):
        return []
    return [_as_plain_str(item) for item in items]


def check_g4_01(action: Any, dispute: Dispute, charter: Any) -> RuleResult | None:
    """G4-01: NEEDS_APPROVAL when the dispute reason is in ``never_auto_reasons``."""
    reason = getattr(dispute, "reason", None)
    if reason is None:
        return None
    reason_str = _as_plain_str(reason)
    if reason_str in _charter_list(charter, "never_auto_reasons"):
        return RuleResult(
            rule_id="G4-01",
            step=4,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=f"Dispute reason '{reason_str}' is on the never-auto list",
        )
    return None


def check_g4_02(action: Any, charter: Any) -> RuleResult | None:
    """G4-02: NEEDS_APPROVAL when the action type is in ``never_auto_actions``."""
    action_type = getattr(action, "action_type", None)
    if action_type is None:
        return None
    action_str = _as_plain_str(action_type)
    if action_str in _charter_list(charter, "never_auto_actions"):
        return RuleResult(
            rule_id="G4-02",
            step=4,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=f"Action '{action_str}' is on the never-auto list; merchant approval required",
        )
    return None


# ===========================================================================
# Step 5: History rules (G5-01, G5-02)
# ===========================================================================


def check_g5_01(action: Any, history_flags: Any, charter: Any) -> RuleResult | None:
    """G5-01: NEEDS_APPROVAL when repeat-disputer count reaches the threshold."""
    threshold = getattr(charter, "repeat_disputer_threshold", None)
    if not isinstance(threshold, int) or isinstance(threshold, bool):
        return None
    count = getattr(history_flags, "buyer_dispute_count_in_window", 0)
    if not isinstance(count, int) or isinstance(count, bool):
        return None
    if threshold >= 0 and count >= threshold:
        return RuleResult(
            rule_id="G5-01",
            step=5,
            verdict=Verdict.NEEDS_APPROVAL,
            reason=(
                f"Buyer has {count} disputes in the window, "
                f"meeting the repeat-disputer threshold {threshold}"
            ),
        )
    return None


def check_g5_02(action: Any, history_flags: Any) -> RuleResult | None:
    """G5-02: DENY when the input screener raised a content-injection flag."""
    if getattr(history_flags, "injection_flag", False) is True:
        return RuleResult(
            rule_id="G5-02",
            step=5,
            verdict=Verdict.DENY,
            reason="Content-injection flag raised by the input screener; plan ignored",
        )
    return None


# ===========================================================================
# Step 6: Idempotency rule (G6-01)
# ===========================================================================


def check_g6_01(
    action: Any,
    dispute_fingerprint: str,
    action_hash: str,
    prior_executions: Any,
) -> RuleResult | None:
    """G6-01: DENY when this action already ran against this exact fingerprint.

    Prior execution records are compared by ``(dispute, state fingerprint, action
    type)`` per the spec. A record identifies the action either by a pre-computed
    hash or by its action type. Malformed records are ignored so they cannot crash
    the gate; an empty history can never trigger this rule.
    """
    if not prior_executions:
        return None

    for record in prior_executions:
        existing_hash = getattr(record, "action_hash", None)
        if existing_hash is None and isinstance(record, dict):
            existing_hash = record.get("action_hash")

        existing_fingerprint = getattr(record, "dispute_fingerprint", None)
        if existing_fingerprint is None and isinstance(record, dict):
            existing_fingerprint = record.get("dispute_fingerprint")

        if existing_hash is not None:
            if existing_hash == action_hash and existing_fingerprint == dispute_fingerprint:
                return RuleResult(
                    rule_id="G6-01",
                    step=6,
                    verdict=Verdict.DENY,
                    reason="An execution already exists for this dispute fingerprint and action",
                )
            continue

        # Fall back to action-type comparison when only a type is recorded.
        existing_type = getattr(record, "action_type", None)
        if existing_type is None and isinstance(record, dict):
            existing_type = record.get("action_type")
        existing_type_str = None if existing_type is None else _as_plain_str(existing_type)
        action_type_str = _as_plain_str(getattr(action, "action_type", None))
        if (
            existing_type_str is not None
            and existing_type_str == action_type_str
            and existing_fingerprint == dispute_fingerprint
        ):
            return RuleResult(
                rule_id="G6-01",
                step=6,
                verdict=Verdict.DENY,
                reason="An execution already exists for this dispute fingerprint and action type",
            )
    return None
