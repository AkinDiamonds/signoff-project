"""Exponential backoff and jitter calculations for job retry scheduling."""

import random


def calculate_backoff(
    attempt: int,
    base_seconds: float = 1.0,
    max_seconds: float = 60.0,
    factor: float = 2.0,
    jitter: bool = True,
    jitter_ratio: float = 0.5,
    rng: random.Random | None = None,
) -> float:
    """Calculate exponential retry backoff in seconds.

    Attempts are 1-indexed (attempt=1 is first retry after failure).
    If jitter is False, calculates the deterministic base backoff:
        min(max_seconds, base_seconds * (factor ** (attempt - 1)))
    If jitter is True, applies bounded uniform jitter:
        backoff + uniform(0, backoff * jitter_ratio)
    """
    effective_attempt = max(1, attempt)
    raw_delay = base_seconds * (factor ** (effective_attempt - 1))
    capped_delay = min(max_seconds, raw_delay)

    if not jitter:
        return float(capped_delay)

    generator = rng or random
    jitter_amount = generator.uniform(0.0, capped_delay * jitter_ratio)
    return float(capped_delay + jitter_amount)
