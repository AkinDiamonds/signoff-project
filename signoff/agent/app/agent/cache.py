"""Scenario cache for validated LLM plans.

The key includes the prompt version and the input hash, so bumping either one
misses the old entry. Only schema-validated plans are stored.
"""

import logging
from typing import Any

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

CACHED_REASONING_LABEL = "cached reasoning"

CacheKey = tuple[str, str, str]


class ScenarioCache:
    """In-memory cache of validated plans, keyed by (prompt version, input hash)."""

    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self._entries: dict[CacheKey, dict[str, Any]] = {}

    @staticmethod
    def key(prompt_version: str, input_hash: str) -> CacheKey:
        return ("v1", prompt_version, input_hash)

    def get(
        self,
        prompt_version: str,
        input_hash: str,
        schema: type[BaseModel],
    ) -> BaseModel | None:
        """Return a re-validated cached plan, or None on miss or stale schema."""
        if not self.enabled:
            return None
        cache_key = self.key(prompt_version, input_hash)
        payload = self._entries.get(cache_key)
        if payload is None:
            return None
        try:
            return schema.model_validate(payload)
        except ValidationError:
            # The schema changed without a prompt version bump. Treat as a miss
            # so a stale entry can never leak past validation.
            logger.warning("Dropping cached plan that no longer matches the schema (prompt_version=%s)", prompt_version)
            self._entries.pop(cache_key, None)
            return None

    def put(self, prompt_version: str, input_hash: str, plan: BaseModel) -> None:
        """Store an already validated plan."""
        if not self.enabled:
            return
        self._entries[self.key(prompt_version, input_hash)] = plan.model_dump(mode="json")

    def clear(self) -> None:
        self._entries.clear()

    def __len__(self) -> int:
        return len(self._entries)
