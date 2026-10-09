"""Dispute synchronization, state mapping, and reconciliation package."""

from agent.app.sync.handler import SyncResult, sync_dispute
from agent.app.sync.jobs import handle_reconcile_job, handle_sync_dispute_job, register_sync_handlers
from agent.app.sync.reconciler import ReconcileResult, reconcile_disputes
from agent.app.sync.state import (
    DisputeState,
    is_dispute_resolved,
    map_dispute_state_to_db_status,
    map_paypal_reason,
    map_paypal_status_to_dispute_state,
    requires_seller_response,
)

__all__ = [
    "DisputeState",
    "ReconcileResult",
    "SyncResult",
    "handle_reconcile_job",
    "handle_sync_dispute_job",
    "is_dispute_resolved",
    "map_dispute_state_to_db_status",
    "map_paypal_reason",
    "map_paypal_status_to_dispute_state",
    "reconcile_disputes",
    "register_sync_handlers",
    "requires_seller_response",
    "sync_dispute",
]
