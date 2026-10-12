"""Comprehensive tests for Authority Charter domain model, versioning, and API.

Validates all requirements from build-plan/steps/10-charter.md:
- Limits apply to money conceded (auto_offer_max, auto_accept_max) and dispute size (auto_act_max_dispute_amount).
- MoneyLimit validation: negative limits, floats, >2 decimals, non-USD currencies rejected with 422 and field paths.
- Unknown reason or action names: 422. Duplicates normalized.
- Extra fields forbidden across all models.
- Optimistic concurrency control (base_version required): conflict on stale version (409 CONFLICT_VERSION).
- Two clients saving at once: second gets conflict.
- Frozen demo mode: PUT returns frozen error (503 FROZEN).
- Existing decisions keep the charter version they used.
- Complete version history maintained (append-only, never mutated in place).
"""

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from agent.app.db.models import Charter, Decision
from agent.app.db.session import get_engine, get_session_factory
from agent.app.domain.enums import ActionType, DisputeReason, Verdict
from agent.app.errors import ConflictVersionError
from agent.app.main import create_app
from agent.app.policy.charter import (
    CharterData,
    MoneyLimit,
    UpdateCharterRequest,
    get_charter_by_version,
    get_charter_history,
    get_or_seed_charter,
    update_charter,
)
from agent.app.settings import AppEnv, Settings


@pytest.fixture(scope="session")
def engine():
    return get_engine()


@pytest.fixture
def db_session(engine) -> Session:
    session_factory = get_session_factory(engine)
    session = session_factory()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def clean_charters(db_session: Session):
    """Ensure clean charter state for test runs."""
    db_session.execute(delete(Charter).where(Charter.merchant_id == "test_merchant"))
    db_session.execute(delete(Charter).where(Charter.merchant_id == "default"))
    db_session.commit()
    yield
    db_session.execute(delete(Charter).where(Charter.merchant_id == "test_merchant"))
    db_session.execute(delete(Charter).where(Charter.merchant_id == "default"))
    db_session.commit()


@pytest.fixture
def app_settings() -> Settings:
    return Settings(
        app_env=AppEnv.test,
        paypal_client_id="test_client_id",
        paypal_client_secret="test_secret",
        approval_token_secret="test_approval_token_secret_32_bytes_minimum",
        demo_frozen=False,
    )


@pytest.fixture
def client(app_settings: Settings) -> TestClient:
    app = create_app(app_settings)
    return TestClient(app)


# --- Unit Tests: MoneyLimit & CharterData Validation ---


def test_moneylimit_accepts_valid_decimal_and_string():
    """MoneyLimit accepts valid 2-decimal strings and Decimal."""
    limit1 = MoneyLimit(currency_code="USD", value=Decimal("25.00"))
    assert limit1.value == Decimal("25.00")
    assert limit1.currency_code == "USD"

    limit2 = MoneyLimit(currency_code="USD", value="0.00")  # type: ignore
    assert limit2.value == Decimal("0.00")


def test_moneylimit_rejects_floats():
    """Floats are strictly rejected to prevent precision loss."""
    with pytest.raises((TypeError, ValueError, ValidationError)):
        MoneyLimit(currency_code="USD", value=25.0)  # type: ignore


def test_moneylimit_rejects_negative_value():
    """Negative limits are rejected."""
    with pytest.raises((TypeError, ValueError, ValidationError)):
        MoneyLimit(currency_code="USD", value=Decimal("-1.00"))


def test_moneylimit_rejects_more_than_two_decimals():
    """Values with more than two decimal places are rejected."""
    with pytest.raises((TypeError, ValueError, ValidationError)):
        MoneyLimit(currency_code="USD", value="25.001")  # type: ignore


def test_moneylimit_rejects_non_usd_currency():
    """Currencies different from merchant currency (USD) are rejected."""
    with pytest.raises((TypeError, ValueError, ValidationError)):
        MoneyLimit(currency_code="EUR", value=Decimal("25.00"))


