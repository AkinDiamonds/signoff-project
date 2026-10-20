"""Comprehensive tests for Step 11: Gate Core.

Validates all requirements from build-plan/steps/11-gate-core.md and plan/03-gate-spec.md:
- Pure gate function with no I/O, no clock, no randomness.
- Action union discrimination and deterministic action hashing.
- GateDecision frozen and constructed ONLY inside policy/gate.py.
- Rule registry completeness and duplicate-free enforcement.
- Individual rules: G0-00, G1-01, G1-02, G2-01, G2-02 (allow, deny, boundary).
- Aggregation: DENY > NEEDS_APPROVAL > ALLOW, lowest-numbered step rule_id recorded.
- Every triggered rule listed in also_triggered.
- Timezone enforcement: naive now or due date rejected.
- Spec properties:
  - (P1) Never ALLOW if action not in allowed response options or links.
  - (P3) Every decision has non-empty rule_id and reason.
  - (P5) Same input produces identical output (100x determinism).
- 100% branch coverage on policy/gate.py and policy/rules.py.
"""

import json
from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from agent.app.domain.actions import (
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProvideEvidence,
    SendMessage,
    compute_action_hash,
)
from agent.app.domain.enums import ActionType, DisputeStatus, Verdict
from agent.app.paypal.models import (
    AcceptClaimOption,
    AllowedResponseOptions,
    Dispute,
    Link,
    MakeOfferOption,
    Money,
    parse_dispute,
)
from agent.app.policy.charter import DEFAULT_CHARTER_DATA, CharterResponse
from agent.app.policy.gate import (
    GateDecision,
    GateInput,
    evaluate_gate,
)
from agent.app.policy.rules import (
    RULE_REGISTRY,
    check_g0_00,
    check_g1_01,
    check_g1_02,
    check_g2_01,
    check_g2_02,
)


def get_fixtures_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parents[2] / "fixtures" / "paypal",
        Path(__file__).resolve().parents[3] / "signoff" / "fixtures" / "paypal",
        Path("signoff/fixtures/paypal").resolve(),
        Path("fixtures/paypal").resolve(),
    ]
    for c in candidates:
        if c.is_dir():
            return c
    raise FileNotFoundError("Could not find fixtures/paypal directory")


FIXTURES_DIR = get_fixtures_dir()


