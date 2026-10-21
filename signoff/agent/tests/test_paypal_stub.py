"""Self-tests, drift checks and fault-injection tests for the PayPal stub."""

import json
from typing import Any

import httpx
import pytest

from agent.app.paypal.models import (
    parse_dispute,
    parse_dispute_list,
    parse_provide_evidence_response,
    parse_token_response,
    parse_webhook_event,
)
from agent.app.paypal.mutating_client import PayPalMutatingClient
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.paypal.webhook_verify import StubWebhookVerifier
from scripts.paypal_stub.app import create_stub_app
from scripts.paypal_stub.state import load_fixture


def api_client(app: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://stub")


def key_tree(value: Any) -> Any:
    """Recursively compare response shape, ignoring values."""
    if isinstance(value, dict):
        return {key: key_tree(item) for key, item in value.items()}
    if isinstance(value, list):
        return [key_tree(value[0])] if value else []
    return type(value).__name__


@pytest.mark.asyncio
async def test_every_stub_response_parses_with_real_models():
    app = create_stub_app()
    async with api_client(app) as client:
        assert parse_token_response((await client.post("/v1/oauth2/token")).json())
        assert parse_dispute_list((await client.get("/v1/customer/disputes")).json())
        assert parse_dispute((await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")).json())
        assert parse_provide_evidence_response(
            (
                await client.post(
                    "/v1/customer/disputes/PP-R-MBX-REDACTED/provide-evidence",
                    files={"input": (None, json.dumps({"evidence_type": "PROOF_OF_FULFILLMENT"}))},
                )
            ).json()
        )
    assert parse_webhook_event(app.state.stub.build_event("PP-R-MBX-REDACTED", "CUSTOMER.DISPUTE.UPDATED"))


@pytest.mark.asyncio
async def test_stub_shapes_match_recorded_fixtures():
    app = create_stub_app()
    async with api_client(app) as client:
        dispute = (await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")).json()
        listed = (await client.get("/v1/customer/disputes")).json()["items"][0]
        token = (await client.post("/v1/oauth2/token")).json()
        evidence = (
            await client.post(
                "/v1/customer/disputes/PP-R-MBX-REDACTED/provide-evidence",
                files={"input": (None, json.dumps({"evidence_type": "PROOF_OF_FULFILLMENT"}))},
            )
        ).json()

    assert key_tree(dispute) == key_tree(load_fixture("s5-get-dispute.json"))
    assert key_tree(listed) == key_tree(load_fixture("s5-list-disputes.json")["items"][0])
    assert key_tree(token) == key_tree(load_fixture("s2-token-response.json"))
    assert key_tree(evidence) == key_tree(load_fixture("s7-provide-evidence-response.json"))
    event = app.state.stub.build_event("PP-R-MBX-REDACTED", "CUSTOMER.DISPUTE.CREATED")
    assert key_tree(event) == key_tree(load_fixture("s6-webhook-event.json"))


@pytest.mark.asyncio
async def test_mutating_calls_apply_recorded_state_transitions():
    app = create_stub_app()
    async with api_client(app) as client:
        await client.post(
            "/v1/customer/disputes/PP-R-MBX-REDACTED/make-offer",
            json={"offer_type": "REFUND", "offer_amount": {"currency_code": "USD", "value": "5.00"}},
        )
        offered = (await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")).json()
        assert offered["status"] == "WAITING_FOR_BUYER_RESPONSE"
        assert offered["offer"]["amount"]["value"] == "5.00"

        await client.post(
            "/v1/customer/disputes/PP-R-MBX-REDACTED/accept-claim",
            json={"accept_claim_type": "REFUND"},
        )
        resolved = (await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")).json()
        assert resolved["status"] == "RESOLVED"
        assert resolved["dispute_state"] == "RESOLVED"
        assert resolved["allowed_response_options"] == {}


@pytest.mark.asyncio
async def test_illegal_transition_after_resolution_returns_paypal_error_shape():
    app = create_stub_app()
    async with api_client(app) as client:
        await client.post(
            "/v1/customer/disputes/PP-R-MBX-REDACTED/accept-claim",
            json={"accept_claim_type": "REFUND"},
        )
        response = await client.post(
            "/v1/customer/disputes/PP-R-MBX-REDACTED/provide-evidence",
            files={"input": (None, json.dumps({"evidence_type": "PROOF_OF_FULFILLMENT"}))},
        )

    body = response.json()
    assert response.status_code == 422
    assert set(body) == {"name", "details", "message", "debug_id"}
    assert body["name"] == "UNPROCESSABLE_ENTITY"
    assert body["details"][0]["issue"] == "ACTION_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_reset_fully_restores_initial_state():
    app = create_stub_app()
    async with api_client(app) as client:
        await client.post("/__stub__/faults", json={"fail_next_calls": 2, "latency_ms": 50})
        await client.post(
            "/v1/customer/disputes/PP-R-MBX-REDACTED/accept-claim",
            json={"accept_claim_type": "REFUND"},
        )
        reset = await client.post("/__stub__/reset")
        dispute = (await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")).json()
        state = (await client.get("/__stub__/state")).json()

    assert reset.status_code == 200
    assert dispute == load_fixture("s5-get-dispute.json")
    assert state["config"] == {
        "duplicate_delivery": False,
        "out_of_order": False,
        "delivery_delay_seconds": 0.0,
        "fail_next_calls": 0,
        "latency_ms": 0,
    }


@pytest.mark.asyncio
async def test_fail_next_calls_returns_500_then_recovers():
    app = create_stub_app()
    async with api_client(app) as client:
        await client.post("/__stub__/faults", json={"fail_next_calls": 1})
        failed = await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")
        recovered = await client.get("/v1/customer/disputes/PP-R-MBX-REDACTED")

    assert failed.status_code == 500
    assert failed.json()["name"] == "INTERNAL_SERVER_ERROR"
    assert recovered.status_code == 200


@pytest.mark.asyncio
async def test_webhook_emitter_duplicates_and_reorders_and_uses_stub_signature():
    app = create_stub_app()
    delivered: list[tuple[dict[str, Any], dict[str, str], bytes]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        delivered.append((json.loads(request.content), dict(request.headers), request.content))
        return httpx.Response(200, json={"status": "ok"})

    mock = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    app.state.delivery_client = mock
    try:
        async with api_client(app) as client:
            await client.post(
                "/__stub__/faults",
                json={"duplicate_delivery": True, "out_of_order": True, "delivery_delay_seconds": 0.001},
            )
            response = await client.post(
                "/__stub__/webhooks",
                json={
                    "dispute_id": "PP-R-MBX-REDACTED",
                    "event_types": ["CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.UPDATED"],
                    "target_url": "http://agent",
                },
            )
    finally:
        await mock.aclose()

    assert response.status_code == 200
    assert response.json()["delivered"] == 4
    types = [event["event_type"] for event, _, _ in delivered]
    assert types == [
        "CUSTOMER.DISPUTE.UPDATED",
        "CUSTOMER.DISPUTE.UPDATED",
        "CUSTOMER.DISPUTE.CREATED",
        "CUSTOMER.DISPUTE.CREATED",
    ]
    assert delivered[0][0]["id"] == delivered[1][0]["id"]

    # The stub signature is accepted by the stub verifier.
    event, headers, body = delivered[0]
    verified = await StubWebhookVerifier().verify(headers, body)
    assert verified.event_id == event["id"]


@pytest.mark.asyncio
async def test_read_and_mutating_clients_work_against_asgi_stub(monkeypatch):
    monkeypatch.setenv("PAYPAL_ENV", "stub")
    monkeypatch.setenv("PAYPAL_BASE_URL", "http://localhost:4010")
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "stub-id")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "stub-secret")

    app = create_stub_app()
    http_client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app))
    read_client = PayPalReadClient(http_client=http_client)
    mutating_client = PayPalMutatingClient(http_client=http_client)

    dispute = await read_client.get_dispute("PP-R-MBX-REDACTED")
    assert dispute.dispute_id == "PP-R-MBX-REDACTED"

    result = await mutating_client.send_message("PP-R-MBX-REDACTED", message="Hello")
    assert result.status_code == 200

    updated = await read_client.get_dispute("PP-R-MBX-REDACTED")
    assert updated.messages[-1].content == "Hello"
    await read_client.close()
    await http_client.aclose()


@pytest.mark.asyncio
async def test_buyer_creates_dispute_with_deterministic_id():
    app = create_stub_app()
    async with api_client(app) as client:
        created = await client.post(
            "/v1/customer/disputes",
            json={
                "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                "dispute_amount": {"currency_code": "USD", "value": "12.00"},
            },
        )
        fetched = await client.get("/v1/customer/disputes/PP-STUB-0001")

    assert created.status_code == 201
    assert created.json()["dispute_id"] == "PP-STUB-0001"
    assert fetched.json()["dispute_amount"]["value"] == "12.00"
    assert fetched.json()["status"] == "WAITING_FOR_SELLER_RESPONSE"


@pytest.mark.asyncio
async def test_order_create_and_capture():
    app = create_stub_app()
    async with api_client(app) as client:
        created = await client.post(
            "/v2/checkout/orders",
            json={"purchase_units": [{"amount": {"currency_code": "USD", "value": "19.00"}}]},
        )
        captured = await client.post(f"/v2/checkout/orders/{created.json()['id']}/capture")

    assert created.status_code == 201
    assert created.json()["id"] == "STUB-ORDER-0001"
    assert captured.status_code == 201
    assert captured.json()["status"] == "COMPLETED"
    assert captured.json()["purchase_units"][0]["payments"]["captures"][0]["status"] == "COMPLETED"


def test_stub_refuses_to_start_in_prod(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")
    with pytest.raises(RuntimeError, match="cannot start when APP_ENV=prod"):
        create_stub_app()
