"""Persist evidence once per agent run; do not fabricate historical snapshots."""
import sqlalchemy as sa
from alembic import op

revision = "b75e0ac40005"
down_revision = "a64d9fb30004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evidence_snapshots",
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("agent_runs.id"), primary_key=True),
        sa.Column("dispute_id", sa.String(100), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_evidence_snapshots_dispute_id", "evidence_snapshots", ["dispute_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE TRIGGER reject_evidence_snapshots_mutation BEFORE UPDATE OR DELETE ON evidence_snapshots "
                   "FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation()")


def downgrade() -> None:
    op.drop_table("evidence_snapshots")
