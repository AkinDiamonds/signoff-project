"""add demo_pool table for the judge hold/claim flow

Revision ID: b7d2e1f4a9c8
Revises: c43f7713f25a
Create Date: 2026-10-30 06:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d2e1f4a9c8"
down_revision: str | Sequence[str] | None = "c43f7713f25a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the demo pool that holds disputes until a judge claims them."""
    op.create_table(
        "demo_pool",
        sa.Column("dispute_id", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scenario_label", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("state IN ('pooled', 'claimed', 'done')", name="ck_demo_pool_state"),
        sa.PrimaryKeyConstraint("dispute_id"),
    )


def downgrade() -> None:
    """Drop the demo pool table."""
    op.drop_table("demo_pool")
