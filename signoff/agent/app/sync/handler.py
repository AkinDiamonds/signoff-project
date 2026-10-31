"""Dispute synchronization handler.

Fulfills Step 09 requirements:
1. Fetches full dispute snapshot from PayPal via PayPalReadClient.
2. Parses snapshot, stores/updates local Dispute record.
3. Computes deterministic state fingerprint.
4. Writes a DISPUTE_SYNCED ledger event whenever the state fingerprint changes.
5. If the fingerprint changed and status requires seller response, enqueues exactly one
   RUN_AGENT job keyed by dispute and fingerprint (coalescing existing pending jobs).
6. If the dispute is resolved, cancels any pending RUN_AGENT jobs.
7. Handles 404 (upstream dispute disappeared): marks record unavailable and preserves history.
"""

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, DemoPool, Dispute, Job, LedgerEvent, Order
from agent.app.domain.enums import JobKind, JobStatus, TimelineEventKind
from agent.app.errors import NotFoundError
from agent.app.paypal.fingerprint import compute_dispute_fingerprint
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.settings import AppEnv, Settings
from agent.app.sync.state import (
    is_dispute_resolved,
    map_dispute_state_to_db_status,
    map_paypal_reason,
    map_paypal_status_to_dispute_state,
    requires_seller_response,
)

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Outcome of a dispute sync operation."""

    dispute_id: str
    fingerprint: str | None
    status: str | None
    fingerprint_changed: bool
    agent_run_enqueued: bool = False
    pending_runs_canceled: int = 0
    is_unavailable: bool = False
    error: str | None = None


def _infer_scenario_label(dispute_id: str, dispute_model: Any, session: Session) -> str:
    """Infer a judge-friendly scenario label from bound orders or dispute reason."""
    seller_txn_id = None
    if getattr(dispute_model, "disputed_transactions", None):
        for tx in dispute_model.disputed_transactions:
            if getattr(tx, "seller_transaction_id", None):
                seller_txn_id = tx.seller_transaction_id
                break

    if seller_txn_id:
        order = session.scalar(select(Order).where(Order.paypal_transaction_id == seller_txn_id).limit(1))
        if order and order.order_code:
            code = order.order_code.upper()
            if "-A-" in code:
                return "Delivered with tracking — the agent fights this one"
            if "-B-" in code:
                return "In transit — the agent tracks shipment status"
            if "-C-" in code:
                return "Larger than your limit — needs your approval"
            if "-D-" in code:
                return "Prompt injection attempt — the guardrail catches it"
            if "-E-" in code:
                return "Repeat disputer — history flag flagged for review"

    reason = getattr(dispute_model, "reason", "") or ""
    if "NOT_AS_DESCRIBED" in reason:
        return "Not as described — policy and return review"
    if "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" in reason:
        return "Item not received — tracking and delivery review"
    return "Standard dispute — automated agent evaluation"


async def sync_dispute(
    dispute_id: str,
    session: Session,
    paypal_client: PayPalReadClient,
    event_id: str | None = None,
    event_type: str | None = None,
    settings: Settings | None = None,
) -> SyncResult:
    """Synchronize local dispute state with PayPal.

    Performs snapshot persistence, fingerprinting, ledger event logging,
    and agent run queueing/cancellation.
    """
    clean_id = dispute_id.strip()

    # 1. Fetch dispute snapshot from PayPal
    try:
        dispute_model = await paypal_client.get_dispute(clean_id)
    except NotFoundError as err:
        logger.warning("PayPal dispute %s returned 404 Not Found", clean_id)
        # Handle 404: mark unavailable if known, retain audit history
        existing = session.get(Dispute, clean_id)
        if existing:
            snapshot = existing.snapshot if isinstance(existing.snapshot, dict) else {}
            was_unavailable = snapshot.get("unavailable") is True
            existing.snapshot = {
                **snapshot,
                "unavailable": True,
                "not_found_reason": "Upstream 404 Not Found",
            }
            # Cancel any pending agent runs
            canceled_count = 0
            pending_jobs = session.execute(
                select(Job).where(
                    Job.dispute_id == clean_id,
                    Job.kind == JobKind.RUN_AGENT.value,
                    Job.status == JobStatus.PENDING.value,
                )
            ).scalars().all()
            for p_job in pending_jobs:
                p_job.status = JobStatus.DEAD_LETTER.value
                p_job.last_error = "Dispute not found on PayPal (404); pending run canceled"
                canceled_count += 1

            if not was_unavailable:
                stmt = select(func.coalesce(func.max(LedgerEvent.sequence_number), 0)).where(
                    LedgerEvent.dispute_id == clean_id
                )
                next_seq = (session.scalar(stmt) or 0) + 1
                ledger_event = LedgerEvent(
                    dispute_id=clean_id,
                    sequence_number=next_seq,
                    event_kind=TimelineEventKind.DISPUTE_SYNCED.value,
                    payload={
                        "status": "UNAVAILABLE",
                        "error": "NOT_FOUND_ON_UPSTREAM",
                        "event_id": event_id,
                        "event_type": event_type,
                    },
                )
                session.add(ledger_event)

            session.flush()
            return SyncResult(
                dispute_id=clean_id,
                fingerprint=existing.state_fingerprint,
                status="UNAVAILABLE",
                fingerprint_changed=not was_unavailable,
                is_unavailable=True,
                pending_runs_canceled=canceled_count,
            )

        return SyncResult(
            dispute_id=clean_id,
            fingerprint=None,
            status=None,
            fingerprint_changed=False,
            is_unavailable=True,
            error=str(err),
        )

    # 2. Compute deterministic state fingerprint
    new_fingerprint = compute_dispute_fingerprint(dispute_model)
    fp_str = str(new_fingerprint)

    # 3. Map status and reason to domain enums
    dispute_state = map_paypal_status_to_dispute_state(dispute_model.status)
    db_status = map_dispute_state_to_db_status(dispute_state)
    db_reason = map_paypal_reason(dispute_model.reason)
    amount_val = dispute_model.dispute_amount.value
    currency_val = dispute_model.dispute_amount.currency_code
    snapshot_json = dispute_model.model_dump(mode="json")

    # 4. Check existing record
    existing_record = session.get(Dispute, clean_id)
    fingerprint_changed = existing_record is None or (existing_record.state_fingerprint != fp_str)
    if not fingerprint_changed:
        # Disputes pre-stored by the demo generator have never been synced: treat the first sync as a change.
        fingerprint_changed = session.scalar(
            select(LedgerEvent.id)
            .where(
                LedgerEvent.dispute_id == clean_id,
                LedgerEvent.event_kind == TimelineEventKind.DISPUTE_SYNCED.value,
            )
            .limit(1)
        ) is None

    if existing_record is None:
        dispute_row = Dispute(
            id=clean_id,
            state_fingerprint=fp_str,
            status=db_status.value,
            reason=db_reason.value,
            amount=amount_val,
            currency=currency_val,
            seller_response_due_date=dispute_model.seller_response_due_date,
            snapshot=snapshot_json,
        )
        session.add(dispute_row)
        session.flush()
        logger.info(
            "Created local dispute %s (status=%s, fingerprint=%s)",
            clean_id,
            db_status.value,
            fp_str[:8],
        )
    else:
        existing_record.state_fingerprint = fp_str
        existing_record.status = db_status.value
        existing_record.reason = db_reason.value
        existing_record.amount = amount_val
        existing_record.currency = currency_val
        existing_record.seller_response_due_date = dispute_model.seller_response_due_date
        existing_record.snapshot = snapshot_json
        session.flush()
        logger.info(
            "Updated local dispute %s (status=%s, fingerprint_changed=%s)",
            clean_id,
            db_status.value,
            fingerprint_changed,
        )

    agent_run_enqueued = False
    pending_runs_canceled = 0

    # 5. On state fingerprint change: write ledger event and trigger actions
    if fingerprint_changed:
        stmt = select(func.coalesce(func.max(LedgerEvent.sequence_number), 0)).where(
            LedgerEvent.dispute_id == clean_id
        )
        next_seq = (session.scalar(stmt) or 0) + 1

        ledger_payload = {
            "fingerprint": fp_str,
            "status": db_status.value,
            "reason": db_reason.value,
            "amount": f"{amount_val:.2f}",
            "currency": currency_val,
            "event_id": event_id,
            "event_type": event_type,
            "seller_response_due_date": (
                dispute_model.seller_response_due_date.isoformat()
                if dispute_model.seller_response_due_date
                else None
            ),
        }
        ledger_event = LedgerEvent(
            dispute_id=clean_id,
            sequence_number=next_seq,
            event_kind=TimelineEventKind.DISPUTE_SYNCED.value,
            payload=ledger_payload,
        )
        session.add(ledger_event)
        session.flush()

        # Enqueue agent run if seller response required
        if requires_seller_response(dispute_state):
            app_settings = settings or Settings()
            # Judge-claim pooling is a rehearsal fixture, never a prerequisite
            # for the normal merchant webhook -> agent -> policy-gate journey.
            if app_settings.demo_hold_disputes and app_settings.app_env != AppEnv.prod:
                pool_row = session.get(DemoPool, clean_id)
                if pool_row is None:
                    has_been_processed = session.scalar(
                        select(Decision.id).where(Decision.dispute_id == clean_id).limit(1)
                    ) is not None or session.scalar(
                        select(LedgerEvent.id).where(
                            LedgerEvent.dispute_id == clean_id,
                            LedgerEvent.event_kind.in_([
                                TimelineEventKind.RUN_STARTED.value,
                                TimelineEventKind.GATE_DECIDED.value,
                            ]),
                        ).limit(1)
                    ) is not None

                    if not has_been_processed:
                        scenario_label = _infer_scenario_label(clean_id, dispute_model, session)
                        pool_row = DemoPool(
                            dispute_id=clean_id,
                            state="pooled",
                            scenario_label=scenario_label,
                        )
                        session.add(pool_row)
                        next_seq += 1
                        hold_event = LedgerEvent(
                            dispute_id=clean_id,
                            sequence_number=next_seq,
                            event_kind=TimelineEventKind.DISPUTE_POOLED.value,
                            payload={
                                "status": db_status.value,
                                "reason": db_reason.value,
                                "message": "Dispute held in demo pool awaiting judge claim",
                            },
                        )
                        session.add(hold_event)
                        session.flush()
                        logger.info("Dispute %s held in demo pool with state pooled", clean_id)
                        return SyncResult(
                            dispute_id=clean_id,
                            fingerprint=fp_str,
                            status=db_status.value,
                            fingerprint_changed=fingerprint_changed,
                            agent_run_enqueued=False,
                            pending_runs_canceled=pending_runs_canceled,
                        )
                elif pool_row.state in ("pooled", "done"):
                    logger.info(
                        "Dispute %s in demo pool with state %s; skipping RUN_AGENT enqueue",
                        clean_id,
                        pool_row.state,
                    )
                    return SyncResult(
                        dispute_id=clean_id,
                        fingerprint=fp_str,
                        status=db_status.value,
                        fingerprint_changed=fingerprint_changed,
                        agent_run_enqueued=False,
                        pending_runs_canceled=pending_runs_canceled,
                    )

            # Check for existing pending run_agent job to coalesce
            existing_run_job = session.execute(
                select(Job).where(
                    Job.dispute_id == clean_id,
                    Job.kind == JobKind.RUN_AGENT.value,
                    Job.status == JobStatus.PENDING.value,
                )
            ).scalar_one_or_none()

            run_payload = {
                "dispute_id": clean_id,
                "fingerprint": fp_str,
            }

            if existing_run_job:
                # Update payload to latest fingerprint
                existing_run_job.payload = run_payload
                logger.info(
                    "Coalesced pending RUN_AGENT job %s for dispute %s with fingerprint %s",
                    existing_run_job.id,
                    clean_id,
                    fp_str[:8],
                )
            else:
                run_job = Job(
                    kind=JobKind.RUN_AGENT.value,
                    dispute_id=clean_id,
                    status=JobStatus.PENDING.value,
                    payload=run_payload,
                )
                session.add(run_job)
                logger.info(
                    "Enqueued new RUN_AGENT job for dispute %s with fingerprint %s",
                    clean_id,
                    fp_str[:8],
                )
            agent_run_enqueued = True
            session.flush()

    # 6. If dispute is resolved, cancel any pending agent runs and mark pool row done
    if is_dispute_resolved(dispute_state):
        pool_row = session.get(DemoPool, clean_id)
        if pool_row and pool_row.state != "done":
            pool_row.state = "done"
            session.flush()
        pending_jobs = session.execute(
            select(Job).where(
                Job.dispute_id == clean_id,
                Job.kind == JobKind.RUN_AGENT.value,
                Job.status == JobStatus.PENDING.value,
            )
        ).scalars().all()

        for p_job in pending_jobs:
            p_job.status = JobStatus.DEAD_LETTER.value
            p_job.last_error = "Dispute resolved; pending run canceled"
            pending_runs_canceled += 1

        if pending_runs_canceled > 0:
            logger.info(
                "Canceled %d pending RUN_AGENT job(s) for resolved dispute %s",
                pending_runs_canceled,
                clean_id,
            )
            session.flush()

    return SyncResult(
        dispute_id=clean_id,
        fingerprint=fp_str,
        status=db_status.value,
        fingerprint_changed=fingerprint_changed,
        agent_run_enqueued=agent_run_enqueued,
        pending_runs_canceled=pending_runs_canceled,
    )
