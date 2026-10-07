"""SQLAlchemy declarative base and shared column types."""

from datetime import datetime
from typing import Annotated

from sqlalchemy import DateTime, MetaData, Numeric
from sqlalchemy.orm import DeclarativeBase, mapped_column
from sqlalchemy.sql import func

# Naming convention for constraints to ensure deterministic Alembic autogeneration and clean migrations
POSTGRES_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_`%(constraint_name)s`",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base class for all Signoff database models."""

    metadata = MetaData(naming_convention=POSTGRES_NAMING_CONVENTION)


# Timezone-aware UTC timestamp column type definition
TimestampWithTZ = Annotated[datetime, mapped_column(DateTime(timezone=True), nullable=False)]
TimestampWithTZNullable = Annotated[datetime | None, mapped_column(DateTime(timezone=True), nullable=True)]

# Server-defaulted timezone-aware UTC timestamp
TimestampServerDefault = Annotated[
    datetime,
    mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    ),
]

# Fixed-precision currency numeric (2 decimal places)
MoneyNumeric = Annotated[
    float,  # Mapped in python to Decimal via SQLAlchemy Numeric
    mapped_column(Numeric(precision=12, scale=2), nullable=False),
]
