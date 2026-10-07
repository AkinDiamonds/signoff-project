"""Domain enumerations and database CHECK constraint generators.

All domain enumerations are defined in this single module per Step 03 conventions.
Database CHECK constraints are generated dynamically from these enums.
"""

from enum import StrEnum

from sqlalchemy import CheckConstraint


class Verdict(StrEnum):
    """Gate decision verdict."""

    ALLOW = "ALLOW"
    NEEDS_APPROVAL = "NEEDS_APPROVAL"
    DENY = "DENY"


class ActionType(StrEnum):
    """Proposed action type for PayPal disputes."""

    PROVIDE_EVIDENCE = "PROVIDE_EVIDENCE"
    SEND_MESSAGE = "SEND_MESSAGE"
    MAKE_OFFER = "MAKE_OFFER"
    ACCEPT_CLAIM = "ACCEPT_CLAIM"
    ESCALATE = "ESCALATE"
    APPEAL = "APPEAL"


class DisputeReason(StrEnum):
    """PayPal dispute reason categories."""

    MERCHANDISE_OR_SERVICE_NOT_RECEIVED = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
    MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED = "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
    UNAUTHORISED = "UNAUTHORISED"
    CREDIT_NOT_PROCESSED = "CREDIT_NOT_PROCESSED"
    DUPLICATE_TRANSACTION = "DUPLICATE_TRANSACTION"
    INCORRECT_AMOUNT = "INCORRECT_AMOUNT"
    PAYMENT_BY_OTHER_MEANS = "PAYMENT_BY_OTHER_MEANS"
    CANCELED_RECURRING_BILLING = "CANCELED_RECURRING_BILLING"
    PROBLEM_WITH_REMITTANCE = "PROBLEM_WITH_REMITTANCE"
    OTHER = "OTHER"


class DisputeStatus(StrEnum):
    """Denormalized PayPal dispute status."""

    WAITING_FOR_SELLER_RESPONSE = "WAITING_FOR_SELLER_RESPONSE"
    WAITING_FOR_BUYER_RESPONSE = "WAITING_FOR_BUYER_RESPONSE"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    OPEN = "OPEN"
    OTHER = "OTHER"


class ExecutionStatus(StrEnum):
    """Executor write-ahead protocol status."""

    INTENDED = "INTENDED"
    SENT = "SENT"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class JobKind(StrEnum):
    """Postgres queue job kinds."""

    SYNC_DISPUTE = "sync_dispute"
    RUN_AGENT = "run_agent"
    EXECUTE_DECISION = "execute_decision"
    RECONCILE = "reconcile"
    EXPIRE_APPROVALS = "expire_approvals"


class JobStatus(StrEnum):
    """Queue job lifecycle status."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DEAD_LETTER = "DEAD_LETTER"


class ApprovalResolution(StrEnum):
    """Approval card resolution status."""

    PENDING = "PENDING"
    APPROVE = "APPROVE"
    DENY = "DENY"
    EDIT = "EDIT"
    EXPIRED = "EXPIRED"


class TimelineEventKind(StrEnum):
    """Audit and timeline event kinds for dispute ledger."""

    WEBHOOK_RECEIVED = "WEBHOOK_RECEIVED"
    DISPUTE_SYNCED = "DISPUTE_SYNCED"
    RUN_STARTED = "RUN_STARTED"
    EVIDENCE_BUILT = "EVIDENCE_BUILT"
    PLAN_PROPOSED = "PLAN_PROPOSED"
    GATE_DECIDED = "GATE_DECIDED"
    APPROVAL_REQUESTED = "APPROVAL_REQUESTED"
    APPROVAL_RESOLVED = "APPROVAL_RESOLVED"
    EXECUTION_INTENDED = "EXECUTION_INTENDED"
    EXECUTION_SENT = "EXECUTION_SENT"
    EXECUTION_CONFIRMED = "EXECUTION_CONFIRMED"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    INJECTION_FLAGGED = "INJECTION_FLAGGED"
    NO_ACTION = "NO_ACTION"
    RUN_FAILED = "RUN_FAILED"


class OrderStatus(StrEnum):
    """Mock store order status."""

    PENDING = "PENDING"
    PAID = "PAID"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    DISPUTED = "DISPUTED"


class TrackingStatus(StrEnum):
    """Mock store shipment tracking status."""

    PRE_TRANSIT = "PRE_TRANSIT"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RETURNED = "RETURNED"
    EXCEPTION = "EXCEPTION"


class EvidenceStrengthLabel(StrEnum):
    """Evidence strength label (never win or probability)."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class LLMMode(StrEnum):
    """LLM operating mode."""

    LIVE = "LIVE"
    CACHED = "CACHED"
    UNAVAILABLE = "UNAVAILABLE"


def generate_enum_check_constraint(
    column_name: str,
    enum_cls: type[StrEnum],
    name: str | None = None,
) -> CheckConstraint:
    """Generate a database CHECK constraint from a Python StrEnum.

    Ensures the database layer strictly enforces allowed enum values and keeps
    parity with domain types without manually writing literal SQL expressions.
    """
    values = [e.value for e in enum_cls]
    formatted_values = ", ".join(f"'{v}'" for v in values)
    constraint_name = name or f"ck_{column_name}_{enum_cls.__name__.lower()}"
    return CheckConstraint(f"{column_name} IN ({formatted_values})", name=constraint_name)


ALL_DOMAIN_ENUMS: dict[str, type[StrEnum]] = {
    "verdict": Verdict,
    "action_type": ActionType,
    "dispute_reason": DisputeReason,
    "dispute_status": DisputeStatus,
    "execution_status": ExecutionStatus,
    "job_kind": JobKind,
    "job_status": JobStatus,
    "approval_resolution": ApprovalResolution,
    "timeline_event_kind": TimelineEventKind,
    "order_status": OrderStatus,
    "tracking_status": TrackingStatus,
    "evidence_strength_label": EvidenceStrengthLabel,
    "llm_mode": LLMMode,
}
