"""FastAPI endpoints for storefront catalog, orders, and checkout."""

import time
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from agent.app.db.session import get_db_session
from agent.app.domain.money import Money
from agent.app.errors import NotFoundError, RateLimitedError
from agent.app.paypal.orders_client import PayPalOrdersClient
from agent.app.shop.catalog import get_catalog, get_product
from agent.app.shop.disputes import router as disputes_router
from agent.app.shop.schemas import (
    CaptureOrderRequest,
    CaptureOrderResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    OrderDetailResponse,
    ProductItem,
)
from agent.app.shop.service import (
    capture_shop_order,
    create_shop_order,
    get_buyer_order,
    reconcile_order,
)

router = APIRouter(prefix="/api/shop", tags=["Storefront"])
router.include_router(disputes_router)

# In-memory rate limiting tracker for failed order lookups (max 10 failures per IP per 60s)
_failed_lookups: dict[str, list[float]] = defaultdict(list)
_MAX_FAILED_LOOKUPS = 10
_FAILED_LOOKUP_WINDOW_SECONDS = 60.0


def _check_lookup_rate_limit(client_ip: str) -> None:
    now = time.time()
    cutoff = now - _FAILED_LOOKUP_WINDOW_SECONDS
    # Clean old timestamps
    recent = [ts for ts in _failed_lookups[client_ip] if ts > cutoff]
    _failed_lookups[client_ip] = recent
    if len(recent) >= _MAX_FAILED_LOOKUPS:
        raise RateLimitedError("Too many failed order lookup attempts. Please wait before retrying.")


def _record_failed_lookup(client_ip: str) -> None:
    _failed_lookups[client_ip].append(time.time())


def get_orders_client() -> PayPalOrdersClient:
    """Dependency providing a PayPalOrdersClient instance."""
    return PayPalOrdersClient()


@router.get("/catalog", response_model=list[ProductItem])
async def list_catalog(
    db: Annotated[Session, Depends(get_db_session)],
) -> list[ProductItem]:
    """List all available products in the storefront catalog."""
    products = get_catalog(db)
    return [
        ProductItem(
            sku=p.sku,
            name=p.name,
            description=p.description,
            price=Money(value=p.price, currency_code=p.currency),
        )
        for p in products
    ]


@router.get("/catalog/{sku}", response_model=ProductItem)
async def get_product_detail(
    sku: str,
    db: Annotated[Session, Depends(get_db_session)],
) -> ProductItem:
    """Retrieve details for a single catalog item."""
    p = get_product(db, sku)
    if p is None:
        raise NotFoundError(f"Product with SKU '{sku}' not found")
    return ProductItem(
        sku=p.sku,
        name=p.name,
        description=p.description,
        price=Money(value=p.price, currency_code=p.currency),
    )


@router.post("/orders", response_model=CreateOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    req: CreateOrderRequest,
    db: Annotated[Session, Depends(get_db_session)],
    orders_client: Annotated[PayPalOrdersClient, Depends(get_orders_client)],
) -> CreateOrderResponse:
    """Create a new storefront order, computing total on the server."""
    try:
        return await create_shop_order(db, req, orders_client)
    finally:
        await orders_client.aclose()


@router.get("/orders/{order_code}", response_model=OrderDetailResponse)
async def get_order_by_code(
    order_code: str,
    request: Request,
    email: Annotated[str, Query(description="Customer email for verification")],
    db: Annotated[Session, Depends(get_db_session)],
) -> OrderDetailResponse:
    """Retrieve order details for buyers, requiring order code and email."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_lookup_rate_limit(client_ip)
    try:
        return get_buyer_order(db, order_code=order_code, email=email)
    except NotFoundError:
        _record_failed_lookup(client_ip)
        raise


@router.post("/orders/{order_code}/capture", response_model=CaptureOrderResponse)
async def capture_order(
    order_code: str,
    db: Annotated[Session, Depends(get_db_session)],
    orders_client: Annotated[PayPalOrdersClient, Depends(get_orders_client)],
    req: CaptureOrderRequest | None = None,
) -> CaptureOrderResponse:
    """Capture payment for an order and schedule mock tracking."""
    try:
        return await capture_shop_order(db, order_code=order_code, req=req, orders_client=orders_client)
    finally:
        await orders_client.aclose()


@router.post("/orders/{order_code}/reconcile", response_model=OrderDetailResponse)
async def reconcile(
    order_code: str,
    email: Annotated[str, Query(description="Customer email for verification")],
    db: Annotated[Session, Depends(get_db_session)],
    orders_client: Annotated[PayPalOrdersClient, Depends(get_orders_client)],
) -> OrderDetailResponse:
    """Reconcile an order found at PayPal but missing local capture status."""
    try:
        await reconcile_order(db, order_code=order_code, orders_client=orders_client)
        return get_buyer_order(db, order_code=order_code, email=email)
    finally:
        await orders_client.aclose()
