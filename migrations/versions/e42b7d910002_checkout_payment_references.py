"""Add explicit checkout references and durable capture intent.

Revision ID: e42b7d910002
Revises: d18e6c2a9001

No legacy identifiers are guessed/backfilled or made unique: duplicates must
remain visible to the fail-closed resolver until verified individually.
"""

import sqlalchemy as sa
from alembic import op

revision = "e42b7d910002"
down_revision = "d18e6c2a9001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("paypal_order_id", sa.String(100), nullable=True))
    op.add_column("orders", sa.Column("paypal_capture_id", sa.String(100), nullable=True))
    op.add_column("orders", sa.Column("capture_attempted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_orders_paypal_order_id", "orders", ["paypal_order_id"])
    op.create_index("ix_orders_paypal_capture_id", "orders", ["paypal_capture_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_paypal_capture_id", table_name="orders")
    op.drop_index("ix_orders_paypal_order_id", table_name="orders")
    op.drop_column("orders", "capture_attempted_at")
    op.drop_column("orders", "paypal_capture_id")
    op.drop_column("orders", "paypal_order_id")
