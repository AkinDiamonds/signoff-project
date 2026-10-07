"""Contract tests for PayPal models, parsers, and dispute state fingerprint.

Tests all behaviors, edge cases, and invariants defined in Step 05 and build-plan/contracts.md.
"""

import json
from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, get_args, get_origin

import pytest
from pydantic import BaseModel, ValidationError

from agent.app.domain.enums import DisputeReason, DisputeStatus
from agent.app.paypal.fingerprint import Fingerprint, compute_dispute_fingerprint
from agent.app.paypal.models import (
    Dispute,
    DisputeListResponse,
    DisputeMessage,
    DisputeSummary,
    Money,
    ProvideEvidenceResponse,
    TokenResponse,
    WebhookEvent,
    parse_dispute,
    parse_dispute_list,
    parse_provide_evidence_response,
    parse_token_response,
    parse_webhook_event,
)


def get_fixtures_dir() -> Path:
    """Find the fixtures/paypal directory robustly."""
    candidates = [
        Path(__file__).resolve().parents[2] / "fixtures" / "paypal",
        Path(__file__).resolve().parents[3] / "signoff" / "fixtures" / "paypal",
        Path("signoff/fixtures/paypal").resolve(),
        Path("fixtures/paypal").resolve(),
    ]
    for c in candidates:
        if c.is_dir():
            return c
    raise FileNotFoundError("Could not find fixtures/paypal directory")


FIXTURES_DIR = get_fixtures_dir()


def load_fixture_json(filename: str) -> dict[str, Any]:
    with open(FIXTURES_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 1. Every fixture parses with its matching model
# ---------------------------------------------------------------------------


def test_fixture_s5_get_dispute_parses():
    data = load_fixture_json("s5-get-dispute.json")
    dispute = parse_dispute(data)
    assert dispute.dispute_id == "PP-R-MBX-REDACTED"
    assert dispute.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE
    assert dispute.reason == DisputeReason.MERCHANDISE_OR_SERVICE_NOT_RECEIVED
    assert dispute.dispute_amount.currency_code == "USD"
    assert dispute.dispute_amount.value == Decimal("10.00")
    assert dispute.create_time.tzinfo == UTC
    assert dispute.seller_response_due_date is not None
    assert dispute.seller_response_due_date.tzinfo == UTC
    assert len(dispute.disputed_transactions) == 1
    assert len(dispute.evidences) == 2
    assert len(dispute.messages) == 1
    assert len(dispute.links) == 6


def test_fixture_s5_list_disputes_parses():
    data = load_fixture_json("s5-list-disputes.json")
    resp = parse_dispute_list(data)
    assert len(resp.items) == 1
    item = resp.items[0]
    assert isinstance(item, DisputeSummary)
    assert item.dispute_id == "PP-R-MBX-REDACTED"
    assert item.status == DisputeStatus.WAITING_FOR_SELLER_RESPONSE
    assert item.dispute_amount.value == Decimal("10.00")
    assert len(resp.links) == 2

    # Verify alias support for PayPal responses returning 'disputes' instead of 'items'
    aliased_data = {"disputes": data["items"], "links": data["links"]}
    aliased_resp = parse_dispute_list(aliased_data)
    assert len(aliased_resp.items) == 1
    assert aliased_resp.items[0].dispute_id == "PP-R-MBX-REDACTED"


def test_fixture_s7_provide_evidence_response_parses():
    data = load_fixture_json("s7-provide-evidence-response.json")
    resp = parse_provide_evidence_response(data)
    assert isinstance(resp, ProvideEvidenceResponse)
    assert len(resp.links) == 1
    assert resp.links[0].rel == "detail"
    assert resp.links[0].method == "GET"


def test_fixture_s2_token_response_parses():
    data = load_fixture_json("s2-token-response.json")
    resp = parse_token_response(data)
    assert isinstance(resp, TokenResponse)
    assert resp.access_token == "ACCESS-TOKEN-REDACTED"
    assert resp.token_type == "Bearer"
    assert resp.expires_in == 32400
    assert resp.scope is not None


def test_fixture_s6_webhook_event_parses():
    data = load_fixture_json("s6-webhook-event.json")
    resp = parse_webhook_event(data)
    assert isinstance(resp, WebhookEvent)
    assert resp.id == "WH-COC77685HG482312T-72534575W0810174W"
    assert resp.event_type == "CUSTOMER.DISPUTE.CREATED"
    assert resp.resource_type == "dispute"
    assert isinstance(resp.resource, dict)

    # Test typed extraction helpers
    dispute_resource = resp.get_resource_dispute()
    assert isinstance(dispute_resource, Dispute)
    assert dispute_resource.dispute_id == "PP-R-MBX-REDACTED"

    summary_resource = resp.get_resource_summary()
    assert isinstance(summary_resource, DisputeSummary)
    assert summary_resource.dispute_id == "PP-R-MBX-REDACTED"


FIXTURE_PARSERS: dict[str, tuple[Any, type]] = {
    "s5-get-dispute.json": (parse_dispute, Dispute),
    "s5-list-disputes.json": (parse_dispute_list, DisputeListResponse),
    "s2-token-response.json": (parse_token_response, TokenResponse),
    "s6-webhook-event.json": (parse_webhook_event, WebhookEvent),
    "s7-provide-evidence-response.json": (parse_provide_evidence_response, ProvideEvidenceResponse),
}


def test_every_file_in_fixtures_directory_parses():
    """Step 05 requirement 4: every file in fixtures/paypal/ parses with matching model."""
    files = list(FIXTURES_DIR.glob("*.json"))
    assert len(files) >= 5, f"Expected at least 5 fixtures, found {len(files)}"

    for fpath in files:
        parser_info = FIXTURE_PARSERS.get(fpath.name)
        if parser_info is None:
            pytest.fail(f"Fixture {fpath.name} does not have a designated contract parser mapping")

        parser_fn, expected_type = parser_info
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)
        model = parser_fn(data)
        assert isinstance(model, expected_type), f"{fpath.name} parsed into {type(model)}, expected {expected_type}"