def load_fixture_json(filename: str) -> dict[str, Any]:
    with open(FIXTURES_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def base_dispute() -> Dispute:
    """Dispute from recorded sandbox fixture s5-get-dispute.json."""
    data = load_fixture_json("s5-get-dispute.json")
    return parse_dispute(data)


@pytest.fixture
def default_now(base_dispute: Dispute) -> datetime:
    """A safe datetime prior to the fixture's seller_response_due_date."""
    assert base_dispute.seller_response_due_date is not None
    return base_dispute.seller_response_due_date - timedelta(days=2)


# ===========================================================================
# 1. Action Union & Action Hash Tests
# ===========================================================================


def test_action_models_validation_and_types():
    # ProvideEvidence
    act_ev = ProvideEvidence(evidence_type="PROOF_OF_DELIVERY", notes="Delivered with signature")
    assert act_ev.action_type == ActionType.PROVIDE_EVIDENCE

    # SendMessage
    act_msg = SendMessage(message="Hello customer, tracking shows delivered.")
    assert act_msg.action_type == ActionType.SEND_MESSAGE

    # MakeOffer
    act_offer = MakeOffer(
        amount=Money(currency_code="USD", value=Decimal("10.00")),
        offer_type="REFUND",
        note="Full refund offer",
    )
    assert act_offer.action_type == ActionType.MAKE_OFFER

    # AcceptClaim
    act_claim = AcceptClaim(
        amount=Money(currency_code="USD", value=Decimal("10.00")),
        accept_claim_type="REFUND",
    )
    assert act_claim.action_type == ActionType.ACCEPT_CLAIM

    # Escalate & Appeal
    act_esc = Escalate(note="Escalating to PayPal")
    assert act_esc.action_type == ActionType.ESCALATE
    act_app = Appeal(note="Appealing resolved dispute")
    assert act_app.action_type == ActionType.APPEAL

    # Extra fields are forbidden
    with pytest.raises(ValidationError):
        SendMessage(message="hi", extra_field="forbidden")  # type: ignore[call-arg]

    # Models are frozen
    with pytest.raises(ValidationError):
        act_msg.message = "mutated"  # type: ignore[misc]


def test_action_hash_deterministic():
    act1 = MakeOffer(
        amount=Money(currency_code="USD", value=Decimal("15.50")),
        offer_type="REFUND",
        note="Offer note",
    )
    act2 = MakeOffer(
        amount=Money(currency_code="USD", value=Decimal("15.50")),
        offer_type="REFUND",
        note="Offer note",
    )
    act_diff = MakeOffer(
        amount=Money(currency_code="USD", value=Decimal("15.51")),
        offer_type="REFUND",
        note="Offer note",
    )

    hash1 = compute_action_hash(act1)
    hash2 = compute_action_hash(act2)
    hash_diff = compute_action_hash(act_diff)

    assert hash1 == hash2
    assert len(hash1) == 64
    assert hash1 != hash_diff

    # Non-model hashing fallback
    assert len(compute_action_hash({"key": "val"})) == 64
    assert len(compute_action_hash("plain_string")) == 64


# ===========================================================================
# 2. GateDecision Security & Immutability Tests
# ===========================================================================


def test_gate_decision_cannot_be_built_outside_gate():
    """Runtime test: GateDecision refuses instantiation outside policy/gate.py."""
    with pytest.raises(PermissionError, match="GateDecision can only be constructed inside policy/gate.py"):
        GateDecision(
            verdict=Verdict.ALLOW,
            rule_id="G7-01",
            reason="Unsanctioned creation",
            action_hash="abc",
            dispute_fingerprint="def",
            charter_version=1,
        )

    # Even passing an invalid factory key raises PermissionError
    with pytest.raises(PermissionError):
        GateDecision(
            verdict=Verdict.ALLOW,
            rule_id="G7-01",
            reason="Fake key",
            action_hash="abc",
            dispute_fingerprint="def",
            charter_version=1,
            _factory_key="not_the_secret",
        )


def test_gate_decision_is_frozen(base_dispute: Dispute, default_now: datetime):
    gate_in = GateInput(
        action=ProvideEvidence(),
        dispute=base_dispute,
        charter=DEFAULT_CHARTER_DATA,
        now=default_now,
    )
    decision = evaluate_gate(gate_in)
    assert isinstance(decision, GateDecision)

    # Trying to mutate attributes raises FrozenInstanceError
    with pytest.raises(FrozenInstanceError):
        decision.verdict = Verdict.DENY  # type: ignore[misc]

    with pytest.raises(FrozenInstanceError):
        decision.rule_id = "MUTATED"  # type: ignore[misc]

    # to_dict conversion
    d_dict = decision.to_dict()
    assert d_dict["verdict"] == "ALLOW"
    assert d_dict["rule_id"] == "G7-01"
    assert isinstance(d_dict["also_triggered"], list)


# ===========================================================================
# 3. Rule Registry Invariants
# ===========================================================================


def test_rule_registry_no_duplicates_and_all_step11_rules_present():
    seen_ids = set()
    for rule_id, rule_def in RULE_REGISTRY.items():
        assert rule_id == rule_def.rule_id
        assert rule_id not in seen_ids
        seen_ids.add(rule_id)
        assert rule_def.description
        assert isinstance(rule_def.default_verdict, Verdict)

    # Ensure all step 11 rules are registered
    assert "G0-00" in RULE_REGISTRY
    assert "G1-01" in RULE_REGISTRY
    assert "G1-02" in RULE_REGISTRY
    assert "G2-01" in RULE_REGISTRY
    assert "G2-02" in RULE_REGISTRY
    assert "G7-01" in RULE_REGISTRY


# ===========================================================================
# 4. Individual Rule Behavior & Edge Cases
# ===========================================================================


def test_rule_g0_00_unknown_action(base_dispute: Dispute, default_now: datetime):
    """G0-00 fails closed to NEEDS_APPROVAL on unknown action object."""

    # Custom unknown class
    class UnknownAction:
        pass

    res = check_g0_00(UnknownAction())
    assert res is not None
    assert res.rule_id == "G0-00"
    assert res.verdict == Verdict.NEEDS_APPROVAL

    # Custom object with invalid action_type
    class BogusAction(ProvideEvidence):
        action_type: Any = "BOGUS_TYPE"

    res_bogus = check_g0_00(BogusAction())
    assert res_bogus is not None
    assert res_bogus.rule_id == "G0-00"

    # Valid action passes G0-00
    assert check_g0_00(ProvideEvidence()) is None


def test_rule_g1_01_missing_from_allowed_options_or_links(base_dispute: Dispute):
    # Base dispute has provide_evidence, send_message, escalate, make_offer, accept_claim in links/options
    assert check_g1_01(ProvideEvidence(), base_dispute) is None
    assert check_g1_01(SendMessage(message="hi"), base_dispute) is None
    assert check_g1_01(Escalate(), base_dispute) is None
    assert (
        check_g1_01(
            MakeOffer(amount=Money(currency_code="USD", value=Decimal("10.00")), offer_type="REFUND"),
            base_dispute,
        )
        is None
    )
    assert (
        check_g1_01(
            AcceptClaim(amount=Money(currency_code="USD", value=Decimal("10.00")), accept_claim_type="REFUND"),
            base_dispute,
        )
        is None
    )

    # Appeal is not in base_dispute links -> DENY G1-01
    res_app = check_g1_01(Appeal(), base_dispute)
    assert res_app is not None
    assert res_app.rule_id == "G1-01"
    assert res_app.verdict == Verdict.DENY

    # Dispute with empty links and empty options -> all denied G1-01
    empty_dispute = base_dispute.model_copy(
        update={
            "links": [],
            "allowed_response_options": AllowedResponseOptions(),
        }
    )
    for act in [
        ProvideEvidence(),
        SendMessage(message="hi"),
        MakeOffer(amount=Money(currency_code="USD", value=Decimal("10.00")), offer_type="REFUND"),
        AcceptClaim(amount=Money(currency_code="USD", value=Decimal("10.00")), accept_claim_type="REFUND"),
        Escalate(),
        Appeal(),
    ]:
        res = check_g1_01(act, empty_dispute)
        assert res is not None
        assert res.rule_id == "G1-01"
        assert res.verdict == Verdict.DENY

    # Dispute with allowed options for make_offer/accept_claim but no links
    opts_only_dispute = base_dispute.model_copy(
        update={
            "links": [],
            "allowed_response_options": AllowedResponseOptions(
                make_offer=MakeOfferOption(offer_types=["REFUND"]),
                accept_claim=AcceptClaimOption(accept_claim_types=["REFUND"]),
            ),
        }
    )
    assert (
        check_g1_01(
            MakeOffer(amount=Money(currency_code="USD", value=Decimal("5.00")), offer_type="REFUND"),
            opts_only_dispute,
        )
        is None
    )
    assert (
        check_g1_01(
            AcceptClaim(amount=Money(currency_code="USD", value=Decimal("5.00")), accept_claim_type="REFUND"),
            opts_only_dispute,
        )
        is None
    )


def test_rule_g1_02_offer_or_claim_type_not_allowed(base_dispute: Dispute):
    # base_dispute allows offer_types=["REFUND"], accept_claim_types=["PARTIAL_REFUND", "REFUND"]
    # Valid types pass
    act_valid_offer = MakeOffer(amount=Money(currency_code="USD", value=Decimal("5.00")), offer_type="REFUND")
    assert check_g1_02(act_valid_offer, base_dispute) is None

    act_valid_claim = AcceptClaim(
        amount=Money(currency_code="USD", value=Decimal("5.00")), accept_claim_type="PARTIAL_REFUND"
    )
    assert check_g1_02(act_valid_claim, base_dispute) is None

    # Invalid offer type -> DENY G1-02
    act_bad_offer = MakeOffer(amount=Money(currency_code="USD", value=Decimal("5.00")), offer_type="REPLACEMENT")
    res_offer = check_g1_02(act_bad_offer, base_dispute)
    assert res_offer is not None
    assert res_offer.rule_id == "G1-02"
    assert res_offer.verdict == Verdict.DENY

    # Invalid accept claim type -> DENY G1-02
    act_bad_claim = AcceptClaim(
        amount=Money(currency_code="USD", value=Decimal("5.00")), accept_claim_type="RETURN_ITEM"
    )
    res_claim = check_g1_02(act_bad_claim, base_dispute)
    assert res_claim is not None
    assert res_claim.rule_id == "G1-02"
    assert res_claim.verdict == Verdict.DENY

    # Non-offer / non-claim action ignores G1-02
    assert check_g1_02(ProvideEvidence(), base_dispute) is None


def test_rule_g2_01_status_waiting_for_seller_response(base_dispute: Dispute):
    # WAITING_FOR_SELLER_RESPONSE passes
    assert base_dispute.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE
    assert check_g2_01(ProvideEvidence(), base_dispute) is None

    # Other statuses fail
    for invalid_status in [
        DisputeStatus.UNDER_REVIEW,
        DisputeStatus.WAITING_FOR_BUYER_RESPONSE,
        DisputeStatus.RESOLVED,
        DisputeStatus.OPEN,
        DisputeStatus.OTHER,
        "CUSTOM_STATUS",
    ]:
        disp = base_dispute.model_copy(update={"status": invalid_status})
        res = check_g2_01(ProvideEvidence(), disp)
        assert res is not None
        assert res.rule_id == "G2-01"
        assert res.verdict == Verdict.DENY


def test_rule_g2_02_deadline_boundary_and_naive_tz(base_dispute: Dispute):
    due_date = base_dispute.seller_response_due_date
    assert due_date is not None

    # 1. Before due date -> Pass
    now_before = due_date - timedelta(seconds=1)
    assert check_g2_02(ProvideEvidence(), base_dispute, now_before) is None

    # 2. Boundary: exactly at due date -> Pass (inclusive deadline per build-plan/contracts.md)
    now_exact = due_date
    assert check_g2_02(ProvideEvidence(), base_dispute, now_exact) is None

    # 3. Strictly after due date -> DENY G2-02
    now_after = due_date + timedelta(seconds=1)
    res = check_g2_02(ProvideEvidence(), base_dispute, now_after)
    assert res is not None
    assert res.rule_id == "G2-02"
    assert res.verdict == Verdict.DENY

    # 4. Dispute with no due date -> Pass
    disp_no_due = base_dispute.model_copy(update={"seller_response_due_date": None})
    assert check_g2_02(ProvideEvidence(), disp_no_due, now_after) is None

    # 5. Timezone-naive now -> ValueError
    naive_now = datetime(2026, 10, 20, 12, 0, 0)
    with pytest.raises(ValueError, match="Timezone-naive now is rejected"):
        check_g2_02(ProvideEvidence(), base_dispute, naive_now)

    # 6. Timezone-naive due_date on dispute -> ValueError
    disp_naive_due = base_dispute.model_copy(update={"seller_response_due_date": datetime(2026, 10, 25, 12, 0, 0)})
    with pytest.raises(ValueError, match="Timezone-naive seller_response_due_date is rejected"):
        check_g2_02(ProvideEvidence(), disp_naive_due, now_before)


# ===========================================================================
# 5. Gate Aggregation & Precedence Tests
# ===========================================================================


def test_gate_aggregation_allow_when_all_pass(base_dispute: Dispute, default_now: datetime):
    gate_in = GateInput(
        action=ProvideEvidence(),
        dispute=base_dispute,
        charter=DEFAULT_CHARTER_DATA,
        now=default_now,
    )
    dec = evaluate_gate(gate_in)
    assert dec.verdict == Verdict.ALLOW
    assert dec.rule_id == "G7-01"
    # Rule metadata has a single source of truth: the registry.
    assert dec.reason == RULE_REGISTRY["G7-01"].description
    assert "auto-permitted" in dec.reason
    assert dec.also_triggered == ()
    assert dec.charter_version == 1
    assert dec.action_hash == compute_action_hash(gate_in.action)


def test_gate_aggregation_deny_beats_needs_approval(base_dispute: Dispute, default_now: datetime):
    """When both G0-00 (NEEDS_APPROVAL) and G2-01 (DENY) trigger: verdict is DENY."""

    class CustomAction:
        action_type = "UNKNOWN"

    disp_under_review = base_dispute.model_copy(update={"status": DisputeStatus.UNDER_REVIEW})

    gate_in = GateInput(
        action=CustomAction(),
        dispute=disp_under_review,
        charter=DEFAULT_CHARTER_DATA,
        now=default_now,
    )
    dec = evaluate_gate(gate_in)
    assert dec.verdict == Verdict.DENY
    # Lowest step DENY rule recorded
    assert dec.rule_id in ("G1-01", "G2-01")
    assert "G0-00" in dec.also_triggered


def test_gate_aggregation_lowest_step_deny_rule_recorded(base_dispute: Dispute, default_now: datetime):
    """When G1-01 (step 1) and G2-01 (step 2) and G2-02 (step 2) trigger: G1-01 is primary."""
    # Action not in links (Appeal), status wrong, due date passed
    past_due = base_dispute.seller_response_due_date + timedelta(days=1)
    disp = base_dispute.model_copy(update={"status": DisputeStatus.RESOLVED})

    gate_in = GateInput(
        action=Appeal(),  # Not in links -> G1-01 (step 1)
        dispute=disp,  # Status not waiting -> G2-01 (step 2)
        charter=DEFAULT_CHARTER_DATA,
        now=past_due,  # Due date passed -> G2-02 (step 2)
    )
    dec = evaluate_gate(gate_in)
    assert dec.verdict == Verdict.DENY
    assert dec.rule_id == "G1-01"
    assert "G2-01" in dec.also_triggered
    assert "G2-02" in dec.also_triggered


def test_gate_aggregation_only_needs_approval(base_dispute: Dispute, default_now: datetime):
    """When only G0-00 triggers: verdict is NEEDS_APPROVAL."""

    class UnknownAction:
        pass

    # Ensure other checks pass (links contain dummy rel or bypassed)
    gate_in = GateInput(
        action=UnknownAction(),
        dispute=base_dispute,
        charter=DEFAULT_CHARTER_DATA,
        now=default_now,
    )
    dec = evaluate_gate(gate_in)
    assert dec.verdict == Verdict.NEEDS_APPROVAL
    assert dec.rule_id == "G0-00"


def test_gate_charter_response_version_propagation(base_dispute: Dispute, default_now: datetime):
    charter_resp = CharterResponse(
        **DEFAULT_CHARTER_DATA.model_dump(),
        version=42,
        created_at=default_now,
    )
    gate_in = GateInput(
        action=ProvideEvidence(),
        dispute=base_dispute,
        charter=charter_resp,
        now=default_now,
    )
    dec = evaluate_gate(gate_in)
    assert dec.charter_version == 42


def test_gate_naive_now_rejected(base_dispute: Dispute):
    naive_now = datetime(2026, 10, 14, 12, 0, 0)
    gate_in = GateInput(
        action=ProvideEvidence(),
        dispute=base_dispute,
        charter=DEFAULT_CHARTER_DATA,
        now=naive_now,
    )
    with pytest.raises(ValueError, match="Timezone-naive now is rejected"):
        evaluate_gate(gate_in)


# ===========================================================================
# 6. Specification Properties & Invariants
# ===========================================================================


def test_property_p1_never_allow_if_action_not_in_allowed_options(base_dispute: Dispute, default_now: datetime):
    """(P1) never ALLOW if action ∉ allowed options or links."""
    # Strip all links and allowed response options
    stripped_dispute = base_dispute.model_copy(
        update={
            "links": [Link(href="https://example.com", rel="self")],
            "allowed_response_options": AllowedResponseOptions(),
        }
    )

    actions = [
        ProvideEvidence(),
        SendMessage(message="hello"),
        MakeOffer(amount=Money(currency_code="USD", value=Decimal("10.00")), offer_type="REFUND"),
        AcceptClaim(amount=Money(currency_code="USD", value=Decimal("10.00")), accept_claim_type="REFUND"),
        Escalate(),
        Appeal(),
    ]

    for act in actions:
        gate_in = GateInput(
            action=act,
            dispute=stripped_dispute,
            charter=DEFAULT_CHARTER_DATA,
            now=default_now,
        )
        dec = evaluate_gate(gate_in)
        assert dec.verdict != Verdict.ALLOW, f"Action {act.action_type} allowed despite missing options/links"
        assert dec.rule_id == "G1-01"


def test_property_p3_every_decision_has_nonempty_rule_id_and_reason(base_dispute: Dispute, default_now: datetime):
    """(P3) every decision has non-empty rule_id and reason."""
    scenarios = [
        # ALLOW
        GateInput(action=ProvideEvidence(), dispute=base_dispute, charter=DEFAULT_CHARTER_DATA, now=default_now),
        # DENY G1-01
        GateInput(action=Appeal(), dispute=base_dispute, charter=DEFAULT_CHARTER_DATA, now=default_now),
        # DENY G2-01
        GateInput(
            action=ProvideEvidence(),
            dispute=base_dispute.model_copy(update={"status": DisputeStatus.RESOLVED}),
            charter=DEFAULT_CHARTER_DATA,
            now=default_now,
        ),
        # DENY G2-02
        GateInput(
            action=ProvideEvidence(),
            dispute=base_dispute,
            charter=DEFAULT_CHARTER_DATA,
            now=base_dispute.seller_response_due_date + timedelta(hours=1),
        ),
    ]

    for gate_in in scenarios:
        dec = evaluate_gate(gate_in)
        assert dec.rule_id.strip() != "", f"Empty rule_id in decision: {dec}"
        assert dec.reason.strip() != "", f"Empty reason in decision: {dec}"


def test_property_p5_100x_determinism(base_dispute: Dispute, default_now: datetime):
    """(P5) same input -> identical output across 100 runs (pure function)."""
    gate_in = GateInput(
        action=ProvideEvidence(),
        dispute=base_dispute,
        charter=DEFAULT_CHARTER_DATA,
        now=default_now,
    )

    baseline = evaluate_gate(gate_in)
    for _ in range(100):
        current = evaluate_gate(gate_in)
        assert current == baseline
        assert current.action_hash == baseline.action_hash
        assert current.dispute_fingerprint == baseline.dispute_fingerprint
        assert current.verdict == baseline.verdict
        assert current.rule_id == baseline.rule_id
        assert current.reason == baseline.reason
        assert current.also_triggered == baseline.also_triggered


def test_every_emitted_rule_id_is_registered(base_dispute: Dispute, default_now: datetime):
    """Every rule_id the gate can emit comes from the single RULE_REGISTRY (no ad-hoc ids)."""
    bad_offer = MakeOffer(amount=Money(currency_code="USD", value=Decimal("5.00")), offer_type="REPLACEMENT")
    resolved = base_dispute.model_copy(update={"status": DisputeStatus.RESOLVED})
    past_due = base_dispute.seller_response_due_date + timedelta(seconds=1)

    emitted: list[str] = []
    for result in (
        check_g0_00(object()),
        check_g1_01(Appeal(), base_dispute),
        check_g1_02(bad_offer, base_dispute),
        check_g2_01(ProvideEvidence(), resolved),
        check_g2_02(ProvideEvidence(), base_dispute, past_due),
    ):
        assert result is not None
        definition = RULE_REGISTRY[result.rule_id]
        assert (definition.step, definition.default_verdict) == (result.step, result.verdict)
        emitted.append(result.rule_id)

    allow_decision = evaluate_gate(
        GateInput(action=ProvideEvidence(), dispute=base_dispute, charter=DEFAULT_CHARTER_DATA, now=default_now)
    )
    emitted.append(allow_decision.rule_id)

    assert set(emitted) == {"G0-00", "G1-01", "G1-02", "G2-01", "G2-02", "G7-01"}
