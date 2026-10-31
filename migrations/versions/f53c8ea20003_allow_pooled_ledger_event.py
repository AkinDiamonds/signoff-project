"""Permit the existing DISPUTE_POOLED domain event in the migrated ledger.

Revision ID: f53c8ea20003
Revises: e42b7d910002

Only expands a schema constraint. No financial history is rewritten or deleted.
"""

from alembic import op

revision = "f53c8ea20003"
down_revision = "e42b7d910002"
branch_labels = None
depends_on = None

_NAME = "ck_ledger_events_ck_event_kind_timelineeventkind"
_PREVIOUS = (
    "'WEBHOOK_RECEIVED', 'DISPUTE_SYNCED', 'RUN_STARTED', 'EVIDENCE_BUILT', "
    "'PLAN_PROPOSED', 'GATE_DECIDED', 'APPROVAL_REQUESTED', 'APPROVAL_RESOLVED', "
    "'EXECUTION_INTENDED', 'EXECUTION_SENT', 'EXECUTION_CONFIRMED', 'EXECUTION_FAILED', "
    "'INJECTION_FLAGGED', 'NO_ACTION', 'RUN_FAILED'"
)


def upgrade() -> None:
    op.drop_constraint(op.f(_NAME), "ledger_events", type_="check")
    op.create_check_constraint(op.f(_NAME), "ledger_events", f"event_kind IN ({_PREVIOUS}, 'DISPUTE_POOLED')")


def downgrade() -> None:
    # PostgreSQL refuses this if existing pooled history needs the newer value.
    # Never delete append-only rows to make a downgrade pass.
    op.drop_constraint(op.f(_NAME), "ledger_events", type_="check")
    op.create_check_constraint(op.f(_NAME), "ledger_events", f"event_kind IN ({_PREVIOUS})")
