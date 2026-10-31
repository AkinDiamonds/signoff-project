"""Agent execution loop: reads, proposes, and hands all actions to the gate.

Per Step 17:
- The agent reads, proposes and hands everything to the gate; it can never act.
- Pass every proposed action to the gate; route ALLOW to execute job,
  NEEDS_APPROVAL to approval creation (Step 19), DENY to the ledger.
- Enforce the read-tool allowlist.
- Handle all behavior and typing edge cases.
"""

import logging
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.agent.llm import LLMFailure, LLMFailureKind, LLMService
from agent.app.agent.prompts import PROMPT_VERSION, build_agent_prompt
from agent.app.agent.reasons import (
    SupportedReason,
    build_evidence_for,
    get_support,
    is_supported,
)
from agent.app.agent.reasons.history import count_buyer_disputes
from agent.app.agent.schemas import AgentPlan
from agent.app.agent.screener import screen_dispute_and_context
from agent.app.agent.tools import READ_TOOL_NAMES, get_dispute_tool
from agent.app.approvals import create_approval
from agent.app.db.models import AgentRun, Decision, Execution
from agent.app.db.models import Dispute as DBDispute
from agent.app.domain.actions import BaseProposedAction, compute_action_hash
from agent.app.domain.enums import ActionType, ExecutionStatus, JobKind, TimelineEventKind, Verdict
from agent.app.ledger.service import record_decision, record_ledger_event
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.models import Dispute, parse_dispute
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.policy.charter import get_or_seed_charter, to_charter_response
from agent.app.policy.gate import GateDecision, GateInput, HistoryFlags, evaluate_gate
from agent.app.queue.payloads import ExecuteDecisionPayload
from agent.app.queue.queue import enqueue_job
from agent.app.store.base import StoreAdapter, StoreUnavailable
from agent.app.store.local_adapter import LocalStoreAdapter

logger = logging.getLogger(__name__)

MAX_ACTIONS_PER_PLAN = 2

MUTATING_TOOL_NAMES: frozenset[str] = frozenset({
    "refund",
    "cancel",
    "accept_dispute_claim",
    "capture",
    "void",
    "authorize",
})


@dataclass(frozen=True)
class AgentLoopResult:
    """Outcome of running the agent loop for a dispute."""

    status: str  # "completed", "skipped", "no_action", "failed"
    run_id: uuid.UUID
    dispute_id: str
    fingerprint: str
    actions_count: int = 0
    decisions: tuple[GateDecision, ...] = ()
    error: str | None = None
    human_needed: bool = False


def is_action_applicable_to_reason(action_type: ActionType | str, dispute_reason: str, dispute_status: str) -> bool:
    """Validate whether a proposed action is valid for the dispute reason and status."""
    atype = action_type.value if hasattr(action_type, "value") else str(action_type)
    r_str = dispute_reason.value if hasattr(dispute_reason, "value") else str(dispute_reason)
    s_str = dispute_status.value if hasattr(dispute_status, "value") else str(dispute_status)

    # Appeal is only applicable to resolved disputes
    if atype == ActionType.APPEAL.value:
        return s_str == "RESOLVED"

    # Evidence submission is only applicable for reasons the registry supports
    if atype == ActionType.PROVIDE_EVIDENCE.value:
        return is_supported(r_str)

    return True


def normalize_and_order_actions(actions: Sequence[BaseProposedAction]) -> list[BaseProposedAction]:
    """Deduplicate actions and ensure evidence actions precede message actions."""
    seen_hashes: set[str] = set()
    deduped: list[BaseProposedAction] = []

    for action in actions:
        act_hash = compute_action_hash(action)
        if act_hash not in seen_hashes:
            seen_hashes.add(act_hash)
            deduped.append(action)

    def sort_order(action: BaseProposedAction) -> int:
        atype = getattr(action, "action_type", None)
        if atype == ActionType.PROVIDE_EVIDENCE:
            return 0
        if atype == ActionType.SEND_MESSAGE:
            return 2
        return 1

    return sorted(deduped, key=sort_order)


