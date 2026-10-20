"""Daily LLM spend cap with atomic reservations.

Spend is tracked in memory per UTC day. A call reserves its estimated cost
*before* the provider request, so concurrent calls near the cap cannot
overspend.
"""

import asyncio
from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal


class DailyBudget:
    """A daily USD budget. Reserve before each provider attempt."""

    def __init__(
        self,
        daily_cap_usd: Decimal,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if daily_cap_usd < 0:
            raise ValueError("Daily budget cannot be negative")
        self._cap = daily_cap_usd
        self._clock = clock or (lambda: datetime.now(UTC))
        now = self._clock()
        self._day: date = now.date()
        self._spent = Decimal("0")
        self._lock = asyncio.Lock()

    def _roll_over_if_needed(self) -> None:
        today = self._clock().date()
        if today != self._day:
            self._day = today
            self._spent = Decimal("0")

    async def reserve(self, amount_usd: Decimal) -> bool:
        """Reserve cost for one attempt. Returns False when over the cap."""
        if amount_usd < 0:
            raise ValueError("Reservation cannot be negative")
        async with self._lock:
            self._roll_over_if_needed()
            if self._spent + amount_usd > self._cap:
                return False
            self._spent += amount_usd
            return True

    @property
    def cap_usd(self) -> Decimal:
        return self._cap

    @property
    def spent_usd(self) -> Decimal:
        self._roll_over_if_needed()
        return self._spent

    @property
    def remaining_usd(self) -> Decimal:
        self._roll_over_if_needed()
        return self._cap - self._spent