def test_charter_data_forbids_extra_fields():
    """Model forbids extra fields."""
    valid_payload = {
        "auto_offer_max": {"currency_code": "USD", "value": "25.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
        "never_auto_reasons": [],
        "never_auto_actions": [],
        "repeat_disputer_threshold": 2,
        "auto_provide_evidence": True,
        "auto_send_message": True,
        "extra_sneaky_field": "disallowed",
    }
    with pytest.raises(ValidationError):
        CharterData.model_validate(valid_payload)


def test_charter_data_normalizes_duplicates():
    """Duplicates in reasons and actions are normalized while preserving valid enums."""
    payload = {
        "auto_offer_max": {"currency_code": "USD", "value": "25.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
        "never_auto_reasons": ["UNAUTHORISED", "CREDIT_NOT_PROCESSED", "UNAUTHORISED"],
        "never_auto_actions": ["ESCALATE", "APPEAL", "ESCALATE"],
        "repeat_disputer_threshold": 2,
        "auto_provide_evidence": True,
        "auto_send_message": True,
    }
    charter = CharterData.model_validate(payload)
    assert charter.never_auto_reasons == [
        DisputeReason.UNAUTHORISED,
        DisputeReason.CREDIT_NOT_PROCESSED,
    ]
    assert charter.never_auto_actions == [
        ActionType.ESCALATE,
        ActionType.APPEAL,
    ]


def test_charter_data_rejects_unknown_reason_and_action():
    """Unknown enum names for reasons or actions fail validation."""
    with pytest.raises(ValidationError):
        CharterData.model_validate({
            "auto_offer_max": {"currency_code": "USD", "value": "25.00"},
            "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
            "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
            "never_auto_reasons": ["NON_EXISTENT_REASON"],
            "never_auto_actions": [],
        })

    with pytest.raises(ValidationError):
        CharterData.model_validate({
            "auto_offer_max": {"currency_code": "USD", "value": "25.00"},
            "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
            "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
            "never_auto_reasons": [],
            "never_auto_actions": ["INVALID_ACTION"],
        })


# --- DB Service Tests: Versioning & Idempotence ---


def test_get_or_seed_charter_creates_version_1(db_session: Session):
    """Initial call seeds default charter version 1; subsequent calls return same row."""
    charter1 = get_or_seed_charter(db_session, merchant_id="test_merchant")
    assert charter1.version == 1
    assert charter1.is_active is True
    assert charter1.config["auto_offer_max"]["value"] == "25.00"

    charter2 = get_or_seed_charter(db_session, merchant_id="test_merchant")
    assert charter2.id == charter1.id
    assert charter2.version == 1


def test_update_charter_increments_version_and_preserves_history(db_session: Session):
    """Updating charter deactivates old version and inserts new version."""
    get_or_seed_charter(db_session, merchant_id="test_merchant")

    req = UpdateCharterRequest(
        base_version=1,
        auto_offer_max=MoneyLimit(currency_code="USD", value=Decimal("35.00")),
        auto_accept_max=MoneyLimit(currency_code="USD", value=Decimal("15.00")),
        auto_act_max_dispute_amount=MoneyLimit(currency_code="USD", value=Decimal("150.00")),
        never_auto_reasons=[DisputeReason.UNAUTHORISED],
        never_auto_actions=[ActionType.ESCALATE],
        repeat_disputer_threshold=3,
        auto_provide_evidence=False,
        auto_send_message=True,
    )
    v2 = update_charter(db_session, req, merchant_id="test_merchant")
    db_session.commit()

    assert v2.version == 2
    assert v2.is_active is True
    assert v2.config["auto_offer_max"]["value"] == "35.00"

    # Historical v1 is still in DB, inactive
    v1 = get_charter_by_version(db_session, version=1, merchant_id="test_merchant")
    assert v1.is_active is False
    assert v1.version == 1
    assert v1.config["auto_offer_max"]["value"] == "25.00"

    # History list has newest first
    history = get_charter_history(db_session, merchant_id="test_merchant")
    assert len(history) == 2
    assert history[0].version == 2
    assert history[1].version == 1


def test_update_charter_detects_version_conflict(db_session: Session):
    """Attempting update based on stale base_version raises ConflictVersionError."""
    get_or_seed_charter(db_session, merchant_id="test_merchant")

    # Update to v2
    req_v1 = UpdateCharterRequest(
        base_version=1,
        auto_offer_max=MoneyLimit(currency_code="USD", value=Decimal("30.00")),
        auto_accept_max=MoneyLimit(currency_code="USD", value=Decimal("25.00")),
        auto_act_max_dispute_amount=MoneyLimit(currency_code="USD", value=Decimal("100.00")),
    )
    update_charter(db_session, req_v1, merchant_id="test_merchant")
    db_session.commit()

    # Second client tries updating with base_version=1 when active is v2
    with pytest.raises(ConflictVersionError) as excinfo:
        update_charter(db_session, req_v1, merchant_id="test_merchant")
    assert "conflict" in str(excinfo.value).lower()


# --- API Tests: GET /api/charter, PUT /api/charter, Validation, Frozen ---


def test_get_api_charter_returns_default_seeded_charter(client: TestClient):
    """GET /api/charter returns seeded charter v1."""
    resp = client.get("/api/charter")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == 1
    assert data["auto_offer_max"] == {"currency_code": "USD", "value": "25.00"}
    assert data["auto_accept_max"] == {"currency_code": "USD", "value": "25.00"}
    assert data["auto_act_max_dispute_amount"] == {"currency_code": "USD", "value": "100.00"}
    assert data["repeat_disputer_threshold"] == 2
    assert data["auto_provide_evidence"] is True
    assert data["auto_send_message"] is True


def test_put_api_charter_creates_new_version(client: TestClient):
    """PUT /api/charter successfully creates v2 and returns updated response."""
    # First ensure v1 exists
    client.get("/api/charter")

    update_payload = {
        "base_version": 1,
        "auto_offer_max": {"currency_code": "USD", "value": "50.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "30.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "200.00"},
        "never_auto_reasons": ["UNAUTHORISED"],
        "never_auto_actions": ["ESCALATE", "APPEAL"],
        "repeat_disputer_threshold": 3,
        "auto_provide_evidence": True,
        "auto_send_message": False,
    }
    resp = client.put("/api/charter", json=update_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == 2
    assert data["auto_offer_max"]["value"] == "50.00"
    assert data["auto_send_message"] is False

    # GET /api/charter now returns version 2
    get_resp = client.get("/api/charter")
    assert get_resp.status_code == 200
    assert get_resp.json()["version"] == 2

    # GET /api/charter?version=1 retrieves original v1
    v1_resp = client.get("/api/charter?version=1")
    assert v1_resp.status_code == 200
    assert v1_resp.json()["version"] == 1
    assert v1_resp.json()["auto_offer_max"]["value"] == "25.00"

    # GET /api/charter/history has both versions
    history_resp = client.get("/api/charter/history")
    assert history_resp.status_code == 200
    items = history_resp.json()
    assert len(items) >= 2
    assert items[0]["version"] == 2
    assert items[1]["version"] == 1


def test_put_api_charter_stale_base_version_returns_409_conflict(client: TestClient):
    """PUT /api/charter with stale base_version returns 409 CONFLICT_VERSION."""
    client.get("/api/charter")

    payload = {
        "base_version": 1,
        "auto_offer_max": {"currency_code": "USD", "value": "40.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
        "never_auto_reasons": [],
        "never_auto_actions": [],
        "repeat_disputer_threshold": 2,
        "auto_provide_evidence": True,
        "auto_send_message": True,
    }
    # First save moves version to 2
    resp1 = client.put("/api/charter", json=payload)
    assert resp1.status_code == 200
    assert resp1.json()["version"] == 2

    # Second save still based on version 1 results in conflict
    resp2 = client.put("/api/charter", json=payload)
    assert resp2.status_code == 409
    body = resp2.json()
    assert body["error"]["code"] == "CONFLICT_VERSION"


def test_put_api_charter_frozen_mode_returns_503(app_settings: Settings):
    """When demo_frozen is True, PUT /api/charter returns 503 FROZEN."""
    frozen_settings = app_settings.model_copy(update={"demo_frozen": True})
    app = create_app(frozen_settings)
    client = TestClient(app)

    payload = {
        "base_version": 1,
        "auto_offer_max": {"currency_code": "USD", "value": "30.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
        "never_auto_reasons": [],
        "never_auto_actions": [],
        "repeat_disputer_threshold": 2,
        "auto_provide_evidence": True,
        "auto_send_message": True,
    }
    resp = client.put("/api/charter", json=payload)
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"]["code"] == "FROZEN"


# --- Validation Error Matrix with Field Paths (422) ---


@pytest.mark.parametrize(
    "patch,expected_field",
    [
        ({"auto_offer_max": {"currency_code": "USD", "value": "-5.00"}}, "auto_offer_max.value"),
        ({"auto_offer_max": {"currency_code": "USD", "value": "25.005"}}, "auto_offer_max.value"),
        ({"auto_offer_max": {"currency_code": "EUR", "value": "25.00"}}, "auto_offer_max.currency_code"),
        ({"never_auto_reasons": ["UNKNOWN_REASON"]}, "never_auto_reasons.0"),
        ({"never_auto_actions": ["INVALID_ACTION"]}, "never_auto_actions.0"),
        ({"repeat_disputer_threshold": -1}, "repeat_disputer_threshold"),
        ({"unrecognized_extra": "forbidden"}, "unrecognized_extra"),
    ],
)
def test_put_api_charter_validation_matrix_reports_field_paths(
    client: TestClient, patch: dict, expected_field: str
):
    """Edge cases: Negative limits, >2 decimals, currency mismatch, invalid enums return 422 with field paths."""
    client.get("/api/charter")

    base_payload = {
        "base_version": 1,
        "auto_offer_max": {"currency_code": "USD", "value": "25.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "25.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "100.00"},
        "never_auto_reasons": [],
        "never_auto_actions": [],
        "repeat_disputer_threshold": 2,
        "auto_provide_evidence": True,
        "auto_send_message": True,
    }
    base_payload.update(patch)

    resp = client.put("/api/charter", json=base_payload)
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "VALIDATION_FAILED"
    field_paths = [f["path"] for f in body["error"]["fields"]]
    assert any(expected_field in p for p in field_paths), (
        f"Expected {expected_field} in field paths {field_paths}"
    )


def test_existing_decisions_retain_used_charter_version(db_session: Session, client: TestClient):
    """Existing decisions in the database keep the charter version they were evaluated against."""
    # Seed v1
    client.get("/api/charter")

    # Record a decision with charter_version=1
    decision_id = uuid.uuid4()
    decision = Decision(
        id=decision_id,
        dispute_id="PP-D-TEST-DECISION",
        action_type=ActionType.PROVIDE_EVIDENCE.value,
        verdict=Verdict.ALLOW.value,
        rule_id="G7-01",
        reason="Evidence submission permitted under charter v1",
        action_hash="hash_v1",
        dispute_fingerprint="fp_v1",
        charter_version=1,
    )
    db_session.add(decision)
    db_session.commit()

    # Now update charter to version 2
    update_payload = {
        "base_version": 1,
        "auto_offer_max": {"currency_code": "USD", "value": "60.00"},
        "auto_accept_max": {"currency_code": "USD", "value": "60.00"},
        "auto_act_max_dispute_amount": {"currency_code": "USD", "value": "250.00"},
        "never_auto_reasons": [],
        "never_auto_actions": [],
        "repeat_disputer_threshold": 2,
        "auto_provide_evidence": True,
        "auto_send_message": True,
    }
    resp = client.put("/api/charter", json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["version"] == 2

    # Check decision record: charter_version remains 1!
    stored_decision = db_session.execute(
        select(Decision).where(Decision.id == decision_id)
    ).scalar_one()
    assert stored_decision.charter_version == 1, "Decision charter_version must remain unchanged"
