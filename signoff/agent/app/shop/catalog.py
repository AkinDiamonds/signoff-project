"""Storefront product catalog and database seeding."""

from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from agent.app.db.base import Base
from agent.app.shop.models import Product


class CatalogItem(NamedTuple):
    sku: str
    name: str
    description: str
    price: Decimal
    currency: str = "USD"


CATALOG_FIXTURES: tuple[CatalogItem, ...] = (
    CatalogItem(
        sku="CND-LAV-01",
        name="Lavender Candle",
        description="Calming French lavender infused with natural soy wax and essential oils.",
        price=Decimal("21.00"),
    ),
    CatalogItem(
        sku="CND-VAN-02",
        name="Vanilla Candle",
        description="Warm, rich Madagascar vanilla bean with subtle notes of cream and amber.",
        price=Decimal("38.00"),
    ),
    CatalogItem(
        sku="GIFT-SET-01",
        name="Candle Gift Set",
        description="Curated trio of hand-poured artisan candles in a gift-ready presentation box.",
        price=Decimal("60.00"),
    ),
    CatalogItem(
        sku="CND-CED-03",
        name="Cedar Candle",
        description="Earthy Pacific cedarwood with crisp mountain pine and smoky undertones.",
        price=Decimal("64.00"),
    ),
    CatalogItem(
        sku="CND-ROSE-04",
        name="Rose Candle",
        description="Delicate Turkish rose petals balanced with light musk and soft greenery.",
        price=Decimal("55.00"),
    ),
)


def _ensure_products_table(session: Session) -> None:
    if session.bind is not None:
        Base.metadata.create_all(session.bind, tables=[Product.__table__], checkfirst=True)


def seed_catalog(session: Session) -> int:
    """Ensure products table exists and seed default candle catalog if empty."""
    _ensure_products_table(session)
    added = 0
    for item in CATALOG_FIXTURES:
        existing = session.scalar(select(Product).where(Product.sku == item.sku))
        if existing is None:
            session.add(
                Product(
                    sku=item.sku,
                    name=item.name,
                    description=item.description,
                    price=item.price,
                    currency=item.currency,
                )
            )
            added += 1
    if added > 0:
        session.flush()
    return added


def get_catalog(session: Session) -> list[Product]:
    """Return all catalog products ordered by SKU."""
    _ensure_products_table(session)
    seed_catalog(session)
    return list(session.scalars(select(Product).order_by(Product.sku)).all())


def get_product(session: Session, sku: str) -> Product | None:
    """Return catalog product by SKU or None."""
    _ensure_products_table(session)
    seed_catalog(session)
    return session.scalar(select(Product).where(Product.sku == sku.strip()))