# ---------------------------------------------------------------------------
# 2. No model field lacks fixture evidence
# ---------------------------------------------------------------------------


def _collect_fixture_keys(filenames: list[str]) -> set[str]:
    """Collect JSON keys present across specific fixture files."""
    keys: set[str] = set()

    def _walk(obj: Any):
        if isinstance(obj, dict):
            for k, v in obj.items():
                keys.add(k)
                _walk(v)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)

    for fname in filenames:
        with open(FIXTURES_DIR / fname, encoding="utf-8") as f:
            _walk(json.load(f))
    return keys


MODEL_FIXTURE_SOURCES: dict[str, list[str]] = {
    "Dispute": ["s5-get-dispute.json"],
    "DisputedTransaction": ["s5-get-dispute.json", "s5-list-disputes.json"],
    "BuyerInfo": ["s5-get-dispute.json", "s5-list-disputes.json"],
    "SellerInfo": ["s5-get-dispute.json", "s5-list-disputes.json"],
    "ItemInfo": ["s5-get-dispute.json"],
    "FundMovement": ["s5-get-dispute.json"],
    "DisputeMessage": ["s5-get-dispute.json"],
    "Extensions": ["s5-get-dispute.json"],
    "Evidence": ["s5-get-dispute.json"],
    "DisputeOffer": ["s5-get-dispute.json"],
    "RefundDetails": ["s5-get-dispute.json"],
    "AcceptClaimOption": ["s5-get-dispute.json"],
    "MakeOfferOption": ["s5-get-dispute.json"],
    "AllowedResponseOptions": ["s5-get-dispute.json"],
    "DisputeSummary": ["s5-list-disputes.json"],
    "DisputeListResponse": ["s5-list-disputes.json"],
    "ProvideEvidenceResponse": ["s7-provide-evidence-response.json"],
    "TokenResponse": ["s2-token-response.json"],
    "OAuthTokenResponse": ["s2-token-response.json"],
    "WebhookEvent": ["s6-webhook-event.json"],
    "Money": ["s5-get-dispute.json", "s5-list-disputes.json"],
    "Link": ["s5-get-dispute.json", "s5-list-disputes.json", "s7-provide-evidence-response.json"],
}


