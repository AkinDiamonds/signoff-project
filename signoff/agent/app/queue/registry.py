"""Handler registry keyed by job kind with type-check exhaustiveness validation."""

from collections.abc import Callable, Coroutine
from typing import Any, Never, assert_never

from sqlalchemy.orm import Session

from agent.app.db.models import Job
from agent.app.domain.enums import JobKind

JobHandlerSync = Callable[[Job, Session], None]
JobHandlerAsync = Callable[[Job, Session], Coroutine[Any, Any, None]]
JobHandler = JobHandlerSync | JobHandlerAsync


def assert_exhaustive_job_kind(kind: JobKind) -> Never:
    """Type-check helper asserting all JobKind variants are handled."""
    assert_never(kind)


class HandlerRegistry:
    """Registry mapping JobKind to their execution handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, JobHandler] = {}

    def register(self, kind: JobKind | str, handler: JobHandler) -> None:
        key = kind.value if isinstance(kind, JobKind) else str(kind)
        self._handlers[key] = handler

    def get(self, kind: JobKind | str) -> JobHandler | None:
        key = kind.value if isinstance(kind, JobKind) else str(kind)
        return self._handlers.get(key)

    def validate_exhaustiveness(self) -> None:
        """Validate that all domain JobKind variants are registered."""
        for kind in JobKind:
            if (
                kind is JobKind.SYNC_DISPUTE
                or kind is JobKind.RUN_AGENT
                or kind is JobKind.EXECUTE_DECISION
                or kind is JobKind.RECONCILE
                or kind is JobKind.EXPIRE_APPROVALS
            ):
                pass
            else:
                assert_exhaustive_job_kind(kind)

            if kind.value not in self._handlers:
                raise ValueError(f"Missing required handler for job kind: '{kind.value}'")


def create_default_registry() -> HandlerRegistry:
    """Create default registry with no-op handlers for all domain job kinds."""
    registry = HandlerRegistry()

    def noop_handler(job: Job, session: Session) -> None:
        """Default no-op handler for step 08."""
        pass

    for kind in JobKind:
        registry.register(kind, noop_handler)

    registry.validate_exhaustiveness()
    return registry
