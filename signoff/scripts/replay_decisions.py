"""Replay script re-running the pure gate on stored decisions and reporting differences.

Per Step 14:
- Re-runs gate on stored inputs and reports differences from stored verdicts.
- Replay with a missing charter version reports an error row, not a crash.
- Works against database records or golden decision files.
"""

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import UTC
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

# Setup sys.path so 'agent.app...' is importable
repo_root = Path(__file__).resolve().parent.parent.parent
signoff_dir = repo_root / "signoff"
agent_dir = signoff_dir / "agent"
for p in [str(agent_dir), str(signoff_dir), str(repo_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from agent.app.db.models import Charter, Decision, Dispute  # noqa: E402
from agent.app.db.session import get_engine  # noqa: E402
from agent.app.domain.actions import (  # noqa: E402
    AcceptClaim,
    Appeal,
    Escalate,
    MakeOffer,
    ProposedAction,
    ProvideEvidence,
    SendMessage,
)
from agent.app.domain.enums import ActionType  # noqa: E402
from agent.app.domain.money import Money  # noqa: E402
from agent.app.paypal.models import parse_dispute  # noqa: E402
from agent.app.policy.charter import CharterData  # noqa: E402
from agent.app.policy.gate import GateInput, evaluate_gate  # noqa: E402


@dataclass(frozen=True, slots=True)
class ReplayResult:
    decision_id: str
    dispute_id: str
    status: str  # PASS, DIFF, ERROR
    stored_verdict: str | None
    replayed_verdict: str | None
    stored_rule_id: str | None
    replayed_rule_id: str | None
    match: bool
    error: str | None = None


def parse_action_from_stored(
    action_type: str,
    action_payload: dict[str, Any] | None,
) -> ProposedAction:
    """Reconstruct domain ProposedAction from stored action_type and payload."""
    payload = dict(action_payload or {})
    payload["action_type"] = action_type

    if "amount" in payload and isinstance(payload["amount"], dict):
        amt_dict = payload["amount"]
        payload["amount"] = Money(
            currency_code=amt_dict.get("currency_code", "USD"),
            value=Decimal(str(amt_dict.get("value", "0.00"))),
        )

    if action_type == ActionType.PROVIDE_EVIDENCE.value:
        return ProvideEvidence.model_validate(payload)
    if action_type == ActionType.SEND_MESSAGE.value:
        return SendMessage.model_validate(payload)
    if action_type == ActionType.MAKE_OFFER.value:
        return MakeOffer.model_validate(payload)
    if action_type == ActionType.ACCEPT_CLAIM.value:
        return AcceptClaim.model_validate(payload)
    if action_type == ActionType.ESCALATE.value:
        return Escalate.model_validate(payload)
    if action_type == ActionType.APPEAL.value:
        return Appeal.model_validate(payload)

    raise ValueError(f"Unknown action type: {action_type}")


def replay_single_decision(
    session: Session,
    decision: Decision,
) -> ReplayResult:
    """Replay one stored decision against the pure gate.

    Reports error row if charter or dispute is missing, avoiding crashes.
    """
    decision_id_str = str(decision.id)
    dispute_id = decision.dispute_id

    # 1. Fetch charter version
    charter_row = session.execute(
        select(Charter).where(Charter.version == decision.charter_version)
    ).scalar_one_or_none()

    if charter_row is None:
        return ReplayResult(
            decision_id=decision_id_str,
            dispute_id=dispute_id,
            status="ERROR",
            stored_verdict=decision.verdict,
            replayed_verdict=None,
            stored_rule_id=decision.rule_id,
            replayed_rule_id=None,
            match=False,
            error=f"Charter version {decision.charter_version} not found in database",
        )

    try:
        charter_data = CharterData.model_validate(charter_row.config)
    except Exception as exc:
        return ReplayResult(
            decision_id=decision_id_str,
            dispute_id=dispute_id,
            status="ERROR",
            stored_verdict=decision.verdict,
            replayed_verdict=None,
            stored_rule_id=decision.rule_id,
            replayed_rule_id=None,
            match=False,
            error=f"Failed to parse charter config: {exc}",
        )

    # 2. Fetch dispute snapshot
    dispute_row = session.execute(
        select(Dispute).where(Dispute.id == dispute_id)
    ).scalar_one_or_none()

    if dispute_row is None:
        return ReplayResult(
            decision_id=decision_id_str,
            dispute_id=dispute_id,
            status="ERROR",
            stored_verdict=decision.verdict,
            replayed_verdict=None,
            stored_rule_id=decision.rule_id,
            replayed_rule_id=None,
            match=False,
            error=f"Dispute {dispute_id} not found in database",
        )

    try:
        dispute_model = parse_dispute(dispute_row.snapshot)
    except Exception as exc:
        return ReplayResult(
            decision_id=decision_id_str,
            dispute_id=dispute_id,
            status="ERROR",
            stored_verdict=decision.verdict,
            replayed_verdict=None,
            stored_rule_id=decision.rule_id,
            replayed_rule_id=None,
            match=False,
            error=f"Failed to parse dispute snapshot: {exc}",
        )

    # 3. Parse action
    try:
        action = parse_action_from_stored(decision.action_type, decision.action_payload)
    except Exception as exc:
        return ReplayResult(
            decision_id=decision_id_str,
            dispute_id=dispute_id,
            status="ERROR",
            stored_verdict=decision.verdict,
            replayed_verdict=None,
            stored_rule_id=decision.rule_id,
            replayed_rule_id=None,
            match=False,
            error=f"Failed to parse stored action: {exc}",
        )

    # 4. Evaluate gate on stored inputs
    now = decision.created_at
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)

    gate_input = GateInput(
        action=action,
        dispute=dispute_model,
        charter=charter_data,
        now=now,
    )

    replayed = evaluate_gate(gate_input)

    match = (
        replayed.verdict.value == decision.verdict
        and replayed.rule_id == decision.rule_id
    )

    return ReplayResult(
        decision_id=decision_id_str,
        dispute_id=dispute_id,
        status="PASS" if match else "DIFF",
        stored_verdict=decision.verdict,
        replayed_verdict=replayed.verdict.value,
        stored_rule_id=decision.rule_id,
        replayed_rule_id=replayed.rule_id,
        match=match,
        error=None,
    )


def replay_all_decisions(
    session: Session,
    dispute_id: str | None = None,
) -> list[ReplayResult]:
    """Replay all decisions or decisions for a specific dispute."""
    stmt = select(Decision)
    if dispute_id:
        stmt = stmt.where(Decision.dispute_id == dispute_id)
    stmt = stmt.order_by(Decision.created_at.asc(), Decision.id.asc())

    decisions = list(session.scalars(stmt).all())
    return [replay_single_decision(session, dec) for dec in decisions]


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay stored decisions against gate policy.")
    parser.add_argument("--dispute-id", help="Replay decisions only for specific dispute ID")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    engine = get_engine()
    with Session(engine) as session:
        results = replay_all_decisions(session, dispute_id=args.dispute_id)

    if args.json:
        payload = [
            {
                "decision_id": r.decision_id,
                "dispute_id": r.dispute_id,
                "status": r.status,
                "match": r.match,
                "stored_verdict": r.stored_verdict,
                "replayed_verdict": r.replayed_verdict,
                "stored_rule_id": r.stored_rule_id,
                "replayed_rule_id": r.replayed_rule_id,
                "error": r.error,
            }
            for r in results
        ]
        print(json.dumps(payload, indent=2))
        return 0 if all(r.match for r in results) else 1

    print(f"Replayed {len(results)} decision(s):")
    diffs = 0
    errors = 0
    for r in results:
        if r.status == "PASS":
            print(f"  [PASS] Decision {r.decision_id} ({r.dispute_id}): {r.stored_verdict} ({r.stored_rule_id})")
        elif r.status == "DIFF":
            diffs += 1
            print(
                f"  [DIFF] Decision {r.decision_id} ({r.dispute_id}): "
                f"stored {r.stored_verdict}/{r.stored_rule_id} != replayed {r.replayed_verdict}/{r.replayed_rule_id}"
            )
        else:
            errors += 1
            print(f"  [ERROR] Decision {r.decision_id} ({r.dispute_id}): {r.error}")

    print(f"\nSummary: {len(results) - diffs - errors} passed, {diffs} diffs, {errors} errors")
    return 0 if (diffs == 0 and errors == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