def test_no_model_field_lacks_fixture_evidence():
    """Verify that every field defined on our models has direct evidence in its designated fixtures."""
    import agent.app.paypal.models as pm

    for name, obj in vars(pm).items():
        if isinstance(obj, type) and issubclass(obj, BaseModel) and obj is not BaseModel:
            fixture_files = MODEL_FIXTURE_SOURCES.get(name)
            assert fixture_files is not None, f"Model '{name}' missing from MODEL_FIXTURE_SOURCES registry"
            fixture_keys = _collect_fixture_keys(fixture_files)

            for field_name in obj.model_fields:
                assert (
                    field_name in fixture_keys
                ), f"Model field '{name}.{field_name}' lacks evidence in designated fixtures: {fixture_files}"


# ---------------------------------------------------------------------------
# 3. Fail closed on missing required fields & ignore unknown fields
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "required_field",
    [
        "dispute_id",
        "reason",
        "status",
        "dispute_amount",
        "dispute_state",
        "dispute_life_cycle_stage",
        "create_time",
        "update_time",
    ],
)
def test_parse_dispute_fails_closed_when_required_field_missing(required_field: str):
    raw = load_fixture_json("s5-get-dispute.json")
    del raw[required_field]
    with pytest.raises(ValidationError):
        parse_dispute(raw)


def test_parse_dispute_ignores_unknown_fields():
    raw = load_fixture_json("s5-get-dispute.json")
    raw["unknown_upstream_field"] = "some_value"
    raw["another_extra_payload"] = {"unexpected": 12345}
    dispute = parse_dispute(raw)
    assert dispute.dispute_id == "PP-R-MBX-REDACTED"
    assert not hasattr(dispute, "unknown_upstream_field")


# ---------------------------------------------------------------------------
# 4. Money edge cases
# ---------------------------------------------------------------------------


def test_money_amounts_arrive_as_strings_and_become_decimal():
    m = Money(currency_code="USD", value="42.50")  # type: ignore[arg-type]
    assert isinstance(m.value, Decimal)
    assert m.value == Decimal("42.50")
    assert m.currency_code == "USD"


def test_money_rejects_json_floats():
    with pytest.raises(ValidationError, match="JSON floats are rejected"):
        Money(currency_code="USD", value=42.5)  # type: ignore[arg-type]


def test_money_rejects_zero_or_negative_amounts():
    with pytest.raises(ValidationError, match="must be strictly positive"):
        Money(currency_code="USD", value="0.00")  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="must be strictly positive"):
        Money(currency_code="USD", value="-15.00")  # type: ignore[arg-type]


def test_money_currency_must_be_three_uppercase_letters():
    with pytest.raises(ValidationError, match="three uppercase letters"):
        Money(currency_code="usd", value="10.00")  # lowercase

    with pytest.raises(ValidationError, match="three uppercase letters"):
        Money(currency_code="US", value="10.00")  # 2 letters

    with pytest.raises(ValidationError, match="three uppercase letters"):
        Money(currency_code="USDT", value="10.00")  # 4 letters


# ---------------------------------------------------------------------------
# 5. Allowed response options edge cases
# ---------------------------------------------------------------------------


def test_missing_allowed_response_options_becomes_empty_set_not_crash():
    raw = load_fixture_json("s5-get-dispute.json")
    del raw["allowed_response_options"]
    assert raw["status"] == "WAITING_FOR_SELLER_RESPONSE"

    dispute = parse_dispute(raw)
    assert dispute.allowed_response_options is not None
    assert dispute.allowed_response_options.is_empty


def test_null_allowed_response_options_becomes_empty():
    raw = load_fixture_json("s5-get-dispute.json")
    raw["allowed_response_options"] = None

    dispute = parse_dispute(raw)
    assert dispute.allowed_response_options is not None
    assert dispute.allowed_response_options.is_empty


# ---------------------------------------------------------------------------
# 6. Due date and datetime edge cases
# ---------------------------------------------------------------------------


def test_due_date_absent_becomes_null():
    raw = load_fixture_json("s5-get-dispute.json")
    del raw["seller_response_due_date"]
    dispute = parse_dispute(raw)
    assert dispute.seller_response_due_date is None


def test_dates_with_z_or_offsets_both_parse_to_utc():
    raw = load_fixture_json("s5-get-dispute.json")
    # Date with Z
    raw["create_time"] = "2026-10-05T16:00:00.000Z"
    # Date with offset (+02:00)
    raw["seller_response_due_date"] = "2026-10-25T18:00:00.000+02:00"

    dispute = parse_dispute(raw)
    assert dispute.create_time == datetime(2026, 10, 5, 16, 0, 0, tzinfo=UTC)
    # 18:00 at +02:00 is 16:00 UTC
    assert dispute.seller_response_due_date == datetime(2026, 10, 25, 16, 0, 0, tzinfo=UTC)


