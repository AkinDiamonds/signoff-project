"""Pydantic schemas for storefront API contracts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from agent.app.domain.money import Money


class ProductItem(BaseModel):
    """Catalog product returned to the client."""

    sku: str
    name: str
    description: str
    price: Money


class OrderItemRequest(BaseModel):
    """Item specification in an order creation request.
    
    Price field is intentionally excluded: the server computes prices from the catalog.
    Quantity is strictly bounded between 1 and 5.
    """

    model_config = ConfigDict(extra="ignore")

    sku: str = Field(min_length=1, max_length=50)
    quantity: int = Field(ge=1, le=5)


class CreateOrderRequest(BaseModel):
    """Buyer order creation request."""

    customer_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    items: list[OrderItemRequest] = Field(min_length=1, max_length=10)
    demo_session_id: str | None = None

    @field_validator("customer_email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class CreateOrderResponse(BaseModel):
    """Result of order creation."""

    order_code: str
    paypal_order_id: str
    amount: Money
    status: str


class CaptureOrderRequest(BaseModel):
    """Optional payload for order capture."""

    paypal_order_id: str | None = None


class CaptureOrderResponse(BaseModel):
    """Result of order capture."""

    order_code: str
    paypal_transaction_id: str
    status: str
    carrier: str | None = None
    tracking_number: str | None = None


class OrderItemResponse(BaseModel):
    """Line item in an order."""

    sku: str
    name: str
    quantity: int
    unit_price: str


class TrackingEventResponse(BaseModel):
    """Tracking milestone for an order."""

    carrier: str
    tracking_number: str
    status: str
    event_time: datetime


class OrderDetailResponse(BaseModel):
    """Order status and tracking view for buyers."""

    order_code: str
    status: str
    customer_email: str
    amount: Money
    items: list[OrderItemResponse]
    tracking_events: list[TrackingEventResponse]
    created_at: datetime
