"""Preserve evidence seen before a model run exits for review."""
import sqlalchemy as sa
from alembic import op

revision = "d97a2ce60007"
down_revision = "c86f1bd50006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "review_evidence_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("dispute_id", sa.String(100), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_review_evidence_snapshots_dispute_id", "review_evidence_snapshots", ["dispute_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE TRIGGER reject_review_evidence_mutation BEFORE UPDATE OR DELETE ON review_evidence_snapshots "
                   "FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation()")


def downgrade() -> None:
    op.drop_table("review_evidence_snapshots")
