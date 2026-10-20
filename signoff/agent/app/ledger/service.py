"""Ledger service recording append-only decisions and timeline events per dispute.

Per Step 14 and contracts.md:
- Per-dispute sequential numbering: sequence_number >= 1.
- Order is by sequence_number, never by timestamp.
- Cursor pagination.
- Untrusted text is truncated and flagged in API output.
"""

import base64
import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agent.app.db.models import Decision, Dispute, LedgerEvent
from agent.app.domain.enums import ActionType, TimelineEventKind, Verdict
from agent.app.errors import NotFoundError
from agent.app.ledger.sanitizer import (
    sanitize_payload_dict,
    sanitize_untrusted_text,
)


def record_ledger_event(
    session: Session,
    dispute_id: str,
    event_kind: TimelineEventKind | str,
    payload: dict[str, Any],
) -> LedgerEvent:
    """Append a ledger event with atomic per-dispute sequential numbering.

    Uses SELECT ... FOR UPDATE (via with_for_update()) to prevent a race where
    two concurrent sessions read the same MAX(sequence_number) and both try to
    insert the same sequence number.  The UNIQUE constraint is a safety net, but
    this lock makes the conflict impossible rather than letting it surface as an
    IntegrityError.
    """
    stmt = (
        select(func.coalesce(func.max(LedgerEvent.sequence_number), 0))
        .where(LedgerEvent.dispute_id == dispute_id)
        .with_for_update()
    )
    next_seq = (session.scalar(stmt) or 0) + 1

    kind_str = event_kind.value if hasattr(event_kind, "value") else str(event_kind)
    event = LedgerEvent(
        dispute_id=dispute_id,
        sequence_number=next_seq,
        event_kind=kind_str,
        payload=payload,
    )
    session.add(event)
    session.flush()
    return event


def record_decision(
    session: Session,
    dispute_id: str,
    action_type: ActionType | str,
    action_payload: dict[str, Any] | None,
    verdict: Verdict | str,
    rule_id: str,
    reason: str,
    action_hash: str,
    dispute_fingerprint: str,
    charter_version: int,
    also_triggered: Sequence[str] | None = None,
    decision_id: uuid.UUID | None = None,
    emit_ledger_event: bool = True,
) -> Decision:
    """Record an immutable gate decision and optionally emit a GATE_DECIDED ledger event."""
    action_type_str = action_type.value if hasattr(action_type, "value") else str(action_type)
    verdict_str = verdict.value if hasattr(verdict, "value") else str(verdict)

    dec_id = decision_id or uuid.uuid5(
        uuid.NAMESPACE_OID,
        f"{dispute_id}:{action_hash}:{dispute_fingerprint}",
    )

    existing = session.execute(select(Decision).where(Decision.id == dec_id)).scalar_one_or_none()
    if existing is not None:
        return existing

    decision = Decision(
        id=dec_id,
        dispute_id=dispute_id,
        action_type=action_type_str,
        action_payload=action_payload,
        verdict=verdict_str,
        rule_id=rule_id,
        reason=reason,
        also_triggered=list(also_triggered) if also_triggered else [],
        action_hash=action_hash,
        dispute_fingerprint=dispute_fingerprint,
        charter_version=charter_version,
    )
    session.add(decision)
    session.flush()

    if emit_ledger_event:
        record_ledger_event(
            session=session,
            dispute_id=dispute_id,
            event_kind=TimelineEventKind.GATE_DECIDED,
            payload={
                "verdict": verdict_str,
                "rule_id": rule_id,
                "action_type": action_type_str,
                "reason": reason,
            },
        )

    return decision


def check_dispute_exists(session: Session, dispute_id: str) -> None:
    """Ensure dispute is known; raises NotFoundError if unknown."""
    dispute = session.execute(select(Dispute).where(Dispute.id == dispute_id)).scalar_one_or_none()
    if dispute is not None:
        return

    # Check if any events or decisions exist for this dispute
    has_event = session.execute(
        select(LedgerEvent.id).where(LedgerEvent.dispute_id == dispute_id).limit(1)
    ).scalar_one_or_none()
    if has_event is not None:
        return

    has_decision = session.execute(
        select(Decision.id).where(Decision.dispute_id == dispute_id).limit(1)
    ).scalar_one_or_none()
    if has_decision is not None:
        return

    raise NotFoundError(f"Dispute '{dispute_id}' not found")


