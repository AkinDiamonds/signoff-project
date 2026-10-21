"""In-process per-session and per-IP daily quotas for demo creation."""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from agent.app.errors import AppError


def _reset_time(now: datetime) -> datetime:
    return datetime(now.year, now.month, now.day, tzinfo=UTC) + timedelta(days=1)


@dataclass
class DemoQuotas:
    """Consume one unit per created scenario; reject with a reset time."""

    per_session_per_day: int
    per_ip_per_day: int
    _session_counts: dict[tuple[str, date], int] = field(default_factory=dict)
    _ip_counts: dict[tuple[str, date], int] = field(default_factory=dict)

    def consume(self, session_id: str, client_ip: str, now: datetime) -> None:
        if now.tzinfo is None:
            raise ValueError("Timezone-naive now is rejected; must be UTC")
        day = now.date()
        session_key = (session_id, day)
        ip_key = (client_ip, day)

        if self._session_counts.get(session_key, 0) >= self.per_session_per_day:
            raise self._exceeded("session", now)
        if self._ip_counts.get(ip_key, 0) >= self.per_ip_per_day:
            raise self._exceeded("IP address", now)

        self._session_counts[session_key] = self._session_counts.get(session_key, 0) + 1
        self._ip_counts[ip_key] = self._ip_counts.get(ip_key, 0) + 1

    @staticmethod
    def _exceeded(kind: str, now: datetime) -> AppError:
        reset = _reset_time(now)
        return AppError(
            code="QUOTA_EXCEEDED",
            message=f"Daily demo quota reached for this {kind}. Resets at {reset.isoformat()}.",
            status_code=429,
        )
