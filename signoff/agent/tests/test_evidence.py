"""Evidence builder, strength boundaries, wording, and determinism tests."""

import re
from dataclasses import replace
from datetime import timedelta

import pytest

from agent.app.agent.evidence import (
    NOT_RECEIVED_REASON,
    BuiltEvidence,
    EvidenceComponent,
    EvidenceStrength,
    build_evidence,
    label_for,
    normalize_carrier,
    normalize_tracking_number,
    to_provide_evidence,
)
from agent.app.domain.enums import EvidenceStrengthLabel
from agent.app.store_mock.scenarios import SCENARIOS_BY_TRANSACTION_ID, OrderRecord

FORBIDDEN_WORD = re.compile(r"\b(probability|win)\b", re.IGNORECASE)


def record(scenario_id: str) -> OrderRecord:
    return next(
        scenario
        for scenario in SCENARIOS_BY_TRANSACTION_ID.values()
        if scenario.scenario_id == scenario_id
    )


def build(scenario_id: str, order: OrderRecord | None = None) -> BuiltEvidence:
    target = order if order is not None else record(scenario_id)
    return build_evidence(
        target,
        reason=NOT_RECEIVED_REASON,
        transaction_id=target.paypal_transaction_id,
    )


@pytest.mark.parametrize(
    ("scenario_id", "score", "label", "buildable"),
    [
        ("A", 100, EvidenceStrengthLabel.HIGH, True),
        ("B", 60, EvidenceStrengthLabel.MEDIUM, True),
        ("C", 93, EvidenceStrengthLabel.HIGH, True),
        ("D", 100, EvidenceStrengthLabel.HIGH, True),
        ("E", 20, EvidenceStrengthLabel.LOW, True),
    ],
)
def test_scenario_table_strength_ranges(scenario_id, score, label, buildable):
    evidence = build(scenario_id)

    assert evidence.buildable is buildable
    assert evidence.strength.score == score
    assert evidence.strength.label == label
    assert 0 <= evidence.strength.score <= 100


def test_no_order_is_not_buildable_and_low_strength():
    evidence = build_evidence(None, reason=NOT_RECEIVED_REASON, transaction_id="TX-MISSING")

    assert evidence.buildable is False
    assert evidence.evidence_type is None
    assert evidence.notes is None
    assert evidence.tracking_info == ()
    assert "No order found" in evidence.reason
    assert "TX-MISSING" in evidence.reason
    assert evidence.strength.score == 0
    assert evidence.strength.label == EvidenceStrengthLabel.LOW


def test_unsupported_reason_is_not_buildable():
    evidence = build_evidence(
        record("A"),
        reason="UNAUTHORIZED_TRANSACTION",
        transaction_id="TX-SCENARIO-A",
    )

    assert evidence.buildable is False
    assert "not-received" in evidence.reason
    assert evidence.tracking_info == ()


def test_tracking_present_but_not_delivered_is_medium():
    evidence = build("B")
    delivered = next(
        component for component in evidence.strength.components if component.name == "delivered"
    )
    tracking = next(
        component for component in evidence.strength.components if component.name == "tracking"
    )

    assert evidence.buildable is True
    assert delivered.points == 0
    assert tracking.points == 25
    assert evidence.strength.label == EvidenceStrengthLabel.MEDIUM


def test_delivery_before_order_is_not_counted():
    original = record("A")
    early_shipment = replace(
        original.shipments[0],
        event_time=original.created_at - timedelta(days=1),
    )
    early_order = replace(original, shipments=(early_shipment,))

    evidence = build("A", early_order)

    delivered = next(
        component for component in evidence.strength.components if component.name == "delivered"
    )
    assert evidence.buildable is True
    assert delivered.points == 0
    assert evidence.strength.score == 60
    assert "dated before the order" in (evidence.notes or "")


def test_several_shipments_are_all_submitted_in_time_order():
    evidence = build("C")

    assert [info["carrier"] for info in evidence.tracking_info] == ["UPS", "FEDEX"]
    assert len(evidence.tracking_info) == 2


def test_unknown_carrier_does_not_submit():
    original = record("A")
    unknown = replace(original.shipments[0], carrier="CARRIER-X")

    evidence = build("A", replace(original, shipments=(unknown,)))

    assert evidence.buildable is False
    assert evidence.tracking_info == ()
    assert "supported carrier" in evidence.reason
    assert evidence.strength.label == EvidenceStrengthLabel.LOW


