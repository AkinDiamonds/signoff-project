"""A merchant may permit gated settlement without inventing delivery proof."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from agent.app.domain.enums import TrackingStatus
from agent.app.policy.missing_evidence import evaluate_missing_delivery
from agent.app.store.models import MISSING_TRACKING_REASON
from agent.app.store_mock.scenarios import SCENARIOS

NOW = datetime(2026, 10, 31, tzinfo=UTC)
DELIVERED = SCENARIOS[0]
IN_TRANSIT = SCENARIOS[1]


@pytest.mark.parametrize("choice,expected", [("HUMAN_REVIEW", "review"), ("GATED_SETTLEMENT", "settlement_only")])
def test_missing_delivery_respects_merchant_choice(choice, expected):
    assert evaluate_missing_delivery(IN_TRANSIT, choice, NOW) == expected
    assert evaluate_missing_delivery(replace(IN_TRANSIT, shipments=()), choice, NOW) == expected


def test_valid_delivery_allows_normal_processing():
    assert evaluate_missing_delivery(DELIVERED, "HUMAN_REVIEW", NOW) == "normal"


def test_withheld_tracking_never_uses_contradictory_delivery_records():
    withheld = replace(DELIVERED, shipments=(), tracking_unavailable_reason=MISSING_TRACKING_REASON)
    assert evaluate_missing_delivery(withheld, "GATED_SETTLEMENT", NOW) == "settlement_only"
    contradictory = replace(withheld, shipments=DELIVERED.shipments)
    assert evaluate_missing_delivery(contradictory, "GATED_SETTLEMENT", NOW) == "review"


def test_invalid_future_delivery_or_exception_always_requires_review():
    future = replace(DELIVERED.shipments[0], event_time=NOW + timedelta(days=1))
    early = replace(DELIVERED.shipments[0], event_time=DELIVERED.created_at - timedelta(seconds=1))
    exception = replace(IN_TRANSIT.shipments[0], status=TrackingStatus.EXCEPTION)
    for order in (
        None,
        replace(DELIVERED, shipments=(future,)),
        replace(DELIVERED, shipments=(early,)),
        replace(IN_TRANSIT, shipments=(exception,)),
        replace(IN_TRANSIT, tracking_unavailable_reason="Store history is invalid"),
    ):
        assert evaluate_missing_delivery(order, "GATED_SETTLEMENT", NOW) == "review"
