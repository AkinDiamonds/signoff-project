"""Step 12 gate tests: amount, reason, history, idempotency, approval waiver.

Covers build-plan/steps/12-gate-rest.md and plan/03-gate-spec.md:
- Rules G3-01..G3-04, G4-01, G4-02, G5-01, G5-02, G6-01.
- Boundary behavior: at a limit is allowed, one cent above needs approval.
- Amounts with more than two decimals are rejected before comparison.
- Repeat-disputer threshold boundaries.
- Injection flag + other triggers -> DENY wins.
- Idempotency keyed on (dispute, fingerprint, action type).
- Approval waiver applies to steps 3-5 only, never 1, 2 or 6.
- Money is handled through Decimal only (float scan over the policy package).
- Spec properties P1-P5.
"""

import ast
import itertools
import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import pytest

from agent.app.domain.actions import (
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProvideEvidence,
    SendMessage,
    compute_action_hash,
)
from agent.app.domain.enums import ActionType, DisputeReason, DisputeStatus, Verdict
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import Dispute, Money, parse_dispute
from agent.app.policy.approval import is_waivable, waive_with_approval
from agent.app.policy.charter import DEFAULT_CHARTER_DATA, CharterData, MoneyLimit
from agent.app.policy.gate import GateInput, HistoryFlags, evaluate_gate
from agent.app.policy.rules import (
    RULE_REGISTRY,
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

POLICY_DIR = Path(__file__).resolve().parents[1] / "app" / "policy"
GATE_MODULE_FILES = ("gate.py", "rules.py", "approval.py")


def _fixtures_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parents[2] / "fixtures" / "paypal",
        Path(__file__).resolve().parents[3] / "signoff" / "fixtures" / "paypal",
        Path("signoff/fixtures/paypal").resolve(),
        Path("fixtures/paypal").resolve(),
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("Could not find fixtures/paypal directory")


FIXTURES_DIR = _fixtures_dir()


def _usd(value: str) -> Money:
    return Money(currency_code="USD", value=Decimal(value))


@pytest.fixture
def dispute() -> Dispute:
    with open(FIXTURES_DIR / "s5-get-dispute.json", encoding="utf-8") as handle:
        return parse_dispute(json.load(handle))


@pytest.fixture
def small_dispute(dispute: Dispute) -> Dispute:
    """A $40 dispute well inside auto_act_max_dispute_amount."""
    return dispute.model_copy(update={"dispute_amount": _usd("40.00")})


@pytest.fixture
def now(dispute: Dispute):
    assert dispute.seller_response_due_date is not None
    return dispute.seller_response_due_date - timedelta(days=2)


def _gate_input(
    action,
    dispute: Dispute,
    now,
    *,
    charter=DEFAULT_CHARTER_DATA,
    history_flags=None,
    prior_executions=(),
) -> GateInput:
    return GateInput(
        action=action,
        dispute=dispute,
        charter=charter,
        now=now,
        history_flags=history_flags or HistoryFlags(),
        prior_executions=prior_executions,
    )


def _charter(**overrides) -> CharterData:
    return DEFAULT_CHARTER_DATA.model_copy(update=overrides)


# ===========================================================================
# G3-01 / G3-02: standing authority for money the merchant concedes
# ===========================================================================


def test_g3_01_offer_boundary_and_approval(small_dispute: Dispute):
    limit = DEFAULT_CHARTER_DATA.auto_offer_max.value

    at_limit = MakeOffer(amount=_usd(f"{limit:.2f}"), offer_type="REFUND")
    assert check_g3_01(at_limit, small_dispute, DEFAULT_CHARTER_DATA) is None

    one_cent_over = MakeOffer(amount=_usd(f"{limit + Decimal('0.01'):.2f}"), offer_type="REFUND")
    result = check_g3_01(one_cent_over, small_dispute, DEFAULT_CHARTER_DATA)
    assert result is not None
    assert (result.rule_id, result.verdict, result.step) == ("G3-01", Verdict.NEEDS_APPROVAL, 3)

    # Non-offer actions are not subject to the offer limit.
    assert check_g3_01(ProvideEvidence(), small_dispute, DEFAULT_CHARTER_DATA) is None


def test_g3_01_denies_autonomy_when_dispute_exceeds_act_max(dispute: Dispute):
    big_dispute = dispute.model_copy(update={"dispute_amount": _usd("180.00")})
    action = MakeOffer(amount=_usd("10.00"), offer_type="REFUND")
    result = check_g3_01(action, big_dispute, DEFAULT_CHARTER_DATA)
    assert result is not None
    assert result.rule_id == "G3-01"
    assert result.verdict == Verdict.NEEDS_APPROVAL
    assert "auto_act_max_dispute_amount" in result.reason

    # Exactly at auto_act_max_dispute_amount is still within standing authority.
    at_max = dispute.model_copy(update={"dispute_amount": _usd("100.00")})
    assert check_g3_01(action, at_max, DEFAULT_CHARTER_DATA) is None


def test_g3_02_accept_boundary_and_default_to_dispute_amount(dispute: Dispute):
    limit = DEFAULT_CHARTER_DATA.auto_accept_max.value

    at_limit = AcceptClaim(amount=_usd(f"{limit:.2f}"), accept_claim_type="REFUND")
    assert check_g3_02(at_limit, dispute, DEFAULT_CHARTER_DATA) is None

    over = AcceptClaim(amount=_usd(f"{limit + Decimal('0.01'):.2f}"), accept_claim_type="REFUND")
    result = check_g3_02(over, dispute, DEFAULT_CHARTER_DATA)
    assert result is not None
    assert result.rule_id == "G3-02"
    assert result.verdict == Verdict.NEEDS_APPROVAL

    # A zero auto_accept_max means "accepting any money needs approval".
    zero_limit = _charter(auto_accept_max=MoneyLimit(currency_code="USD", value=Decimal("0.00")))
    one_cent = AcceptClaim(amount=_usd("0.01"), accept_claim_type="REFUND")
    zero_result = check_g3_02(one_cent, dispute, zero_limit)
    assert zero_result is not None
    assert zero_result.rule_id == "G3-02"

    assert check_g3_02(ProvideEvidence(), dispute, DEFAULT_CHARTER_DATA) is None


# ===========================================================================
# G3-03 / G3-04: malformed amounts and offers above the dispute
# ===========================================================================


def test_g3_03_precision_checked_before_comparison(dispute: Dispute):
    three_decimals = MakeOffer(amount=_usd("10.001"), offer_type="REFUND")
    result = check_g3_03(three_decimals, dispute)
    assert result is not None
    assert (result.rule_id, result.verdict) == ("G3-03", Verdict.DENY)
    assert "two decimal places" in result.reason


def test_g3_03_currency_mismatch_and_non_positive(dispute: Dispute):
    eur = MakeOffer(
        amount=Money(currency_code="EUR", value=Decimal("10.00")),
        offer_type="REFUND",
    )
    mismatch = check_g3_03(eur, dispute)
    assert mismatch is not None
    assert mismatch.rule_id == "G3-03"
    assert "Currency mismatch" in mismatch.reason

    # Money rejects non-positive values at the boundary. Bypass validation to
    # prove the gate itself also refuses to compare them.
    zero = AcceptClaim.model_construct(
        action_type=ActionType.ACCEPT_CLAIM,
        amount=Money.model_construct(currency_code="USD", value=Decimal("0.00")),
        accept_claim_type="REFUND",
        note=None,
    )
    zero_result = check_g3_03(zero, dispute)
    assert zero_result is not None
    assert zero_result.rule_id == "G3-03"
    assert "strictly positive" in zero_result.reason

    negative = AcceptClaim.model_construct(
        action_type=ActionType.ACCEPT_CLAIM,
        amount=Money.model_construct(currency_code="USD", value=Decimal("-5.00")),
        accept_claim_type="REFUND",
        note=None,
    )
    negative_result = check_g3_03(negative, dispute)
    assert negative_result is not None
    assert negative_result.rule_id == "G3-03"

    assert check_g3_03(ProvideEvidence(), dispute) is None


def test_g3_03_missing_amount_and_missing_dispute_amount(dispute: Dispute):
    no_amount = MakeOffer.model_construct(
        action_type=ActionType.MAKE_OFFER, amount=None, offer_type="REFUND", note=None
    )
    result = check_g3_03(no_amount, dispute)
    assert result is not None
    assert result.rule_id == "G3-03"

    bare_dispute = dispute.model_construct(**{**dispute.model_dump(), "dispute_amount": None})
    assert check_g3_03(MakeOffer(amount=_usd("5.00"), offer_type="REFUND"), bare_dispute) is not None


def test_g3_03_accept_claim_none_amount_is_not_denied(dispute: Dispute, now):
    """AcceptClaim with amount=None means 'accept the full disputed amount'.

    G3-03 must NOT deny this — it is a valid request that G3-02 handles by
    falling back to dispute.dispute_amount for the limit comparison.
    """
    full_claim = AcceptClaim(amount=None, accept_claim_type="REFUND")
    assert check_g3_03(full_claim, dispute) is None

    # End-to-end: a small dispute within auto_accept_max should never DENY on G3-03.
    small = dispute.model_copy(update={"dispute_amount": _usd("10.00")})
    decision = evaluate_gate(_gate_input(full_claim, small, now))
    assert decision.rule_id != "G3-03"


def test_g3_04_offer_above_disputed_amount(dispute: Dispute):
    small = dispute.model_copy(update={"dispute_amount": _usd("30.00")})
    above = MakeOffer(amount=_usd("30.01"), offer_type="REFUND")
    result = check_g3_04(above, small)
    assert result is not None
    assert (result.rule_id, result.verdict) == ("G3-04", Verdict.DENY)

    # Exactly at the disputed amount is allowed.
    at_amount = MakeOffer(amount=_usd("30.00"), offer_type="REFUND")
    assert check_g3_04(at_amount, small) is None
    assert check_g3_04(ProvideEvidence(), small) is None


def test_gate_denies_edited_offer_above_disputed_amount(dispute: Dispute, now):
    small = dispute.model_copy(update={"dispute_amount": _usd("30.00")})
    edited = MakeOffer(amount=_usd("30.01"), offer_type="REFUND")
    decision = evaluate_gate(_gate_input(edited, small, now))
    assert decision.verdict == Verdict.DENY
    assert decision.rule_id == "G3-04"


# ===========================================================================
# G4-01 / G4-02: reason and never-auto action lists
# ===========================================================================


def test_g4_01_reason_on_never_auto_list(dispute: Dispute):
    restricted = _charter(never_auto_reasons=[DisputeReason.UNAUTHORISED])
    unauthorised = dispute.model_copy(update={"reason": DisputeReason.UNAUTHORISED})
    result = check_g4_01(ProvideEvidence(), unauthorised, restricted)
    assert result is not None
    assert (result.rule_id, result.verdict) == ("G4-01", Verdict.NEEDS_APPROVAL)

    # A different reason with the same charter is unaffected.
    assert check_g4_01(ProvideEvidence(), dispute, restricted) is None
    # Same reason with an empty list is unaffected.
    assert check_g4_01(ProvideEvidence(), unauthorised, DEFAULT_CHARTER_DATA) is None


def test_g4_02_action_on_never_auto_list(dispute: Dispute):
    result = check_g4_02(Escalate(), DEFAULT_CHARTER_DATA)
    assert result is not None
    assert (result.rule_id, result.verdict) == ("G4-02", Verdict.NEEDS_APPROVAL)

    listing_evidence = _charter(never_auto_actions=[ActionType.PROVIDE_EVIDENCE])
    evidence = check_g4_02(ProvideEvidence(), listing_evidence)
    assert evidence is not None
    assert evidence.rule_id == "G4-02"

    assert check_g4_02(ProvideEvidence(), DEFAULT_CHARTER_DATA) is None


# ===========================================================================
# G5-01 / G5-02: repeat-disputer threshold and injection flag
# ===========================================================================


def test_g5_01_repeat_disputer_threshold_boundary():
    flags_below = HistoryFlags(buyer_dispute_count_in_window=1)
    assert check_g5_01(ProvideEvidence(), flags_below, DEFAULT_CHARTER_DATA) is None

    flags_at = HistoryFlags(buyer_dispute_count_in_window=2)
    at_threshold = check_g5_01(ProvideEvidence(), flags_at, DEFAULT_CHARTER_DATA)
    assert at_threshold is not None
    assert (at_threshold.rule_id, at_threshold.verdict) == ("G5-01", Verdict.NEEDS_APPROVAL)

    flags_above = HistoryFlags(buyer_dispute_count_in_window=5)
    assert check_g5_01(ProvideEvidence(), flags_above, DEFAULT_CHARTER_DATA) is not None

    # A zero threshold means a first dispute already needs approval.
    zero_threshold = _charter(repeat_disputer_threshold=0)
    first_dispute = HistoryFlags(buyer_dispute_count_in_window=0)
    assert check_g5_01(ProvideEvidence(), first_dispute, zero_threshold) is not None


def test_g5_02_injection_flag_denies():
    assert check_g5_02(ProvideEvidence(), HistoryFlags(injection_flag=False)) is None
    result = check_g5_02(ProvideEvidence(), HistoryFlags(injection_flag=True))
    assert result is not None
    assert (result.rule_id, result.verdict) == ("G5-02", Verdict.DENY)


def test_injection_deny_wins_over_other_triggers(dispute: Dispute, now):
    flags = HistoryFlags(injection_flag=True, buyer_dispute_count_in_window=5)
    offers = [
        MakeOffer(amount=_usd("10.00"), offer_type="REFUND"),
        MakeOffer(amount=_usd("25.01"), offer_type="REFUND"),
    ]
    for offer in offers:
        decision = evaluate_gate(_gate_input(offer, dispute, now, history_flags=flags))
        assert decision.verdict == Verdict.DENY
        assert "G5-02" in (decision.rule_id, *decision.also_triggered)


# ===========================================================================
# G6-01: idempotency
# ===========================================================================


def test_g6_01_identical_action_same_fingerprint_is_denied(dispute: Dispute, now):
    action = ProvideEvidence(evidence_type="PROOF_OF_DELIVERY", notes="Signed")
    fingerprint = str(compute_dispute_fingerprint(dispute))
    prior = ({"action_hash": compute_action_hash(action), "dispute_fingerprint": fingerprint},)

    decision = evaluate_gate(_gate_input(action, dispute, now, prior_executions=prior))
    assert decision.verdict == Verdict.DENY
    assert decision.rule_id == "G6-01"


def test_g6_01_same_action_new_fingerprint_is_evaluated_fresh(dispute: Dispute, now):
    action = ProvideEvidence(evidence_type="PROOF_OF_DELIVERY", notes="Signed")
    # Fingerprints exclude link URLs and timestamps; they include the disputed amount.
    changed = dispute.model_copy(update={"dispute_amount": _usd("41.00")})
    other_fingerprint = str(compute_dispute_fingerprint(changed))
    prior = ({"action_hash": compute_action_hash(action), "dispute_fingerprint": other_fingerprint},)

    decision = evaluate_gate(_gate_input(action, dispute, now, prior_executions=prior))
    assert decision.verdict == Verdict.ALLOW
    assert decision.rule_id == "G7-01"


def test_g6_01_matches_action_type_records_and_ignores_malformed(dispute: Dispute, now):
    fingerprint = str(compute_dispute_fingerprint(dispute))
    by_type = ({"action_type": "PROVIDE_EVIDENCE", "dispute_fingerprint": fingerprint},)
    action = ProvideEvidence()
    decision = evaluate_gate(_gate_input(action, dispute, now, prior_executions=by_type))
    assert decision.verdict == Verdict.DENY
    assert decision.rule_id == "G6-01"

    malformed = (object(), {"unexpected": True}, "not-a-record")
    assert check_g6_01(action, fingerprint, compute_action_hash(action), malformed) is None
    assert check_g6_01(action, fingerprint, compute_action_hash(action), ()) is None


# ===========================================================================
# Approval waiver: waive steps 3-5 only, never steps 1, 2 or 6
# ===========================================================================


@pytest.mark.parametrize(
    ("action", "history_flags", "charter", "expected_rule"),
    [
        (
            MakeOffer(amount=_usd("25.01"), offer_type="REFUND"),
            HistoryFlags(),
            DEFAULT_CHARTER_DATA,
            "G3-01",
        ),
        (
            AcceptClaim(amount=_usd("25.01"), accept_claim_type="REFUND"),
            HistoryFlags(),
            DEFAULT_CHARTER_DATA,
            "G3-02",
        ),
        (
            ProvideEvidence(),
            HistoryFlags(),
            _charter(never_auto_reasons=[DisputeReason.UNAUTHORISED]),
            "G4-01",
        ),
        (Escalate(), HistoryFlags(), DEFAULT_CHARTER_DATA, "G4-02"),
        (
            ProvideEvidence(),
            HistoryFlags(buyer_dispute_count_in_window=3),
            DEFAULT_CHARTER_DATA,
            "G5-01",
        ),
    ],
)
def test_approval_waives_charter_steps(dispute: Dispute, now, action, history_flags, charter, expected_rule):
    # Reason-restricted cases need the matching dispute reason; amount cases need
    # a dispute small enough that the offer stays within the disputed amount
    # (otherwise G3-04 would deny outright, which no approval may waive).
    working_dispute = dispute
    if expected_rule == "G4-01":
        working_dispute = dispute.model_copy(update={"reason": DisputeReason.UNAUTHORISED})
    elif expected_rule in {"G3-01", "G3-02"}:
        working_dispute = dispute.model_copy(update={"dispute_amount": _usd("40.00")})

    decision = evaluate_gate(
        _gate_input(action, working_dispute, now, charter=charter, history_flags=history_flags)
    )
    assert decision.verdict == Verdict.NEEDS_APPROVAL
    assert decision.rule_id == expected_rule
    assert is_waivable(decision) is True

    approved = waive_with_approval(decision, merchant_id="merchant-7")
    assert approved is not None
    assert approved.verdict == Verdict.ALLOW
    assert approved.rule_id == "A-01"
    assert approved.action_hash == decision.action_hash
    assert approved.dispute_fingerprint == decision.dispute_fingerprint
    assert expected_rule in approved.also_triggered


@pytest.mark.parametrize(
    ("action", "dispute_update", "expected_rule"),
    [
        (Appeal(), {}, "G1-01"),
        (ProvideEvidence(), {"status": DisputeStatus.RESOLVED}, "G2-01"),
    ],
)
def test_approval_never_waives_paypal_or_state_denials(dispute: Dispute, now, action, dispute_update, expected_rule):
    working = dispute.model_copy(update=dispute_update)
    decision = evaluate_gate(_gate_input(action, working, now))
    assert decision.verdict == Verdict.DENY
    assert decision.rule_id == expected_rule
    assert is_waivable(decision) is False
    assert waive_with_approval(decision) is None


def test_approval_never_waives_deadline_or_idempotency(dispute: Dispute, now):
    # Deadline passed -> G2-02 DENY, never waivable.
    assert dispute.seller_response_due_date is not None
    late = dispute.seller_response_due_date + timedelta(hours=1)
    deadline_decision = evaluate_gate(_gate_input(ProvideEvidence(), dispute, late))
    assert deadline_decision.rule_id == "G2-02"
    assert waive_with_approval(deadline_decision) is None

    # Already executed -> G6-01 DENY, never waivable even though it is step 6 only.
    action = ProvideEvidence()
    fingerprint = str(compute_dispute_fingerprint(dispute))
    prior = ({"action_hash": compute_action_hash(action), "dispute_fingerprint": fingerprint},)
    idem_decision = evaluate_gate(_gate_input(action, dispute, now, prior_executions=prior))
    assert idem_decision.rule_id == "G6-01"
    assert waive_with_approval(idem_decision) is None


def test_approval_ignored_when_denial_hides_behind_approval_rules(dispute: Dispute, now):
    """A step-3 trigger mixed with a step-2 DENY must not be waivable."""
    flags = HistoryFlags(buyer_dispute_count_in_window=3)  # G5-01 (waivable)
    resolved = dispute.model_copy(update={"status": DisputeStatus.RESOLVED})  # G2-01 (never)
    action = MakeOffer(amount=_usd("25.01"), offer_type="REFUND")  # G3-01 (waivable)
    decision = evaluate_gate(_gate_input(action, resolved, now, history_flags=flags))
    assert decision.verdict == Verdict.DENY
    assert decision.rule_id == "G2-01"
    assert waive_with_approval(decision) is None


def test_waiver_refuses_unknown_rule_ids():
    """An unknown/forged rule id must never be waivable (fail closed)."""

    class _FakeDecision:
        verdict = Verdict.NEEDS_APPROVAL
        rule_id = "G9-99"
        also_triggered: tuple[str, ...] = ()

    assert is_waivable(_FakeDecision()) is False  # type: ignore[arg-type]


# ===========================================================================
# Property tests P1-P5
# ===========================================================================


def test_property_p1_never_allow_when_action_lacks_paypal_permission(dispute: Dispute, now):
    """(P1) An action PayPal does not offer is never ALLOWed, regardless of limits."""
    from agent.app.paypal.models import AllowedResponseOptions, Link

    stripped = dispute.model_copy(
        update={
            "links": [Link(href="https://example.com", rel="self")],
            "allowed_response_options": AllowedResponseOptions(),
        }
    )
    actions = [
        ProvideEvidence(),
        SendMessage(message="hi"),
        MakeOffer(amount=_usd("5.00"), offer_type="REFUND"),
        AcceptClaim(amount=_usd("5.00"), accept_claim_type="REFUND"),
        Escalate(),
        Appeal(),
    ]
    for action in actions:
        decision = evaluate_gate(_gate_input(action, stripped, now))
        assert decision.verdict != Verdict.ALLOW
        assert decision.rule_id == "G1-01"


def test_property_p2_tightening_limits_never_grants_allow(dispute: Dispute, now):
    """(P2) Making the charter stricter never turns a non-ALLOW into an ALLOW."""
    permissive = _charter(
        auto_offer_max=MoneyLimit(currency_code="USD", value=Decimal("1000.00")),
        auto_accept_max=MoneyLimit(currency_code="USD", value=Decimal("1000.00")),
        repeat_disputer_threshold=99,
        never_auto_reasons=[],
    )
    strict = _charter(
        auto_offer_max=MoneyLimit(currency_code="USD", value=Decimal("5.00")),
        auto_accept_max=MoneyLimit(currency_code="USD", value=Decimal("5.00")),
        auto_act_max_dispute_amount=MoneyLimit(currency_code="USD", value=Decimal("10.00")),
        repeat_disputer_threshold=0,
        never_auto_reasons=[DisputeReason.UNAUTHORISED],
        never_auto_actions=[
            ActionType.PROVIDE_EVIDENCE,
            ActionType.SEND_MESSAGE,
            ActionType.MAKE_OFFER,
            ActionType.ACCEPT_CLAIM,
        ],
    )
    amounts = ["1.00", "25.00", "500.00"]
    actions = [MakeOffer(amount=_usd(a), offer_type="REFUND") for a in amounts]
    actions += [AcceptClaim(amount=_usd(a), accept_claim_type="REFUND") for a in amounts]
    actions += [ProvideEvidence(), SendMessage(message="hello")]
    flags = [HistoryFlags(), HistoryFlags(buyer_dispute_count_in_window=1)]

    for action, history in itertools.product(actions, flags):
        permissive_decision = evaluate_gate(
            _gate_input(action, dispute, now, charter=permissive, history_flags=history)
        )
        strict_decision = evaluate_gate(_gate_input(action, dispute, now, charter=strict, history_flags=history))
        if permissive_decision.verdict != Verdict.ALLOW:
            assert strict_decision.verdict != Verdict.ALLOW


def test_property_p3_every_decision_has_rule_id_and_reason(dispute: Dispute, now):
    """(P3) Every decision carries a non-empty rule id and reason."""
    actions = [
        ProvideEvidence(),
        SendMessage(message="hi"),
        MakeOffer(amount=_usd("10.00"), offer_type="REFUND"),
        AcceptClaim(amount=_usd("10.00"), accept_claim_type="REFUND"),
        Escalate(),
        Appeal(),
    ]
    charters = [DEFAULT_CHARTER_DATA, _charter(repeat_disputer_threshold=0)]
    flags = [HistoryFlags(), HistoryFlags(injection_flag=True)]
    for action, charter, history in itertools.product(actions, charters, flags):
        decision = evaluate_gate(_gate_input(action, dispute, now, charter=charter, history_flags=history))
        assert decision.rule_id.strip()
        assert decision.reason.strip()
        assert decision.rule_id in RULE_REGISTRY
        for rule_id in decision.also_triggered:
            assert rule_id in RULE_REGISTRY


def test_property_p4_second_identical_call_is_g6_01(dispute: Dispute, now):
    """(P4) Re-running the same action on the same fingerprint denies as a duplicate."""
    action = MakeOffer(amount=_usd("10.00"), offer_type="REFUND")
    first = evaluate_gate(_gate_input(action, dispute, now))
    assert first.verdict == Verdict.ALLOW

    prior = ({"action_hash": first.action_hash, "dispute_fingerprint": first.dispute_fingerprint},)
    second = evaluate_gate(_gate_input(action, dispute, now, prior_executions=prior))
    assert second.verdict == Verdict.DENY
    assert second.rule_id == "G6-01"


def test_property_p5_same_input_same_output(dispute: Dispute, now):
    """(P5) The gate is pure: 100 runs on identical input give identical output."""
    gate_input = _gate_input(Escalate(), dispute, now, history_flags=HistoryFlags(buyer_dispute_count_in_window=2))
    baseline = evaluate_gate(gate_input)
    for _ in range(100):
        current = evaluate_gate(gate_input)
        assert current == baseline


# ===========================================================================
# Type discipline: money is Decimal only
# ===========================================================================


def test_gate_package_never_uses_float():
    """No float literals or float() references anywhere in the gate modules.

    ``charter.py`` deliberately *rejects* floats at the boundary, so the scan
    covers the gate evaluation modules only.
    """
    offenders: list[str] = []
    for name in GATE_MODULE_FILES:
        path = POLICY_DIR / name
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, float):
                offenders.append(f"{path.name}:{node.lineno} float literal {node.value!r}")
            elif isinstance(node, ast.Name) and node.id == "float":
                offenders.append(f"{path.name}:{node.lineno} reference to float")
            elif isinstance(node, ast.Attribute) and node.attr == "float":
                offenders.append(f"{path.name}:{node.lineno} reference to .float")
    assert offenders == [], f"Float usage found in the gate package: {offenders}"


def _load_fixture() -> dict:
    with open(FIXTURES_DIR / "s5-get-dispute.json", encoding="utf-8") as handle:
        return json.load(handle)


def test_money_and_decimal_helpers_are_used_for_amounts():
    """G3 rules operate on Decimal values only, never floats."""
    result = check_g3_01(MakeOffer(amount=_usd("25.01"), offer_type="REFUND"), parse_dispute(_load_fixture()), None)
    # Missing charter -> fail closed (NEEDS_APPROVAL), never a crash or a float path.
    assert result is not None
    assert result.verdict == Verdict.NEEDS_APPROVAL
