"""Merchant approval waiver.

Per plan/03-gate-spec.md and ADR-007, a merchant approval may waive **charter
steps only** (steps 3-5: amount, reason, history). It must never waive:

- step 1 (PayPal does not permit the action),
- step 2 (wrong dispute state or deadline passed), or
- step 6 (the action is already executed for this fingerprint).

Modelling this as its own pure function (rather than a flag on the gate) keeps
the "one door" rule intact and makes the waiver boundary directly testable.
"""

from agent.app.domain.enums import Verdict
from agent.app.policy.gate import GateDecision, approved_decision
from agent.app.policy.rules import RULE_REGISTRY, WAIVABLE_STEPS


def is_waivable(decision: GateDecision) -> bool:
    """Return True when every rule behind this verdict is a charter step (3-5).

    A DENY is never waivable. For ``NEEDS_APPROVAL``, the primary rule *and* every
    rule listed in ``also_triggered`` must be a waivable step, otherwise the
    approval is ignored (fail closed).
    """
    if decision.verdict == Verdict.DENY:
        return False

    rule_ids = (decision.rule_id, *decision.also_triggered)
    for rule_id in rule_ids:
        definition = RULE_REGISTRY.get(rule_id)
        if definition is None:
            # Unknown rule id: fail closed, refuse to waive.
            return False
        if definition.step not in WAIVABLE_STEPS:
            return False
    return True


def waive_with_approval(decision: GateDecision, *, merchant_id: str = "default") -> GateDecision | None:
    """Return the ALLOW / A-01 decision for an approved proposal, or None.

    ``None`` means the approval is ignored: the merchant cannot override a PayPal
    state or idempotency denial. The caller records the original DENY either way.
    """
    if not is_waivable(decision):
        return None
    return approved_decision(decision, merchant_id=merchant_id)