def test_naive_datetimes_are_rejected():
    raw = load_fixture_json("s5-get-dispute.json")
    raw["create_time"] = "2026-10-05T16:00:00"  # no tz offset or Z
    with pytest.raises(ValidationError, match="Naive datetimes are rejected"):
        parse_dispute(raw)


# ---------------------------------------------------------------------------
# 7. Message preservation
# ---------------------------------------------------------------------------


def test_very_long_and_non_english_message_preserved():
    raw = load_fixture_json("s5-get-dispute.json")
    long_multilingual_text = (
        "안녕하세요! " + ("This is an extended buyer claim message. " * 300) + " 日本語 / العربية / 📦"
    )
    raw["messages"] = [
        {
            "posted_by": "BUYER",
            "time_posted": "2026-10-05T16:17:43.463Z",
            "content": long_multilingual_text,
        }
    ]
    dispute = parse_dispute(raw)
    assert isinstance(dispute.messages[0], DisputeMessage)
    assert dispute.messages[0].content == long_multilingual_text


# ---------------------------------------------------------------------------
# 8. Type safety: No float annotations and Fingerprint is a distinct type
# ---------------------------------------------------------------------------


def _type_contains_float(t: Any) -> bool:
    if t is float:
        return True
    origin = get_origin(t)
    if origin is not None:
        return any(_type_contains_float(arg) for arg in get_args(t))
    return False


def test_no_float_annotations_anywhere_in_models():
    """Step 05 edge cases: No float annotations anywhere in the models."""
    import agent.app.paypal.models as pm

    for name, obj in vars(pm).items():
        if isinstance(obj, type) and issubclass(obj, BaseModel):
            for field_name, field_info in obj.model_fields.items():
                annotation = field_info.annotation
                assert not _type_contains_float(
                    annotation
                ), f"Found float annotation in {name}.{field_name}: {annotation}"


def test_fingerprint_is_distinct_type():
    data = load_fixture_json("s5-get-dispute.json")
    dispute = parse_dispute(data)
    fp = compute_dispute_fingerprint(dispute)

    assert isinstance(fp, Fingerprint)
    assert isinstance(fp, str)
    assert type(fp) is Fingerprint
    assert len(fp) == 64  # SHA-256 hex digest
    int(fp, 16)  # valid hex


# ---------------------------------------------------------------------------
# 9. Fingerprint sensitivity and stability table
# ---------------------------------------------------------------------------