async def load_dispute_via_read_tools(
    dispute_id: str,
    session: Session,
    read_client: PayPalReadClient | None = None,
) -> Dispute:
    """Load dispute context using strictly permitted read tools."""
    # Enforce read-tool allowlist check
    tool_name = "get_dispute"
    if tool_name not in READ_TOOL_NAMES:
        raise PermissionError(f"Tool '{tool_name}' is not in the read-only allowlist")

    if read_client is not None:
        return await get_dispute_tool(read_client, dispute_id=dispute_id)

    # Local fallback to DB snapshot when no PayPal client is injected
    db_dispute = session.get(DBDispute, dispute_id)
    if db_dispute is not None and db_dispute.snapshot:
        return parse_dispute(db_dispute.snapshot)

    raise ValueError(f"Dispute {dispute_id} not found via read tools or local cache")


async def run_agent_loop(
    session: Session,
    dispute_id: str,
    *,
    expected_fingerprint: str | None = None,
    read_client: PayPalReadClient | None = None,
    dispute: Dispute | None = None,
    llm_service: LLMService | None = None,
    run_id: uuid.UUID | None = None,
    now: datetime | None = None,
    charter_obj: Any | None = None,
    screener_enabled: bool = True,
    store_adapter: StoreAdapter | None = None,
) -> AgentLoopResult:
    """Run the plan-only agent loop for a dispute.

    1. Loads dispute via read tools only.
    2. Checks for stale fingerprint; skips if mismatched.
    3. Reuses deterministic run ID for crash recovery.
    4. Gathers context, builds evidence and prompt with quoted buyer text.
    5. Calls LLM and validates against AgentPlan schema.
    6. Filters mutating tool names and inapplicable actions.
    7. Deduplicates and orders actions (evidence before message).
    8. Routes whole plan to approval if action count exceeds limit.
    9. Passes actions to the gate; routes ALLOW to execute jobs,
       NEEDS_APPROVAL to approval creation, DENY to ledger.
    """
    now_dt = now or datetime.now(UTC)
    if now_dt.tzinfo is None:
        raise ValueError("Timezone-naive now is rejected; must be UTC")

    # Step 1: Load dispute through read tools only
    paypal_dispute = dispute
    if paypal_dispute is None:
        paypal_dispute = await load_dispute_via_read_tools(dispute_id, session, read_client)

    current_fingerprint = str(compute_dispute_fingerprint(paypal_dispute))

    # Stale fingerprint check: skip if job payload fingerprint is stale
    if expected_fingerprint is not None and expected_fingerprint != current_fingerprint:
        logger.info(
            "Skipping agent run for stale fingerprint (dispute=%s, expected=%s, current=%s)",
            dispute_id,
            expected_fingerprint[:8],
            current_fingerprint[:8],
        )
        return AgentLoopResult(
            status="skipped",
            run_id=run_id or uuid.uuid5(uuid.NAMESPACE_OID, f"run:{dispute_id}:{current_fingerprint}"),
            dispute_id=dispute_id,
            fingerprint=current_fingerprint,
        )

    # Crash safety: retry after a crash reuses the same deterministic run id
    effective_run_id = run_id or uuid.uuid5(
        uuid.NAMESPACE_OID,
        f"run:{dispute_id}:{current_fingerprint}:{PROMPT_VERSION}",
    )

    reason_attr = paypal_dispute.reason
    reason_val = reason_attr.value if hasattr(reason_attr, "value") else str(reason_attr)
    support = get_support(reason_val)

    # Unsupported reason: the agent never guesses. Stop before planning.
    if not isinstance(support, SupportedReason):
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.NO_ACTION,
            {
                "reason": "unsupported_reason",
                "message": f"Reason '{reason_val}' is not supported; human review is required.",
            },
        )
        session.commit()
        return AgentLoopResult(
            status="no_action",
            run_id=effective_run_id,
            dispute_id=dispute_id,
            fingerprint=current_fingerprint,
            human_needed=True,
        )

    # Context gathering: load store order context if transaction available
    tx_id: str | None = None
    transactions = getattr(paypal_dispute, "disputed_transactions", None) or []
    if transactions:
        tx_id = getattr(transactions[0], "seller_transaction_id", None)

    adapter = store_adapter or LocalStoreAdapter(session)
    order_context = None
    if tx_id:
        try:
            order_context = adapter.find_order(tx_id)
        except StoreUnavailable as exc:
            logger.error(
                "Store adapter unavailable for dispute %s (txn %s): %s. Failing closed to human review.",
                dispute_id,
                tx_id,
                exc,
            )
            record_ledger_event(
                session,
                dispute_id,
                TimelineEventKind.NO_ACTION,
                {
                    "reason": "store_unavailable",
                    "message": f"Store service unavailable: {exc}. Human review required.",
                },
            )
            session.commit()
            return AgentLoopResult(
                status="no_action",
                run_id=effective_run_id,
                dispute_id=dispute_id,
                fingerprint=current_fingerprint,
                human_needed=True,
                error=str(exc),
            )

    # Screen dispute and context for content injection attempts (Step 18)
    injection_flag = (
        screen_dispute_and_context(paypal_dispute, order_context)
        if screener_enabled
        else None
    )
    is_injection_flagged = bool(injection_flag and injection_flag.is_flagged)
    if is_injection_flagged and injection_flag:
        logger.warning(
            "Dispute %s content-injection flagged: signals=%s. Plan ignored; surfaces as needs human review.",
            dispute_id,
            injection_flag.signals,
        )
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.INJECTION_FLAGGED,
            {
                "rule_id": "G5-02",
                "signals": [s.value for s in injection_flag.signals],
                "reasons": list(injection_flag.reasons),
                "message": "Content-injection flag raised by screener; plan ignored; needs human review",
            },
        )

    # Build evidence if order context is present
    evidence = None
    if order_context is not None:
        evidence = build_evidence_for(reason_val, order_context, transaction_id=tx_id)

    # Supported reason whose required evidence is missing: no submission, human needed.
    if support.requires_buildable_evidence and (evidence is None or not evidence.buildable):
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.NO_ACTION,
            {
                "reason": "evidence_missing",
                "message": (
                    f"Required evidence for reason '{reason_val}' could not be built; "
                    "nothing was submitted and human review is required."
                ),
            },
        )
        session.commit()
        return AgentLoopResult(
            status="no_action",
            run_id=effective_run_id,
            dispute_id=dispute_id,
            fingerprint=current_fingerprint,
            human_needed=True,
        )

    # Build prompt with fixed rules and quoted/sanitized buyer text
    prompt_text, input_hash = build_agent_prompt(
        dispute=paypal_dispute,
        evidence=evidence,
        fingerprint=current_fingerprint,
    )

    # Record or reuse AgentRun
    model_str = getattr(getattr(llm_service, "provider", None), "model", None) or "default-model"

    existing_run = session.get(AgentRun, effective_run_id)
    if existing_run is None:
        agent_run = AgentRun(
            id=effective_run_id,
            dispute_id=dispute_id,
            model=model_str,
            prompt_version=PROMPT_VERSION,
            input_hash=input_hash,
            cache_hit=False,
        )
        session.add(agent_run)
    else:
        agent_run = existing_run
        agent_run.input_hash = input_hash
        agent_run.model = model_str
        agent_run.prompt_version = PROMPT_VERSION
    session.flush()

    record_ledger_event(
        session,
        dispute_id,
        TimelineEventKind.RUN_STARTED,
        {"run_id": str(effective_run_id), "prompt_version": PROMPT_VERSION, "input_hash": input_hash},
    )

    if evidence is not None and evidence.buildable:
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.EVIDENCE_BUILT,
            {
                "evidence_type": evidence.evidence_type,
                "tracking_count": len(evidence.tracking_info),
                "strength_score": evidence.strength.score,
                "strength_label": evidence.strength.label.value,
            },
        )

    # Call LLM
    if llm_service is None:
        raise ValueError("LLMService instance must be provided to run_agent_loop")

    llm_outcome = await llm_service.generate(
        prompt_text,
        input_hash=input_hash,
        prompt_version=PROMPT_VERSION,
        schema=AgentPlan,
    )

    # Handle LLM failure cases
    if isinstance(llm_outcome, LLMFailure):
        if llm_outcome.kind == LLMFailureKind.empty_plan:
            agent_run.plan = {"actions": []}
            record_ledger_event(
                session,
                dispute_id,
                TimelineEventKind.NO_ACTION,
                {"reason": "empty_plan", "message": "Model returned an empty plan"},
            )
            session.commit()
            return AgentLoopResult(
                status="no_action",
                run_id=effective_run_id,
                dispute_id=dispute_id,
                fingerprint=current_fingerprint,
            )

        agent_run.error = llm_outcome.message
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.RUN_FAILED,
            {"kind": llm_outcome.kind.value, "error": llm_outcome.message},
        )
        session.commit()
        return AgentLoopResult(
            status="failed",
            run_id=effective_run_id,
            dispute_id=dispute_id,
            fingerprint=current_fingerprint,
            error=llm_outcome.message,
        )

    # Successful LLM response
    validated_plan: AgentPlan = llm_outcome.plan  # type: ignore[assignment]
    agent_run.plan = validated_plan.model_dump(mode="json")
    agent_run.cache_hit = llm_outcome.cached
    session.flush()

    # Empty plan handling
    if not validated_plan.actions:
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.NO_ACTION,
            {"reason": "empty_plan", "message": "No actions proposed in plan"},
        )
        session.commit()
        return AgentLoopResult(
            status="no_action",
            run_id=effective_run_id,
            dispute_id=dispute_id,
            fingerprint=current_fingerprint,
        )

    # Validate individual actions against edge cases
    valid_domain_actions: list[BaseProposedAction] = []
    dispute_reason = paypal_dispute.reason
    dispute_status = paypal_dispute.status

    for action_schema in validated_plan.actions:
        # Check: model names a mutating tool (e.g. refund, cancel, accept_dispute_claim)
        raw_type = (
            action_schema.action_type.value
            if isinstance(action_schema.action_type, ActionType)
            else str(action_schema.action_type)
        )
        if raw_type.lower() in MUTATING_TOOL_NAMES:
            logger.warning(
                "Proposed action '%s' names a forbidden mutating tool. Rejected.",
                raw_type,
            )
            continue

        # Convert to domain action
        domain_action = action_schema.to_domain()

        # Check: action not applicable to dispute reason or status
        if not is_action_applicable_to_reason(domain_action.action_type, dispute_reason, dispute_status):
            logger.warning(
                "Action '%s' is not applicable to dispute reason '%s' (status '%s'). Rejected.",
                domain_action.action_type,
                dispute_reason,
                dispute_status,
            )
            continue

        valid_domain_actions.append(domain_action)

    if not valid_domain_actions:
        record_ledger_event(
            session,
            dispute_id,
            TimelineEventKind.NO_ACTION,
            {
                "reason": "all_actions_rejected",
                "message": "All proposed actions were rejected as inapplicable or mutating",
            },
        )
        session.commit()
        return AgentLoopResult(
            status="no_action",
            run_id=effective_run_id,
            dispute_id=dispute_id,
            fingerprint=current_fingerprint,
        )

    # Deduplicate and order actions: evidence before message
    ordered_actions = normalize_and_order_actions(valid_domain_actions)

    record_ledger_event(
        session,
        dispute_id,
        TimelineEventKind.PLAN_PROPOSED,
        {
            "action_types": [a.action_type.value for a in ordered_actions],
            "count": len(ordered_actions),
        },
    )

    # Edge case: Too many actions -> whole plan routed to approval
    too_many_actions = len(ordered_actions) > MAX_ACTIONS_PER_PLAN
    if too_many_actions:
        logger.info(
            "Plan contains %d actions exceeding max limit %d; whole plan routed to approval.",
            len(ordered_actions),
            MAX_ACTIONS_PER_PLAN,
        )

    # Load active charter
    charter_entity = charter_obj
    if charter_entity is None:
        db_charter = get_or_seed_charter(session, merchant_id="default")
        charter_entity = to_charter_response(db_charter)

    # History flags
    buyer_history = count_buyer_disputes(
        session,
        paypal_dispute,
        now=now_dt,
        fallback_count=order_context.buyer_prior_disputes if order_context else 0,
    )
    history_flags = HistoryFlags(
        buyer_dispute_count_in_window=buyer_history.prior_disputes,
        injection_flag=is_injection_flagged,
    )

    # Prior confirmed executions
    prior_exec_stmt = (
        select(Decision.action_hash)
        .join(Execution, Execution.decision_id == Decision.id)
        .where(
            Decision.dispute_id == dispute_id,
            Execution.status == ExecutionStatus.CONFIRMED.value,
        )
    )
    prior_hashes = tuple(session.execute(prior_exec_stmt).scalars().all())

    # Pass every proposed action to the gate
    gate_decisions: list[GateDecision] = []

    for action in ordered_actions:
        gate_input = GateInput(
            action=action,
            dispute=paypal_dispute,
            charter=charter_entity,
            now=now_dt,
            history_flags=history_flags,
            prior_executions=prior_hashes,
        )

        decision = evaluate_gate(gate_input)

        # If too many actions, override verdict to NEEDS_APPROVAL
        if too_many_actions and decision.verdict == Verdict.ALLOW:
            verdict_to_record = Verdict.NEEDS_APPROVAL
            rule_id_to_record = "G0-00"
            n, mx = len(ordered_actions), MAX_ACTIONS_PER_PLAN
            reason_to_record = f"Action routed to approval: plan contains {n} actions (max {mx})"
        else:
            verdict_to_record = decision.verdict
            rule_id_to_record = decision.rule_id
            reason_to_record = decision.reason

        recorded_dec = record_decision(
            session=session,
            dispute_id=dispute_id,
            action_type=action.action_type,
            action_payload=action.model_dump(mode="json"),
            verdict=verdict_to_record,
            rule_id=rule_id_to_record,
            reason=reason_to_record,
            action_hash=decision.action_hash,
            dispute_fingerprint=decision.dispute_fingerprint,
            charter_version=decision.charter_version,
            also_triggered=decision.also_triggered,
            emit_ledger_event=True,
        )

        # Routing based on verdict:
        # ALLOW -> route to execute job
        # NEEDS_APPROVAL -> route to approval creation (Step 19)
        # DENY -> recorded in ledger (via record_decision)
        if verdict_to_record == Verdict.ALLOW:
            enqueue_job(
                session=session,
                kind=JobKind.EXECUTE_DECISION,
                payload=ExecuteDecisionPayload(
                    decision_id=str(recorded_dec.id),
                ),
            )
        elif verdict_to_record == Verdict.NEEDS_APPROVAL:
            create_approval(
                session=session,
                decision=recorded_dec,
                dispute=paypal_dispute,
                now=now_dt,
            )

        gate_decisions.append(decision)

    session.commit()

    return AgentLoopResult(
        status="completed",
        run_id=effective_run_id,
        dispute_id=dispute_id,
        fingerprint=current_fingerprint,
        actions_count=len(ordered_actions),
        decisions=tuple(gate_decisions),
    )
