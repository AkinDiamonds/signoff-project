"""Golden replay for the gate.

Every case in ``tests/golden/gate_decisions.json`` is a fully-specified gate
input with its recorded verdict and rule id. Replaying the file must reproduce
those verdicts exactly; the same file is the artifact reused to replay ledger
rows later. A mismatch here means a gate rule changed behavior -- update the
golden file deliberately, never to make a failing assertion pass.
"""

import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from agent.app.domain.actions import (
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProvideEvidence,
    SendMessage,
)
from agent.app.domain.enums import ActionType
from agent.app.domain.money import Money
from agent.app.paypal.models import Dispute, parse_dispute
from agent.app.policy.charter import CharterData
from agent.app.policy.gate import GateDecision, GateInput, HistoryFlags, evaluate_gate

GOLDEN_PATH = Path(__file__).resolve().parent / "golden" / "gate_decisions.json"


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


def _load_golden() -> dict[str, Any]:
    with open(GOLDEN_PATH, encoding="utf-8") as handle:
        return json.load(handle)


def _build_dispute(golden: dict[str, Any], case: dict[str, Any]) -> Dispute:
    fixture_path = _fixtures_dir() / case["fixture"]
    with open(fixture_path, encoding="utf-8") as handle:
        raw = json.load(handle)
    dispute = parse_dispute(raw)
    overrides: dict[str, Any] = {}
    for field, value in case.get("dispute_overrides", {}).items():
        if field == "dispute_amount":
            overrides[field] = Money(currency_code=value["currency_code"], value=Decimal(value["value"]))
        else:
            overrides[field] = value
    return dispute.model_copy(update=overrides)


def _build_charter(golden: dict[str, Any], case: dict[str, Any]) -> CharterData:
    config = json.loads(json.dumps(golden["base_charter"]))  # deep copy
    config.pop("version", None)  # version is not part of CharterData
    config.update(case.get("charter_overrides", {}))
    return CharterData.model_validate(config)


def _build_action(case: dict[str, Any], actions_by_case: dict[str, Any]) -> Any:
    if "action" in case:
        spec = case["action"]
        action_type = spec["type"]
        if action_type == ActionType.PROVIDE_EVIDENCE.value:
            return ProvideEvidence(
                evidence_type=spec.get("evidence_type"),
                notes=spec.get("notes"),
            )
        if action_type == ActionType.SEND_MESSAGE.value:
            return SendMessage(message=spec["message"])
        if action_type == ActionType.MAKE_OFFER.value:
            amount = spec["amount"]
            return MakeOffer(
                amount=Money(currency_code=amount["currency_code"], value=Decimal(amount["value"])),
                offer_type=spec.get("offer_type", "REFUND"),
                note=spec.get("note"),
            )
        if action_type == ActionType.ACCEPT_CLAIM.value:
            amount = spec.get("amount")
            return AcceptClaim(
                amount=None
                if amount is None
                else Money(currency_code=amount["currency_code"], value=Decimal(amount["value"])),
                accept_claim_type=spec.get("accept_claim_type", "REFUND"),
                note=spec.get("note"),
            )
        if action_type == ActionType.ESCALATE.value:
            return Escalate(note=spec.get("note"))
        if action_type == ActionType.APPEAL.value:
            return Appeal(note=spec.get("note"))
        raise NotImplementedError(f"Golden case action type not supported: {action_type}")
    return actions_by_case[case["action_same_as"]]


def _build_prior_executions(
    case: dict[str, Any],
    actions_by_case: dict[str, Any],
    fingerprints_by_case: dict[str, str],
) -> tuple[Any, ...]:
    reference = case.get("prior_action_same_as")
    if reference is None:
        return ()
    from agent.app.domain.actions import compute_action_hash

    action = actions_by_case[reference]
    return (
        {
            "action_hash": compute_action_hash(action),
            "dispute_fingerprint": fingerprints_by_case[reference],
        },
    )


def test_golden_decisions_replay_exactly():
    golden = _load_golden()
    cases = golden["cases"]
    actions_by_case: dict[str, Any] = {}
    fingerprints_by_case: dict[str, str] = {}

    for case in cases:
        dispute = _build_dispute(golden, case)
        charter = _build_charter(golden, case)
        action = _build_action(case, actions_by_case)

        history = HistoryFlags(
            buyer_dispute_count_in_window=case.get("history_flags", {}).get(
                "buyer_dispute_count_in_window", 0
            ),
            injection_flag=case.get("history_flags", {}).get("injection_flag", False),
        )
        due_date = dispute.seller_response_due_date
        assert due_date is not None, f"{case['case_id']} fixture must carry a due date"
        now = due_date + timedelta(days=case["now_offset_days_from_due"])

        prior = _build_prior_executions(case, actions_by_case, fingerprints_by_case)

        decision: GateDecision = evaluate_gate(
            GateInput(
                action=action,
                dispute=dispute,
                charter=charter,
                now=now,
                history_flags=history,
                prior_executions=prior,
            )
        )

        expected = case["expected"]
        assert decision.verdict.value == expected["verdict"], (
            f"{case['case_id']}: expected {expected['verdict']}, got {decision.verdict.value} "
            f"({decision.rule_id}: {decision.reason})"
        )
        assert decision.rule_id == expected["rule_id"], (
            f"{case['case_id']}: expected rule {expected['rule_id']}, got {decision.rule_id}"
        )
        if "also_triggered" in expected:
            assert list(decision.also_triggered) == expected["also_triggered"], (
                f"{case['case_id']}: expected also_triggered {expected['also_triggered']}, "
                f"got {list(decision.also_triggered)}"
            )

        actions_by_case[case["case_id"]] = action
        fingerprints_by_case[case["case_id"]] = decision.dispute_fingerprint


def test_golden_file_schema_is_well_formed():
    golden = _load_golden()
    assert golden["schema_version"] == 1
    case_ids = [case["case_id"] for case in golden["cases"]]
    assert len(case_ids) == len(set(case_ids)), "golden case ids must be unique"
    for case in golden["cases"]:
        assert {"case_id", "description", "fixture", "now_offset_days_from_due", "expected"} <= set(case)
        assert case["expected"]["verdict"] in {"ALLOW", "NEEDS_APPROVAL", "DENY"}
        assert case["expected"]["rule_id"]


def test_golden_file_covers_every_verdict():
    golden = _load_golden()
    verdicts = {case["expected"]["verdict"] for case in golden["cases"]}
    assert verdicts == {"ALLOW", "NEEDS_APPROVAL", "DENY"}
    rule_ids = {case["expected"]["rule_id"] for case in golden["cases"]}
    # Every rule family completed in steps 11 and 12 has at least one golden case.
    expected_families = {
        "G1-01",
        "G2-01",
        "G2-02",
        "G3-01",
        "G3-02",
        "G3-03",
        "G3-04",
        "G4-01",
        "G4-02",
        "G5-01",
        "G5-02",
        "G6-01",
        "G7-01",
    }
    assert expected_families <= rule_ids
