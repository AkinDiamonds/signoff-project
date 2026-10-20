"""Write-ahead executor package for mutating PayPal calls.

This is the ONLY package authorized to import and call agent.app.paypal.mutating_client.
"""

from agent.app.executor.executor import (
    ExecutionRejectedError,
    ExecutionResult,
    ExecutionStaleError,
    execute_decision,
)
from agent.app.executor.reconciler import (
    ReconciliationOutcome,
    reconcile_single_execution,
    reconcile_stuck_executions,
)

__all__ = [
    "ExecutionRejectedError",
    "ExecutionResult",
    "ExecutionStaleError",
    "ReconciliationOutcome",
    "execute_decision",
    "reconcile_single_execution",
    "reconcile_stuck_executions",
]
