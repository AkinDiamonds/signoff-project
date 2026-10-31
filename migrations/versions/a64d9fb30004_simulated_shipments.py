"""Persistent simulated shipping schedules; no legacy tracking/history rewrite.

Revision ID: a64d9fb30004
Revises: f53c8ea20003
"""

import sqlalchemy as sa
from alembic import op

revision = "a64d9fb30004"
down_revision = "f53c8ea20003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "simulated_shipments",
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id"), primary_key=True),
        sa.Column("id", sa.Uuid(), nullable=False, unique=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("mode", sa.String(24), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("tracking_number", sa.String(100), nullable=False),
        sa.Column("next_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_request_id", sa.Uuid(), nullable=True),
        sa.Column("last_request_tag", sa.String(64), nullable=True),
        sa.CheckConstraint(
            "status IN ('PRE_TRANSIT','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','RETURNED','EXCEPTION')",
            name=op.f("ck_simulated_shipments_ck_status_trackingstatus"),
        ),
        sa.CheckConstraint("mode IN ('normal','missing_tracking','exception')", name="shipment_mode"),
        sa.CheckConstraint("version >= 0", name="shipment_version"),
    )
    op.create_index("ix_simulated_shipments_next_event_at", "simulated_shipments", ["next_event_at"])


def downgrade() -> None:
    op.drop_table("simulated_shipments")
