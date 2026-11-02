"""Durable notification inbox and delivery outbox."""

import sqlalchemy as sa
from alembic import op

revision = "c86f1bd50006"
down_revision = "b75e0ac40005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("dispute_id", sa.String(100), nullable=False),
        sa.Column("demo_session_id", sa.String(100), nullable=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("dedupe_key", sa.String(64), nullable=False, unique=True),
        sa.Column("source_event_id", sa.Uuid(), sa.ForeignKey("ledger_events.id"), nullable=False),
        sa.Column("message", sa.String(240), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_dispute_id", "notifications", ["dispute_id"])
    op.create_index("ix_notifications_demo_session_id", "notifications", ["demo_session_id"])
    op.create_table(
        "notification_outbox",
        sa.Column("notification_id", sa.Uuid(), sa.ForeignKey("notifications.id"), primary_key=True),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("notification_outbox")
    op.drop_table("notifications")
