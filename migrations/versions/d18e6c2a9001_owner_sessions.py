"""Durable owner sessions and sign-in rate limits.

Revision ID: d18e6c2a9001
Revises: b7d2e1f4a9c8
"""

import sqlalchemy as sa
from alembic import op

revision = "d18e6c2a9001"
down_revision = "b7d2e1f4a9c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "integration_observations",
        sa.Column("key", sa.String(150), primary_key=True),
        sa.Column("state", sa.String(24), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("config_tag", sa.String(64), nullable=False),
    )
    op.create_index("ix_integration_observations_checked_at", "integration_observations", ["checked_at"])
    op.create_table(
        "owner_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("credential_tag", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_owner_sessions_expires_at", "owner_sessions", ["expires_at"])
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("client_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_attempts_client_hash", "login_attempts", ["client_hash"])
    op.create_index("ix_login_attempts_created_at", "login_attempts", ["created_at"])


def downgrade() -> None:
    op.drop_table("integration_observations")
    op.drop_table("login_attempts")
    op.drop_table("owner_sessions")
