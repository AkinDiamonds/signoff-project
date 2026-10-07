"""SQLAlchemy 2 declarative models for Signoff database schema.

Enforces schema contracts, append-only triggers, unique constraints,
and fixed-precision numeric constraints as specified in Step 03.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from agent.app.db.base import Base
from agent.app.domain.enums import (
    ActionType,
    ApprovalResolution,
    DisputeReason,
    DisputeStatus,
    ExecutionStatus,
    JobKind,
    JobStatus,
    OrderStatus,
    TimelineEventKind,
    TrackingStatus,
    Verdict,
    generate_enum_check_constraint,
)

# Portable JSON type: Postgres uses JSONB, SQLite uses JSON
JSONType = JSON().with_variant(JSONB, "postgresql")


class WebhookEvent(Base):
    """Raw PayPal webhook event log for signature verification and deduplication."""

    __tablename__ = "webhook_events"

    # PayPal event id (e.g. WH-...)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    transmission_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Job(Base):
    """Postgres background job queue with skip-locked leasing and concurrency limits."""

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    dispute_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default=JobStatus.PENDING.value, nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_after: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        generate_enum_check_constraint("kind", JobKind),
        generate_enum_check_constraint("status", JobStatus),
        # Safety constraint: exactly one pending job per dispute and kind
        Index(
            "uq_jobs_pending_dispute_kind",
            "dispute_id",
            "kind",
            unique=True,
            postgresql_where=(text("status = 'PENDING'")),
        ),
    )


class Dispute(Base):
    """Denormalized cache of PayPal dispute state and dispute snapshot."""

    __tablename__ = "disputes"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)  # PayPal dispute id
    state_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    seller_response_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    demo_session_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @validates("amount")
    def validate_amount(self, key: str, value: Any) -> Decimal:
        """Reject float values, None, non-finite values, and decimals with more than 2 decimal places."""
        if value is None:
            raise ValueError(f"{key} cannot be None.")
        if isinstance(value, float):
            raise TypeError(f"Floating point values are strictly forbidden for {key}; use Decimal.")
        try:
            d = Decimal(str(value))
        except Exception as exc:
            raise ValueError(f"Invalid decimal value for {key}: {value}") from exc
        if not d.is_finite():
            raise ValueError(f"Non-finite decimal values (Infinity, NaN) are not allowed for {key}: {value}")
        exponent = d.as_tuple().exponent
        if not isinstance(exponent, int):
            raise ValueError(f"Invalid decimal exponent for {key}: {value}")
        if exponent < -2:
            raise ValueError(f"Values with more than two decimals are rejected for {key}: {value}")
        return d


    __table_args__ = (
        generate_enum_check_constraint("status", DisputeStatus),
        generate_enum_check_constraint("reason", DisputeReason),
        CheckConstraint("amount = round(amount, 2) AND amount >= 0", name="ck_disputes_amount_two_decimals"),
    )


class Charter(Base):
    """Versioned merchant policy charter constraints."""

    __tablename__ = "charters"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (UniqueConstraint("merchant_id", "version", name="uq_charters_merchant_version"),)


class AgentRun(Base):
    """Audit record of LLM agent proposing plans for a dispute."""

    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(50), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    plan: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Decision(Base):
    """Deterministic gate evaluation record (APPEND-ONLY via database trigger).

    Note: A database owner or superuser could drop the append-only trigger;
    this is accepted for demo environments per step 03 specification.
    """

    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    action_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    verdict: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    also_triggered: Mapped[list[Any] | None] = mapped_column(JSONType, nullable=True)
    action_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    dispute_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    charter_version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    execution: Mapped["Execution | None"] = relationship(back_populates="decision", uselist=False)

    __table_args__ = (
        generate_enum_check_constraint("action_type", ActionType),
        generate_enum_check_constraint("verdict", Verdict),
    )


class Execution(Base):
    """Write-ahead execution record tracking state transitions of mutating calls."""

    __tablename__ = "executions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    decision_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("decisions.id"),
        unique=True,
        nullable=False,
    )
    dispute_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    paypal_debug_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confirmed_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    decision: Mapped["Decision"] = relationship(back_populates="execution")

    __table_args__ = (generate_enum_check_constraint("status", ExecutionStatus),)


class Approval(Base):
    """Merchant approval card for decisions requiring human oversight."""

    __tablename__ = "approvals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    decision_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("decisions.id"),
        nullable=False,
        index=True,
    )
    dispute_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolution: Mapped[str] = mapped_column(
        String(50),
        default=ApprovalResolution.PENDING.value,
        nullable=False,
    )
    edited_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (generate_enum_check_constraint("resolution", ApprovalResolution),)


class Order(Base):
    """Mock store customer order."""

    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    merchant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    paypal_transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    items: Mapped[list[Any]] = mapped_column(JSONType, nullable=False)
    demo_session_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @validates("amount")
    def validate_amount(self, key: str, value: Any) -> Decimal:
        """Reject float values, None, non-finite values, and decimals with more than 2 decimal places."""
        if value is None:
            raise ValueError(f"{key} cannot be None.")
        if isinstance(value, float):
            raise TypeError(f"Floating point values are strictly forbidden for {key}; use Decimal.")
        try:
            d = Decimal(str(value))
        except Exception as exc:
            raise ValueError(f"Invalid decimal value for {key}: {value}") from exc
        if not d.is_finite():
            raise ValueError(f"Non-finite decimal values (Infinity, NaN) are not allowed for {key}: {value}")
        exponent = d.as_tuple().exponent
        if not isinstance(exponent, int):
            raise ValueError(f"Invalid decimal exponent for {key}: {value}")
        if exponent < -2:
            raise ValueError(f"Values with more than two decimals are rejected for {key}: {value}")
        return d


    tracking_events: Mapped[list["TrackingEvent"]] = relationship(back_populates="order")

    __table_args__ = (
        generate_enum_check_constraint("status", OrderStatus),
        CheckConstraint("amount = round(amount, 2) AND amount >= 0", name="ck_orders_amount_two_decimals"),
    )


class TrackingEvent(Base):
    """Shipment tracking milestone event for dispute evidence."""

    __tablename__ = "tracking_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=True,
        index=True,
    )
    carrier: Mapped[str] = mapped_column(String(100), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    order: Mapped["Order | None"] = relationship(back_populates="tracking_events")

    __table_args__ = (generate_enum_check_constraint("status", TrackingStatus),)


class EvidenceFile(Base):
    """Uploaded or generated evidence artifact for dispute submission."""

    __tablename__ = "evidence_files"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class LedgerEvent(Base):
    """Append-only audit ledger recording every state transition per dispute.

    Note: A database owner or superuser could drop the append-only trigger;
    this is accepted for demo environments per step 03 specification.
    """

    __tablename__ = "ledger_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    event_kind: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        generate_enum_check_constraint("event_kind", TimelineEventKind),
        UniqueConstraint("dispute_id", "sequence_number", name="uq_ledger_events_dispute_seq"),
        CheckConstraint("sequence_number >= 1", name="ck_ledger_events_seq_positive"),
    )


class DemoSession(Base):
    """Ephemeral session isolation token for concurrent judge evaluations."""

    __tablename__ = "demo_sessions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