def test_fingerprint_sensitivity_and_stability():
    base_data = load_fixture_json("s5-get-dispute.json")
    base_dispute = parse_dispute(base_data)
    base_fp = compute_dispute_fingerprint(base_dispute)

    # 1. Reordered links: SAME fingerprint
    d_links_reordered = deepcopy(base_data)
    d_links_reordered["links"] = list(reversed(d_links_reordered["links"]))
    assert compute_dispute_fingerprint(parse_dispute(d_links_reordered)) == base_fp

    # 2. Changed link URL / method: SAME fingerprint (link URLs excluded per contracts.md)
    d_link_changed = deepcopy(base_data)
    d_link_changed["links"][0]["href"] = "https://example.com/changed-link"
    assert compute_dispute_fingerprint(parse_dispute(d_link_changed)) == base_fp

    # 3. Changed create/update timestamps: SAME fingerprint (excluded per contracts.md)
    d_times_changed = deepcopy(base_data)
    d_times_changed["create_time"] = "2026-10-01T00:00:00.000Z"
    d_times_changed["update_time"] = "2026-10-06T12:00:00.000Z"
    assert compute_dispute_fingerprint(parse_dispute(d_times_changed)) == base_fp

    # 4. Reordered evidence list: SAME fingerprint (order excluded per contracts.md)
    d_ev_reordered = deepcopy(base_data)
    d_ev_reordered["evidences"] = list(reversed(d_ev_reordered["evidences"]))
    assert compute_dispute_fingerprint(parse_dispute(d_ev_reordered)) == base_fp

    # 5. Changed status: DIFFERENT fingerprint
    d_status_changed = deepcopy(base_data)
    d_status_changed["status"] = "UNDER_REVIEW"
    assert compute_dispute_fingerprint(parse_dispute(d_status_changed)) != base_fp

    # 6. Changed dispute_state: DIFFERENT fingerprint
    d_state_changed = deepcopy(base_data)
    d_state_changed["dispute_state"] = "RESOLVED"
    assert compute_dispute_fingerprint(parse_dispute(d_state_changed)) != base_fp

    # 7. Changed life-cycle stage: DIFFERENT fingerprint
    d_stage_changed = deepcopy(base_data)
    d_stage_changed["dispute_life_cycle_stage"] = "CHARGEBACK"
    assert compute_dispute_fingerprint(parse_dispute(d_stage_changed)) != base_fp

    # 8. Changed reason: DIFFERENT fingerprint
    d_reason_changed = deepcopy(base_data)
    d_reason_changed["reason"] = "UNAUTHORISED"
    assert compute_dispute_fingerprint(parse_dispute(d_reason_changed)) != base_fp

    # 9. Changed amount: DIFFERENT fingerprint
    d_amount_changed = deepcopy(base_data)
    d_amount_changed["dispute_amount"]["value"] = "25.00"
    assert compute_dispute_fingerprint(parse_dispute(d_amount_changed)) != base_fp

    # 10. Changed due date: DIFFERENT fingerprint
    d_due_changed = deepcopy(base_data)
    d_due_changed["seller_response_due_date"] = "2026-11-15T12:00:00.000Z"
    assert compute_dispute_fingerprint(parse_dispute(d_due_changed)) != base_fp

    # 11. Changed evidence count (add evidence): DIFFERENT fingerprint
    d_ev_added = deepcopy(base_data)
    d_ev_added["evidences"].append({
        "evidence_type": "PROOF_OF_DELIVERY",
        "source": "SUBMITTED_BY_SELLER",
        "date": "2026-10-05T18:00:00.000Z",
    })
    assert compute_dispute_fingerprint(parse_dispute(d_ev_added)) != base_fp

    # 12. Changed offer count: DIFFERENT fingerprint
    d_no_offer = deepcopy(base_data)
    d_no_offer["offer"] = None
    assert compute_dispute_fingerprint(parse_dispute(d_no_offer)) != base_fp

    # 13. Changed message count: DIFFERENT fingerprint
    d_msg_added = deepcopy(base_data)
    d_msg_added["messages"].append({
        "posted_by": "SELLER",
        "time_posted": "2026-10-05T17:00:00.000Z",
        "content": "Follow-up note",
    })
    assert compute_dispute_fingerprint(parse_dispute(d_msg_added)) != base_fp

    # 14. Changed allowed response options: DIFFERENT fingerprint
    d_opts_changed = deepcopy(base_data)
    d_opts_changed["allowed_response_options"]["make_offer"]["offer_types"] = []
    assert compute_dispute_fingerprint(parse_dispute(d_opts_changed)) != base_fp


# ---------------------------------------------------------------------------
# 10. Property test: JSON key order does not matter
# ---------------------------------------------------------------------------


def _shuffle_dict_keys(d: Any, reverse: bool = False) -> Any:
    if isinstance(d, dict):
        keys = sorted(d.keys(), reverse=reverse)
        return {k: _shuffle_dict_keys(d[k], reverse=not reverse) for k in keys}
    if isinstance(d, list):
        return [_shuffle_dict_keys(item, reverse=reverse) for item in d]
    return d


def test_key_ordering_does_not_affect_fingerprint():
    base_data = load_fixture_json("s5-get-dispute.json")
    base_dispute = parse_dispute(base_data)
    base_fp = compute_dispute_fingerprint(base_dispute)

    # Shuffle keys forward and reverse recursively
    shuffled_1 = _shuffle_dict_keys(base_data, reverse=False)
    shuffled_2 = _shuffle_dict_keys(base_data, reverse=True)

    fp1 = compute_dispute_fingerprint(parse_dispute(shuffled_1))
    fp2 = compute_dispute_fingerprint(parse_dispute(shuffled_2))

    assert fp1 == base_fp
    assert fp2 == base_fp