def get_timeline_events(
    session: Session,
    dispute_id: str,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """Retrieve timeline events ordered strictly by sequence_number with cursor pagination.

    Untrusted text is truncated and flagged with is_truncated=True.
    Unknown event kinds are returned as-is with their kind and payload.
    """
    check_dispute_exists(session, dispute_id)

    stmt = select(LedgerEvent).where(LedgerEvent.dispute_id == dispute_id)

    if cursor is not None:
        try:
            cursor_seq = int(cursor)
            stmt = stmt.where(LedgerEvent.sequence_number > cursor_seq)
        except ValueError:
            pass  # Fall back to starting from beginning if invalid cursor

    # Rule: Order is by sequence number, never by timestamp
    stmt = stmt.order_by(LedgerEvent.sequence_number.asc()).limit(limit + 1)
    rows = list(session.scalars(stmt).all())

    has_more = len(rows) > limit
    items_to_return = rows[:limit] if has_more else rows
    next_cursor = str(items_to_return[-1].sequence_number) if (has_more and items_to_return) else None

    results: list[dict[str, Any]] = []
    for row in items_to_return:
        sanitized_payload, was_truncated = sanitize_payload_dict(row.payload)

        # Base fields common to all timeline events
        event_dict: dict[str, Any] = {
            "id": str(row.id),
            "dispute_id": row.dispute_id,
            "sequence_number": row.sequence_number,
            "created_at": row.recorded_at.isoformat(),
            "kind": row.event_kind,
            "is_truncated": was_truncated,
        }

        # Merge specific documented fields according to event kind
        kind = row.event_kind
        if kind == TimelineEventKind.WEBHOOK_RECEIVED.value:
            event_dict["payload"] = sanitized_payload
        elif kind == TimelineEventKind.DISPUTE_SYNCED.value:
            event_dict["status"] = sanitized_payload.get("status", "")
        elif kind == TimelineEventKind.RUN_STARTED.value:
            event_dict["run_id"] = str(sanitized_payload.get("run_id", ""))
        elif kind == TimelineEventKind.EVIDENCE_BUILT.value:
            event_dict["evidence_strength"] = sanitized_payload.get("evidence_strength", "medium")
        elif kind == TimelineEventKind.PLAN_PROPOSED.value:
            event_dict["action_type"] = sanitized_payload.get("action_type", "")
        elif kind == TimelineEventKind.GATE_DECIDED.value:
            event_dict["verdict"] = sanitized_payload.get("verdict", "")
            event_dict["rule_id"] = sanitized_payload.get("rule_id", "")
        elif kind == TimelineEventKind.APPROVAL_REQUESTED.value:
            event_dict["token_hash"] = sanitized_payload.get("token_hash", "")
        elif kind == TimelineEventKind.APPROVAL_RESOLVED.value:
            event_dict["resolution"] = sanitized_payload.get("resolution", "")
        elif kind == TimelineEventKind.EXECUTION_INTENDED.value:
            event_dict["action_type"] = sanitized_payload.get("action_type", "")
        elif kind == TimelineEventKind.EXECUTION_SENT.value:
            event_dict["payload"] = sanitized_payload
        elif kind == TimelineEventKind.EXECUTION_CONFIRMED.value:
            event_dict["external_id"] = str(sanitized_payload.get("external_id", ""))
        elif kind == TimelineEventKind.EXECUTION_FAILED.value:
            err_msg, err_trunc = sanitize_untrusted_text(str(sanitized_payload.get("error_message", "")))
            event_dict["error_message"] = err_msg
            if err_trunc:
                event_dict["is_truncated"] = True
        elif kind == TimelineEventKind.INJECTION_FLAGGED.value:
            event_dict["rule_id"] = sanitized_payload.get("rule_id", "")
        elif kind == TimelineEventKind.NO_ACTION.value:
            reason_msg, reason_trunc = sanitize_untrusted_text(str(sanitized_payload.get("reason", "")))
            event_dict["reason"] = reason_msg
            if reason_trunc:
                event_dict["is_truncated"] = True
        elif kind == TimelineEventKind.RUN_FAILED.value:
            err_msg, err_trunc = sanitize_untrusted_text(str(sanitized_payload.get("error", "")))
            event_dict["error"] = err_msg
            if err_trunc:
                event_dict["is_truncated"] = True
        else:
            # Unknown event kind: returned as-is with their kind and payload
            event_dict["payload"] = sanitized_payload

        results.append(event_dict)

    return results, next_cursor


def encode_decision_cursor(dt: datetime, uid: uuid.UUID) -> str:
    """Encode created_at and id into opaque base64 cursor."""
    raw = f"{dt.isoformat()}|{uid}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_decision_cursor(cursor_str: str) -> tuple[datetime, uuid.UUID] | None:
    """Decode base64 cursor into created_at and id."""
    try:
        raw = base64.urlsafe_b64decode(cursor_str.encode()).decode()
        ts_str, id_str = raw.split("|", 1)
        return datetime.fromisoformat(ts_str), uuid.UUID(id_str)
    except Exception:
        return None


def get_decisions(
    session: Session,
    dispute_id: str,
    limit: int = 50,
    cursor: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """Retrieve decisions for a dispute with cursor pagination."""
    check_dispute_exists(session, dispute_id)

    stmt = select(Decision).where(Decision.dispute_id == dispute_id)

    if cursor is not None:
        decoded = decode_decision_cursor(cursor)
        if decoded is not None:
            c_dt, c_id = decoded
            stmt = stmt.where(
                (Decision.created_at > c_dt) | ((Decision.created_at == c_dt) & (Decision.id > c_id))
            )

    stmt = stmt.order_by(Decision.created_at.asc(), Decision.id.asc()).limit(limit + 1)
    rows = list(session.scalars(stmt).all())

    has_more = len(rows) > limit
    items_to_return = rows[:limit] if has_more else rows
    next_cursor = (
        encode_decision_cursor(items_to_return[-1].created_at, items_to_return[-1].id)
        if (has_more and items_to_return)
        else None
    )

    results: list[dict[str, Any]] = []
    for row in items_to_return:
        reason_sanitized, reason_trunc = sanitize_untrusted_text(row.reason)
        payload_sanitized, payload_trunc = sanitize_payload_dict(row.action_payload)
        was_truncated = reason_trunc or payload_trunc

        results.append(
            {
                "id": str(row.id),
                "dispute_id": row.dispute_id,
                "action_type": row.action_type,
                "action_payload": payload_sanitized,
                "verdict": row.verdict,
                "rule_id": row.rule_id,
                "reason": reason_sanitized,
                "also_triggered": list(row.also_triggered) if row.also_triggered else [],
                "action_hash": row.action_hash,
                "dispute_fingerprint": row.dispute_fingerprint,
                "charter_version": row.charter_version,
                "created_at": row.created_at.isoformat(),
                "is_truncated": was_truncated,
            }
        )

    return results, next_cursor
