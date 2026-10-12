"""Authority Charter domain models, validation, and versioning service.

Enforces merchant limits per plan/03-gate-spec.md and ADR-007:
- Limits apply to money conceded (auto_offer_max, auto_accept_max) and dispute size (auto_act_max_dispute_amount).
- Negative limits, floats, >2 decimals, and non-USD currencies rejected with 422.
- Unknown reason or action names rejected with 422; duplicates normalized.
- Extra fields forbidden across all models.
- Changes stored as new immutable versions (append-only); never mutated in place.
- Optimistic concurrency control via base_version with conflict reporting.
"""

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from agent.app.db.models import Charter
from agent.app.domain.enums import ActionType, DisputeReason
from agent.app.errors import ConflictVersionError, FrozenError, NotFoundError

logger = logging.getLogger(__name__)

MERCHANT_CURRENCY = "USD"


class MoneyLimit(BaseModel):
    """Monetary limit enforcing fixed-precision Decimal and merchant currency."""

    model_config = ConfigDict(extra="forbid")

    currency_code: str
    value: Decimal

    @field_validator("currency_code")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        if v != MERCHANT_CURRENCY:
            raise ValueError(f"Currency must match merchant currency ({MERCHANT_CURRENCY}), got '{v}'")
        return v

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> Decimal:
        if isinstance(v, float):
            raise TypeError("Floating point values are strictly forbidden for money limits; use decimal strings.")
        if v is None:
            raise ValueError("Limit value cannot be None.")
        try:
            d = Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise ValueError(f"Invalid decimal value for limit: {v!r}") from exc

        if not d.is_finite():
            raise ValueError(f"Non-finite decimal values (Infinity, NaN) are not allowed: {v!r}")

        if d < Decimal("0.00"):
            raise ValueError(f"Limit value cannot be negative, got {d}")

        exponent = d.as_tuple().exponent
        if isinstance(exponent, int) and exponent < -2:
            raise ValueError(f"Limit value cannot have more than two decimal places, got {v!r}")

        return d

    @field_serializer("value", when_used="json")
    def serialize_value(self, v: Decimal) -> str:
        return f"{v:.2f}"


class CharterData(BaseModel):
    """Merchant authority charter parameters."""

    model_config = ConfigDict(extra="forbid")

    auto_offer_max: MoneyLimit
    auto_accept_max: MoneyLimit
    auto_act_max_dispute_amount: MoneyLimit
    never_auto_reasons: list[DisputeReason] = Field(default_factory=list)
    never_auto_actions: list[ActionType] = Field(default_factory=list)
    repeat_disputer_threshold: int = Field(default=2, ge=0)
    auto_provide_evidence: bool = True
    auto_send_message: bool = True

    @field_validator("never_auto_reasons", mode="after")
    @classmethod
    def normalize_reasons(cls, v: list[DisputeReason]) -> list[DisputeReason]:
        """Normalize dispute reasons by removing duplicates while preserving order."""
        seen = set()
        deduped: list[DisputeReason] = []
        for r in v:
            if r not in seen:
                seen.add(r)
                deduped.append(r)
        return deduped

    @field_validator("never_auto_actions", mode="after")
    @classmethod
    def normalize_actions(cls, v: list[ActionType]) -> list[ActionType]:
        """Normalize action types by removing duplicates while preserving order."""
        seen = set()
        deduped: list[ActionType] = []
        for a in v:
            if a not in seen:
                seen.add(a)
                deduped.append(a)
        return deduped


class CharterResponse(CharterData):
    """Full versioned charter response shape."""

    model_config = ConfigDict(extra="forbid")

    version: int
    created_at: datetime


class UpdateCharterRequest(CharterData):
    """Charter update request requiring the base version for optimistic concurrency."""

    model_config = ConfigDict(extra="forbid")

    base_version: int = Field(..., description="The charter version this update is based on")


DEFAULT_CHARTER_DATA = CharterData(
    auto_offer_max=MoneyLimit(currency_code=MERCHANT_CURRENCY, value=Decimal("25.00")),
    auto_accept_max=MoneyLimit(currency_code=MERCHANT_CURRENCY, value=Decimal("25.00")),
    auto_act_max_dispute_amount=MoneyLimit(currency_code=MERCHANT_CURRENCY, value=Decimal("100.00")),
    never_auto_reasons=[],
    never_auto_actions=[ActionType.ESCALATE, ActionType.APPEAL],
    repeat_disputer_threshold=2,
    auto_provide_evidence=True,
    auto_send_message=True,
)


