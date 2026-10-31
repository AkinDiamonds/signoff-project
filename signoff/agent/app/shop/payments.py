"""Validate completed checkout payment proof before fulfilling a local order."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from agent.app.errors import AppError


class _Boundary(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True, hide_input_in_errors=True)


class _Amount(_Boundary):
    # Current checkout prices are two-decimal currencies. Never coerce JSON
    # numbers, exponents, NaN or excess precision into apparently valid money.
    value: str = Field(pattern=r"^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$")
    currency_code: str = Field(pattern=r"^[A-Z]{3}$")


class _Capture(_Boundary):
    id: str = Field(min_length=1, max_length=100, pattern=r"^\S+$")
    status: Literal["COMPLETED"]
    amount: _Amount


class _Payments(_Boundary):
    captures: list[_Capture] = Field(min_length=1, max_length=1)


class _Payee(_Boundary):
    merchant_id: str | None = None


class _Unit(_Boundary):
    payments: _Payments
    payee: _Payee | None = None


class _CompletedOrder(_Boundary):
    id: str = Field(min_length=1, max_length=100)
    status: Literal["COMPLETED"]
    # This storefront creates exactly one unit and one full capture. An unknown
    # partial/multi-capture arrangement must be reviewed instead of guessed.
    purchase_units: list[_Unit] = Field(min_length=1, max_length=1)


def verified_capture_id(
    payload: object, *, order_id: str, amount: Decimal, currency: str, merchant_id: str
) -> str:
    """Return a real response's capture ID only after validating all payment proof.

    Shared by capture and GET-only reconciliation so recovery cannot bypass a
    check required on the original callback. Never fabricate a capture ID.
    """
    try:
        completed = _CompletedOrder.model_validate(payload)
    except ValidationError:
        raise AppError(
            "CAPTURE_UNVERIFIED", "PayPal has not confirmed a valid completed payment", status_code=422
        ) from None
    if completed.id != order_id:
        raise AppError("PAYPAL_ORDER_MISMATCH", "PayPal payment does not match this order", status_code=422)
    unit = completed.purchase_units[0]
    if unit.payee is not None and unit.payee.merchant_id is not None and unit.payee.merchant_id != merchant_id:
        raise AppError("MERCHANT_MISMATCH", "Payment recipient does not match this merchant", status_code=422)
    capture = unit.payments.captures[0]
    if capture.amount.currency_code != currency:
        raise AppError("CURRENCY_MISMATCH", "Payment currency does not match this order", status_code=422)
    if Decimal(capture.amount.value) != amount:
        raise AppError("AMOUNT_MISMATCH", "Payment amount does not match this order", status_code=422)
    return capture.id