def test_invalid_tracking_number_does_not_submit():
    original = record("A")
    invalid = replace(original.shipments[0], tracking_number="BAD;TRACKING")

    evidence = build("A", replace(original, shipments=(invalid,)))

    assert evidence.buildable is False
    assert "invalid tracking number" in evidence.reason


def test_tracking_number_is_trimmed_and_uppercased():
    original = record("A")
    messy = replace(original.shipments[0], tracking_number=" 1z999aa10123456784 ")

    evidence = build("A", replace(original, shipments=(messy,)))

    assert evidence.buildable is True
    assert evidence.tracking_info[0]["tracking_number"] == "1Z999AA10123456784"


def test_too_long_tracking_number_is_rejected():
    original = record("A")
    too_long = replace(original.shipments[0], tracking_number="A" * 51)

    evidence = build("A", replace(original, shipments=(too_long,)))

    assert evidence.buildable is False


def test_normalizers_fail_closed():
    assert normalize_carrier(" ups ") == "UPS"
    assert normalize_carrier("carrier-x") is None
    assert normalize_tracking_number(" 1z999aa10123456784 ") == "1Z999AA10123456784"
    assert normalize_tracking_number("bad tracking") is None
    assert normalize_tracking_number("A" * 51) is None


@pytest.mark.parametrize(
    ("score", "label"),
    [
        (0, EvidenceStrengthLabel.LOW),
        (39, EvidenceStrengthLabel.LOW),
        (40, EvidenceStrengthLabel.MEDIUM),
        (69, EvidenceStrengthLabel.MEDIUM),
        (70, EvidenceStrengthLabel.HIGH),
        (100, EvidenceStrengthLabel.HIGH),
    ],
)
def test_label_boundaries(score, label):
    assert label_for(score) == label


@pytest.mark.parametrize("score", [-1, 101])
def test_label_rejects_out_of_bounds(score):
    with pytest.raises(ValueError):
        label_for(score)


def test_label_rejects_non_integer():
    with pytest.raises(TypeError):
        label_for(50.0)  # type: ignore[arg-type]
    with pytest.raises(TypeError):
        label_for(True)


def test_evidence_strength_runtime_bounds_and_label_consistency():
    with pytest.raises(ValueError):
        EvidenceStrength(score=-1, label=EvidenceStrengthLabel.LOW, components=())
    with pytest.raises(ValueError):
        EvidenceStrength(score=101, label=EvidenceStrengthLabel.HIGH, components=())
    with pytest.raises(ValueError):
        EvidenceStrength(score=40, label=EvidenceStrengthLabel.HIGH, components=())
    with pytest.raises(TypeError):
        EvidenceStrength(score=50.0, label=EvidenceStrengthLabel.MEDIUM, components=())  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        EvidenceComponent(name="bad", points=-1, detail="negative")


def test_built_evidence_rejects_inconsistent_state():
    strength = EvidenceStrength(score=0, label=EvidenceStrengthLabel.LOW, components=())
    with pytest.raises(ValueError):
        BuiltEvidence(
            buildable=False,
            evidence_type="PROOF_OF_FULFILLMENT",
            notes="should not exist",
            tracking_info=(),
            reason="not buildable",
            strength=strength,
        )


def test_output_never_contains_probability_or_win():
    for scenario_id in ("A", "B", "C", "D", "E"):
        evidence = build(scenario_id)
        texts = [evidence.reason, evidence.notes or ""]
        texts.extend(component.detail for component in evidence.strength.components)
        for text in texts:
            assert not FORBIDDEN_WORD.search(text), f"forbidden wording in {scenario_id}: {text!r}"


def test_buyer_note_is_never_echoed():
    evidence = build("D")
    buyer_note = record("D").items[0]["buyer_note"]

    assert isinstance(buyer_note, str)
    assert buyer_note not in (evidence.notes or "")
    assert buyer_note not in evidence.reason


def test_determinism_100_runs():
    first = build("A")
    for _ in range(99):
        assert build("A") == first


def test_to_provide_evidence_maps_tracking_info():
    evidence = build("A")
    action = to_provide_evidence(evidence)

    assert action is not None
    assert action.evidence_type == "PROOF_OF_FULFILLMENT"
    assert action.notes == evidence.notes
    assert action.tracking_info == evidence.tracking_info


def test_to_provide_evidence_returns_none_when_not_buildable():
    evidence = build_evidence(None, reason=NOT_RECEIVED_REASON)
    assert to_provide_evidence(evidence) is None