def to_charter_response(charter: Charter) -> CharterResponse:
    """Map database Charter entity to CharterResponse DTO."""
    cfg = charter.config
    data = CharterData.model_validate(cfg)
    return CharterResponse(
        version=charter.version,
        created_at=charter.created_at,
        **data.model_dump(),
    )


def get_or_seed_charter(session: Session, merchant_id: str = "default") -> Charter:
    """Retrieve the active charter for merchant_id, seeding default version 1 if none exists."""
    stmt = (
        select(Charter)
        .where(Charter.merchant_id == merchant_id, Charter.is_active.is_(True))
        .order_by(Charter.version.desc())
    )
    current = session.execute(stmt).scalars().first()
    if current is not None:
        return current

    # Seed default charter version 1
    new_charter = Charter(
        id=uuid.uuid4(),
        merchant_id=merchant_id,
        version=1,
        is_active=True,
        config=DEFAULT_CHARTER_DATA.model_dump(mode="json"),
        created_at=datetime.now(UTC),
    )
    try:
        session.add(new_charter)
        session.flush()
        logger.info(
            "Default charter seeded",
            extra={"merchant_id": merchant_id, "version": 1},
        )
        return new_charter
    except IntegrityError:
        session.rollback()
        # Concurrent seed occurred; re-fetch the existing version 1
        existing = session.execute(stmt).scalars().first()
        if existing is not None:
            return existing
        raise


def get_charter_by_version(session: Session, version: int, merchant_id: str = "default") -> Charter:
    """Retrieve a specific version of the charter for merchant_id."""
    stmt = (
        select(Charter)
        .where(Charter.merchant_id == merchant_id, Charter.version == version)
    )
    charter = session.execute(stmt).scalars().first()
    if charter is None:
        raise NotFoundError(f"Charter version {version} not found for merchant '{merchant_id}'")
    return charter


def get_charter_history(session: Session, merchant_id: str = "default") -> list[Charter]:
    """Retrieve complete audit history of all charter versions ordered newest first."""
    stmt = (
        select(Charter)
        .where(Charter.merchant_id == merchant_id)
        .order_by(Charter.version.desc())
    )
    return list(session.execute(stmt).scalars().all())


def update_charter(
    session: Session,
    update: UpdateCharterRequest,
    merchant_id: str = "default",
    is_frozen: bool = False,
) -> Charter:
    """Save new charter version with optimistic concurrency check. Never update in place."""
    if is_frozen:
        raise FrozenError("Charter cannot be modified while demo is frozen")

    # Lock / fetch latest active charter
    stmt = (
        select(Charter)
        .where(Charter.merchant_id == merchant_id, Charter.is_active.is_(True))
        .order_by(Charter.version.desc())
        .with_for_update()
    )
    current = session.execute(stmt).scalars().first()
    if current is None:
        current = get_or_seed_charter(session, merchant_id=merchant_id)

    if current.version != update.base_version:
        raise ConflictVersionError(
            f"Charter conflict: active version is {current.version}, but update was based on {update.base_version}."
        )

    # Deactivate prior active version
    current.is_active = False

    new_version = current.version + 1
    new_config = update.model_dump(mode="json", exclude={"base_version"})

    new_charter = Charter(
        id=uuid.uuid4(),
        merchant_id=merchant_id,
        version=new_version,
        is_active=True,
        config=new_config,
        created_at=datetime.now(UTC),
    )
    try:
        session.add(new_charter)
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise ConflictVersionError(
            f"Charter version {new_version} already exists. Concurrent update conflict."
        ) from exc

    logger.info(
        "Charter updated",
        extra={
            "merchant_id": merchant_id,
            "previous_version": current.version,
            "new_version": new_version,
        },
    )

    # TODO(step-10): Write a ledger event for every charter change per spec.
    # LedgerEvent is currently keyed by (dispute_id, sequence_number) which
    # does not map to a policy-level change.  Resolve the intended sentinel
    # pattern (e.g. a dedicated "policy" event table or a synthetic
    # dispute_id such as "__charter__") before implementing this.
    # Tracked as: build-plan/steps/10-charter.md § "Write a ledger event for every change"

    return new_charter
