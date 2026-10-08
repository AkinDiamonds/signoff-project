"""Typed payload models and validation for all domain job kinds.

Enforces Step 08 requirements and edge cases:
- Payloads form a union keyed by kind.
- Unknown job kind goes to dead-letter immediately.
- Payload invalid for its kind goes to dead-letter immediately.
"""

from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from agent.app.domain.enums import JobKind


class JobQueueError(Exception):
    """Base exception for queue operations."""


class UnknownJobKindError(JobQueueError):
    """Raised when an unhandled or unrecognized job kind is encountered."""


class InvalidPayloadError(JobQueueError):
    """Raised when raw payload data fails schema validation for its declared kind."""


class SyncDisputePayload(BaseModel):
    """Payload for syncing PayPal dispute state and snapshots."""

    model_config = ConfigDict(extra="ignore")

    dispute_id: str = Field(..., min_length=1, description="PayPal dispute ID")
    event_id: str | None = Field(default=None, description="Triggering PayPal webhook event ID")
    event_type: str | None = Field(default=None, description="Triggering webhook event type")


class RunAgentPayload(BaseModel):
    """Payload for running the dispute agent on a state transition."""

    model_config = ConfigDict(extra="ignore")

    dispute_id: str = Field(..., min_length=1, description="PayPal dispute ID")
    fingerprint: str | None = Field(default=None, description="Dispute state fingerprint")


class ExecuteDecisionPayload(BaseModel):
    """Payload for executing an approved gate decision."""

    model_config = ConfigDict(extra="ignore")

    decision_id: str | None = Field(default=None, description="Gate decision ID to execute")
    dispute_id: str | None = Field(default=None, description="Associated PayPal dispute ID")

    @model_validator(mode="after")
    def validate_identity(self) -> "ExecuteDecisionPayload":
        if not self.decision_id and not self.dispute_id:
            raise ValueError("ExecuteDecisionPayload requires either decision_id or dispute_id.")
        return self


class ReconcilePayload(BaseModel):
    """Payload for polling open disputes and reconciling local state."""

    model_config = ConfigDict(extra="ignore")

    lookback_days: int | None = Field(default=30, ge=1, le=365, description="Lookback window in days")


class ExpireApprovalsPayload(BaseModel):
    """Payload for scanning and expiring overdue merchant approvals."""

    model_config = ConfigDict(extra="ignore")

    cutoff_time: datetime | None = Field(default=None, description="Optional custom expiry cutoff timestamp")


# Discriminated payload union
JobPayload = Annotated[
    SyncDisputePayload | RunAgentPayload | ExecuteDecisionPayload | ReconcilePayload | ExpireApprovalsPayload,
    Field(discriminator=None),
]

KIND_TO_PAYLOAD_MAP: dict[JobKind, type[BaseModel]] = {
    JobKind.SYNC_DISPUTE: SyncDisputePayload,
    JobKind.RUN_AGENT: RunAgentPayload,
    JobKind.EXECUTE_DECISION: ExecuteDecisionPayload,
    JobKind.RECONCILE: ReconcilePayload,
    JobKind.EXPIRE_APPROVALS: ExpireApprovalsPayload,
}


def parse_job_payload(kind: str | JobKind, raw_payload: dict[str, Any] | None) -> BaseModel:
    """Validate and parse raw payload into its typed model.

    Raises UnknownJobKindError if kind is unrecognized.
    Raises InvalidPayloadError if raw_payload is invalid for that kind.
    """
    if isinstance(kind, str):
        try:
            job_kind = JobKind(kind)
        except ValueError as exc:
            raise UnknownJobKindError(f"Unknown job kind: '{kind}'") from exc
    else:
        job_kind = kind

    payload_cls = KIND_TO_PAYLOAD_MAP.get(job_kind)
    if not payload_cls:
        raise UnknownJobKindError(f"No payload schema registered for job kind: '{job_kind.value}'")

    data = raw_payload if raw_payload is not None else {}
    if not isinstance(data, dict):
        raise InvalidPayloadError(
            f"Payload for job kind '{job_kind.value}' must be a dictionary, got {type(data).__name__}"
        )

    try:
        return payload_cls.model_validate(data)
    except Exception as exc:
        raise InvalidPayloadError(f"Invalid payload for job kind '{job_kind.value}': {exc}") from exc
