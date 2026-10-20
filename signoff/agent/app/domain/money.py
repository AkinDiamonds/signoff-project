"""Shared monetary value object used by domain actions and PayPal boundary models.

Kept in a standalone module (rather than ``paypal.models``) so the domain layer
does not have to import the PayPal package, which would create an import cycle.
"""

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator


class Money(BaseModel):
    """Monetary amount with ISO currency code per build-plan/contracts.md.

    Amounts must arrive as strings and become Decimal. JSON floats are rejected;
    zero or negative amounts are invalid; currency must be three uppercase letters.
    """

    model_config = ConfigDict(extra="ignore")

    currency_code: str
    value: Decimal

    @field_validator("currency_code")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        if not re.match(r"^[A-Z]{3}$", v):
            raise ValueError(f"Currency code must be exactly three uppercase letters, got {v!r}")
        return v

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> Decimal:
        if isinstance(v, float):
            raise ValueError("JSON floats are rejected for money values; must be a decimal string")
        if isinstance(v, int):
            dec = Decimal(str(v))
        elif isinstance(v, str):
            try:
                dec = Decimal(v)
            except InvalidOperation as exc:
                raise ValueError(f"Invalid decimal string: {v!r}") from exc
        elif isinstance(v, Decimal):
            dec = v
        else:
            raise ValueError(f"Money value must arrive as a string, got {type(v).__name__}")

        if dec <= Decimal("0"):
            raise ValueError(f"Money value must be strictly positive, got {dec}")
        return dec

    @field_serializer("value", when_used="json")
    def serialize_value(self, v: Decimal) -> str:
        return f"{v:.2f}"
