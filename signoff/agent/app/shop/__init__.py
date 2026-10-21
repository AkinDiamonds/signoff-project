"""Storefront backend package: catalog, orders, and checkout."""

from agent.app.shop.catalog import CATALOG_FIXTURES, seed_catalog
from agent.app.shop.models import Product

__all__ = ["CATALOG_FIXTURES", "Product", "seed_catalog"]
