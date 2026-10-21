"""SQLAlchemy models for storefront catalog."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, validates
from sqlalchemy.sql import func

from agent.app.db.base import Base


class Product(Base):
    """Storefront catalog product item."""

    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    @validates("price")
    def validate_price(self, key: str, value: Any) -> Decimal:
        """Reject float values, None, non-finite values, and decimals with > 2 places."""
        if value is None:
            raise ValueError(f"{key} cannot be None.")
        if isinstance(value, float):
            raise TypeError(f"Floating point values forbidden for {key}; use Decimal.")
        try:
            d = Decimal(str(value))
        except Exception as exc:
            raise ValueError(f"Invalid decimal value for {key}: {value}") from exc
        if not d.is_finite() or d <= 0:
            raise ValueError(f"{key} must be finite and positive: {value}")
        exponent = d.as_tuple().exponent
        if isinstance(exponent, int) and exponent < -2:
            raise ValueError(f"Values with > 2 decimals rejected for {key}: {value}")
        return d

    __table_args__ = (
        CheckConstraint("price = round(price, 2) AND price > 0", name="ck_products_price_positive"),
    )
