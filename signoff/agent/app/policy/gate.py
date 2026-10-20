"""Pure Gate evaluation engine and immutable Decision model.

Per plan/03-gate-spec.md and build-plan/steps/11-gate-core.md:
- Pure function: no I/O, no system clock, no randomness.
- Same input -> same output (deterministic & replayable from ledger).
- GateDecision is frozen and can only be constructed inside policy/gate.py.
- Aggregation: DENY > NEEDS_APPROVAL > ALLOW.
- Lowest-numbered step's rule_id is recorded; all triggered rules listed in also_triggered.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from agent.app.domain.actions import compute_action_hash
from agent.app.domain.enums import Verdict
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import Dispute
from agent.app.policy.rules import (
    RULE_REGISTRY,
    RuleResult,
    check_g0_00,
    check_g1_01,
    check_g1_02,
    check_g2_01,
    check_g2_02,
    check_g3_01,
    check_g3_02,
    check_g3_03,
    check_g3_04,
    check_g4_01,
    check_g4_02,
    check_g5_01,
    check_g5_02,
    check_g6_01,
)

# Private sentinel token to ensure GateDecision is ONLY instantiated inside gate.py
_GATE_FACTORY_KEY = object()


@dataclass(frozen=True, slots=True)
class GateDecision:
    """Immutable decision artifact produced by the gate.

    Cannot be constructed directly outside policy/gate.py.
    """

    verdict: Verdict
    rule_id: str
    reason: str
    action_hash: str
    dispute_fingerprint: str
    charter_version: int
    also_triggered: tuple[str, ...] = ()

    def __init__(
        self,
        *,
        verdict: Verdict,
        rule_id: str,
        reason: str,
        action_hash: str,
        dispute_fingerprint: str,
        charter_version: int,
        also_triggered: Sequence[str] = (),
        _factory_key: object = None,
    ) -> None:
        if _factory_key is not _GATE_FACTORY_KEY:
            raise PermissionError("GateDecision can only be constructed inside policy/gate.py")
        object.__setattr__(self, "verdict", verdict)
        object.__setattr__(self, "rule_id", rule_id)
        object.__setattr__(self, "reason", reason)
        object.__setattr__(self, "action_hash", action_hash)
        object.__setattr__(self, "dispute_fingerprint", dispute_fingerprint)
        object.__setattr__(self, "charter_version", charter_version)
        object.__setattr__(self, "also_triggered", tuple(also_triggered))

    def to_dict(self) -> dict[str, Any]:
        """Convert decision to a JSON-serializable dictionary."""
        return {
            "verdict": self.verdict.value if isinstance(self.verdict, Enum) else str(self.verdict),
            "rule_id": self.rule_id,
            "reason": self.reason,
            "action_hash": self.action_hash,
            "dispute_fingerprint": self.dispute_fingerprint,
            "charter_version": self.charter_version,
            "also_triggered": list(self.also_triggered),
        }


@dataclass(frozen=True, slots=True)
class HistoryFlags:
    """Buyer and fraud signals passed into gate evaluation."""

    buyer_dispute_count_in_window: int = 0
    injection_flag: bool = False


@dataclass(frozen=True, slots=True)
class GateInput:
    """Gate evaluation input bundle.

    Per plan/03-gate-spec.md:
    GateInput = { action, dispute, charter, history flags, now, prior_executions }

    ``prior_executions`` carries already-executed actions for this dispute. Each
    record identifies the action either by ``action_hash`` (preferred) or by
    ``action_type``, alongside the ``dispute_fingerprint`` it ran against. It is
    read-only data supplied by the caller; the gate never fetches it.
    """

    action: Any
    dispute: Dispute
    charter: Any
    now: datetime
    history_flags: HistoryFlags = HistoryFlags()
    prior_executions: tuple[Any, ...] = ()


def _aggregate(triggered: Sequence[RuleResult]) -> tuple[Verdict, str, str, tuple[str, ...]]:
    """Collapse all triggered rules into (verdict, rule_id, reason, also_triggered).

    DENY outranks NEEDS_APPROVAL, and within a verdict the lowest step wins.
    One deliberate exception: an injection flag (G5-02) is always recorded as the
    primary rule when present. The dispute is not being handled by the agent at
    all, so surfacing the injection -- rather than whichever step-3 amount rule
    also happened to fire -- is what the operator needs to see.
    """
    deny_rules = sorted(
        (r for r in triggered if r.verdict == Verdict.DENY),
        key=lambda r: (r.step, r.rule_id),
    )
    needs_approval_rules = sorted(
        (r for r in triggered if r.verdict == Verdict.NEEDS_APPROVAL),
        key=lambda r: (r.step, r.rule_id),
    )

    injection_rules = [r for r in deny_rules if r.rule_id == "G5-02"]
    if injection_rules:
        primary = injection_rules[0]
        verdict = Verdict.DENY
    elif deny_rules:
        primary = deny_rules[0]
        verdict = Verdict.DENY
    elif needs_approval_rules:
        primary = needs_approval_rules[0]
        verdict = Verdict.NEEDS_APPROVAL
    else:
        allow_rule = RULE_REGISTRY["G7-01"]
        return Verdict.ALLOW, allow_rule.rule_id, allow_rule.description, ()

    others = sorted(
        (r for r in triggered if r.rule_id != primary.rule_id),
        key=lambda r: (r.step, r.rule_id),
    )
    return verdict, primary.rule_id, primary.reason, tuple(r.rule_id for r in others)


def evaluate_gate(gate_input: GateInput) -> GateDecision:
    """Evaluate pure gate policy rules on input without I/O or system clock.

    Aggregates rule outcomes:
    1. If any DENY triggered: verdict is DENY, primary rule is lowest step.
    2. Else if any NEEDS_APPROVAL: verdict is NEEDS_APPROVAL, primary is lowest step.
    3. Else: ALLOW (rule G7-01).
    All additional triggered rules are captured deterministically in also_triggered.
    """
    if gate_input.now.tzinfo is None:
        raise ValueError("Timezone-naive now is rejected; must be timezone-aware UTC")

    action = gate_input.action
    dispute = gate_input.dispute
    charter = gate_input.charter
    history_flags = gate_input.history_flags

    # Identity is computed once and reused for idempotency and the decision record.
    action_hash = compute_action_hash(action)
    dispute_fingerprint = str(compute_dispute_fingerprint(dispute))

    # Evaluate every check; aggregation decides the verdict afterwards.
    triggered: list[RuleResult] = []

    # G0-00: Fail-closed on unknown action type
    r0 = check_g0_00(action)
    if r0 is not None:
        triggered.append(r0)

    # G1-01: PayPal options / links presence
    r1_01 = check_g1_01(action, dispute)
    if r1_01 is not None:
        triggered.append(r1_01)

    # G1-02: Offer type / claim type valid
    r1_02 = check_g1_02(action, dispute)
    if r1_02 is not None:
        triggered.append(r1_02)

    # G2-01: Dispute status WAITING_FOR_SELLER_RESPONSE
    r2_01 = check_g2_01(action, dispute)
    if r2_01 is not None:
        triggered.append(r2_01)

    # G2-02: seller_response_due_date passed
    r2_02 = check_g2_02(action, dispute, gate_input.now)
    if r2_02 is not None:
        triggered.append(r2_02)

    # G3-03 / G3-04 run before G3-01 / G3-02 so a malformed or oversized amount is
    # DENYed before any limit comparison. Triggered rules are reported in step order.
    for deny_amount_check in (
        check_g3_03(action, dispute),
        check_g3_04(action, dispute),
    ):
        if deny_amount_check is not None:
            triggered.append(deny_amount_check)

    for approval_amount_check in (
        check_g3_01(action, dispute, charter),
        check_g3_02(action, dispute, charter),
    ):
        if approval_amount_check is not None:
            triggered.append(approval_amount_check)

    # G4-01 / G4-02: reason and never-auto action lists
    r4_01 = check_g4_01(action, dispute, charter)
    if r4_01 is not None:
        triggered.append(r4_01)

    r4_02 = check_g4_02(action, charter)
    if r4_02 is not None:
        triggered.append(r4_02)

    # G5-01 / G5-02: repeat-disputer threshold and injection flag
    r5_01 = check_g5_01(action, history_flags, charter)
    if r5_01 is not None:
        triggered.append(r5_01)

    r5_02 = check_g5_02(action, history_flags)
    if r5_02 is not None:
        triggered.append(r5_02)

    # G6-01: idempotency against actions already executed for this fingerprint
    r6_01 = check_g6_01(action, dispute_fingerprint, action_hash, gate_input.prior_executions)
    if r6_01 is not None:
        triggered.append(r6_01)

    verdict, rule_id, reason, also_triggered = _aggregate(triggered)
    charter_version = getattr(charter, "version", 1)

    return GateDecision(
        verdict=verdict,
        rule_id=rule_id,
        reason=reason,
        action_hash=action_hash,
        dispute_fingerprint=dispute_fingerprint,
        charter_version=charter_version,
        also_triggered=also_triggered,
        _factory_key=_GATE_FACTORY_KEY,
    )


def reconstruct_decision(
    *,
    verdict: Verdict,
    rule_id: str,
    reason: str,
    action_hash: str,
    dispute_fingerprint: str,
    charter_version: int,
    also_triggered: Sequence[str] = (),
) -> GateDecision:
    """Reconstruct a GateDecision from stored DB fields.

    Use this in the approval service to rebuild a decision from persisted columns
    without resorting to __globals__ introspection.  Lives here so the factory key
    stays inside gate.py.
    """
    return GateDecision(
        verdict=verdict,
        rule_id=rule_id,
        reason=reason,
        action_hash=action_hash,
        dispute_fingerprint=dispute_fingerprint,
        charter_version=charter_version,
        also_triggered=tuple(also_triggered),
        _factory_key=_GATE_FACTORY_KEY,
    )


def approved_decision(decision: GateDecision, *, merchant_id: str = "default") -> GateDecision:
    """Build the ALLOW / A-01 decision recorded when a merchant approves a proposal.

    This is a constructor confined to ``policy/gate.py`` (same reason GateDecision
    is): the executor only ever receives decisions born here. Whether an approval
    is *allowed* to waive a verdict is decided by ``policy/approval.py``.
    """
    approval_rule = RULE_REGISTRY["A-01"]
    reason = f"{approval_rule.description} ({merchant_id})"

    triggered_chain: list[str] = []
    if decision.rule_id != approval_rule.rule_id:
        triggered_chain.append(decision.rule_id)
    triggered_chain.extend(r for r in decision.also_triggered if r != approval_rule.rule_id)

    return GateDecision(
        verdict=Verdict.ALLOW,
        rule_id=approval_rule.rule_id,
        reason=reason,
        action_hash=decision.action_hash,
        dispute_fingerprint=decision.dispute_fingerprint,
        charter_version=decision.charter_version,
        also_triggered=tuple(dict.fromkeys(triggered_chain)),
        _factory_key=_GATE_FACTORY_KEY,
    )
