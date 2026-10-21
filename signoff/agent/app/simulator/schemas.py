"""Typed request and response models for the demo scenario generator."""

from typing import Literal

from pydantic import BaseModel, Field

ScenarioId = Literal["A", "B", "C", "D", "E"]


class ScenarioCreated(BaseModel):
    """A scenario dispute created from a pooled transaction."""

    scenario_id: ScenarioId
    dispute_id: str
    session_id: str
    transaction_id: str
    reason: str


class PoolScenario(BaseModel):
    total: int
    available: int
    claimed: int


class PoolResponse(BaseModel):
    """Pool availability, globally and per scenario."""

    total: int
    available: int
    claimed: int
    by_scenario: dict[str, PoolScenario] = Field(default_factory=dict)


class ResetResponse(BaseModel):
    """New session issued after hiding the previous session's disputes."""

    session_id: str
    hidden_disputes: int
