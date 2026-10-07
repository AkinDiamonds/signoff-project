"""Structured JSON logging with correlation id propagation."""

import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

_correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """Retrieve current request correlation id from context."""
    return _correlation_id_ctx.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation id in context for current async task."""
    _correlation_id_ctx.set(correlation_id)


# Hook LogRecord factory so every log record created in any logger gets correlation_id
_old_factory = logging.getLogRecordFactory()


def _correlation_record_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
    record = _old_factory(*args, **kwargs)
    record.correlation_id = get_correlation_id()  # type: ignore[attr-defined]
    return record


logging.setLogRecordFactory(_correlation_record_factory)


class JSONFormatter(logging.Formatter):
    """Formats log records as structured JSON lines."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "") or get_correlation_id(),
        }

        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            log_entry["exception"] = record.exc_text

        return json.dumps(log_entry)


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger with structured JSON output."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid duplicate JSONStreamHandler
    for h in root_logger.handlers:
        if isinstance(getattr(h, "formatter", None), JSONFormatter):
            return

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    root_logger.addHandler(handler)
