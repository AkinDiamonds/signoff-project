"""FastAPI implementation of the fixture-driven PayPal stub.

Only the endpoints needed by Signoff are implemented. Every response uses the
recorded fixture shapes so the agent's real boundary models can parse them.
"""

import asyncio
import json
import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from scripts.paypal_stub.state import ALLOWED_AFTER_RESOLUTION, StubState, load_fixture, summary_view

STUB_SIGNATURE = "STUB-SIGNATURE"


class FaultRequest(BaseModel):
    duplicate_delivery: bool | None = None
    out_of_order: bool | None = None
    delivery_delay_seconds: float | None = None
    fail_next_calls: int | None = None
    latency_ms: int | None = None


class EmitRequest(BaseModel):
    dispute_id: str
    event_types: list[str] = Field(default_factory=lambda: ["CUSTOMER.DISPUTE.CREATED"])
    target_url: str | None = None


def _error(status: int, name: str, issue: str, message: str) -> JSONResponse:
    """PayPal's recorded error envelope shape."""
    return JSONResponse(
        status_code=status,
        content={
            "name": name,
            "details": [{"issue": issue, "description": message}],
            "message": message,
            "debug_id": "STUB-DEBUG-0001",
        },
    )


def _form_value(body: bytes, field: str) -> str | None:
    """Best-effort read of a field from a multipart or JSON body without extra dependencies."""
    text = body.decode("utf-8", errors="ignore")
    match = re.search(rf'"{field}"\s*:\s*"([^"]*)"', text)
    return match.group(1) if match else None


def create_stub_app() -> FastAPI:
    """Build a fresh stub app. Refuses to start in production."""
    if os.environ.get("APP_ENV", "local").lower() == "prod":
        raise RuntimeError("PayPal stub cannot start when APP_ENV=prod")

    app = FastAPI(title="Signoff PayPal Stub", version="0.1.0")
    state = StubState()
    app.state.stub = state

    @app.middleware("http")
    async def fault_middleware(request: Request, call_next: Any) -> Any:
        if request.url.path.startswith("/__stub__") or request.url.path == "/health":
            return await call_next(request)
        if state.config.latency_ms:
            await asyncio.sleep(state.config.latency_ms / 1000)
        if state.config.fail_next_calls > 0:
            state.config.fail_next_calls -= 1
            return _error(500, "INTERNAL_SERVER_ERROR", "INTERNAL_ERROR", "Simulated PayPal failure")
        return await call_next(request)

    # --- PayPal API ---

    @app.post("/v1/oauth2/token")
    async def token() -> dict[str, Any]:
        return load_fixture("s2-token-response.json")

    @app.get("/v1/customer/disputes")
    async def list_disputes() -> dict[str, Any]:
        items = [summary_view(dispute) for dispute in state.disputes.values()]
        return {
            "items": items,
            "links": [
                {"href": "https://api-m.sandbox.paypal.com/v1/customer/disputes", "rel": "self", "method": "GET"},
                {"href": "https://api-m.sandbox.paypal.com/v1/customer/disputes", "rel": "first", "method": "GET"},
            ],
        }

    @app.post("/v1/customer/disputes", status_code=201)
    async def create_dispute(request: Request) -> Any:
        payload = await _json_body(request)
        if payload is None:
            return _error(400, "INVALID_REQUEST", "INVALID_PARAMETER", "Request body must be a JSON object")
        return state.create_dispute(payload)

    @app.get("/v1/customer/disputes/{dispute_id}")
    async def get_dispute(dispute_id: str) -> Any:
        dispute = state.get_dispute(dispute_id)
        if dispute is None:
            return _error(404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID", "The specified dispute does not exist")
        return dispute

    @app.post("/v1/customer/disputes/{dispute_id}/provide-evidence")
    async def provide_evidence(dispute_id: str, request: Request) -> Any:
        dispute, error = await _mutable_dispute(request, dispute_id, "provide-evidence")
        if error is not None:
            return error
        assert dispute is not None
        body = await request.body()
        evidence_type = _form_value(body, "evidence_type") or "PROOF_OF_FULFILLMENT"
        notes = _form_value(body, "notes")
        return state.add_evidence(dispute, evidence_type, notes)

    @app.post("/v1/customer/disputes/{dispute_id}/make-offer")
    async def make_offer(dispute_id: str, request: Request) -> Any:
        dispute, error = await _mutable_dispute(request, dispute_id, "make-offer")
        if error is not None:
            return error
        assert dispute is not None
        payload = await _json_body(request)
        if payload is None or not isinstance(payload.get("offer_amount"), dict):
            return _error(422, "UNPROCESSABLE_ENTITY", "MISSING_REQUIRED_PARAMETER", "offer_amount is required")
        return state.make_offer(
            dispute,
            payload.get("offer_type", "REFUND"),
            payload["offer_amount"],
            payload.get("note"),
        )

    @app.post("/v1/customer/disputes/{dispute_id}/accept-claim")
    async def accept_claim(dispute_id: str, request: Request) -> Any:
        dispute, error = await _mutable_dispute(request, dispute_id, "accept-claim")
        if error is not None:
            return error
        assert dispute is not None
        payload = await _json_body(request) or {}
        amount = payload.get("refund_amount")
        return state.accept_claim(dispute, payload.get("accept_claim_type", "REFUND"), amount)

    @app.post("/v1/customer/disputes/{dispute_id}/send-message")
    async def send_message(dispute_id: str, request: Request) -> Any:
        dispute, error = await _mutable_dispute(request, dispute_id, "send-message")
        if error is not None:
            return error
        assert dispute is not None
        payload = await _json_body(request) or {}
        message = payload.get("message")
        if not message:
            return _error(422, "UNPROCESSABLE_ENTITY", "MISSING_REQUIRED_PARAMETER", "message is required")
        return state.send_message(dispute, message)

    @app.post("/v1/customer/disputes/{dispute_id}/escalate")
    async def escalate(dispute_id: str, request: Request) -> Any:
        dispute, error = await _mutable_dispute(request, dispute_id, "escalate")
        if error is not None:
            return error
        assert dispute is not None
        return state.escalate(dispute)

    @app.post("/v1/customer/disputes/{dispute_id}/appeal")
    async def appeal(dispute_id: str, request: Request) -> Any:
        dispute, error = await _mutable_dispute(request, dispute_id, "appeal")
        if error is not None:
            return error
        assert dispute is not None
        dispute["status"] = "UNDER_REVIEW"
        dispute["dispute_state"] = "UNDER_REVIEW"
        state.touch(dispute)
        return {"links": [state.link(dispute_id)]}

    @app.post("/v2/checkout/orders", status_code=201)
    async def create_order(request: Request) -> Any:
        payload = await _json_body(request)
        if payload is None:
            return _error(400, "INVALID_REQUEST", "INVALID_PARAMETER", "Request body must be a JSON object")
        return state.create_order(payload)

    @app.post("/v2/checkout/orders/{order_id}/capture", status_code=201)
    async def capture_order(order_id: str) -> Any:
        order = state.capture_order(order_id)
        if order is None:
            return _error(404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID", "The specified order does not exist")
        return order

    @app.get("/v2/checkout/orders/{order_id}")
    async def get_order(order_id: str) -> Any:
        order = state.orders.get(order_id)
        if order is None:
            return _error(404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID", "The specified order does not exist")
        return order


    # --- Test-only controls ---

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/__stub__/reset")
    async def reset() -> dict[str, str]:
        state.reset()
        return {"status": "reset"}

    @app.get("/__stub__/state")
    async def dump_state() -> dict[str, Any]:
        return {"disputes": state.disputes, "orders": state.orders, "config": state.config.__dict__}

    @app.post("/__stub__/faults")
    async def configure_faults(config: FaultRequest) -> dict[str, Any]:
        for key, value in config.model_dump(exclude_none=True).items():
            setattr(state.config, key, value)
        return state.config.__dict__

    @app.post("/__stub__/webhooks")
    async def emit_webhooks(request: Request, body: EmitRequest) -> Any:
        event_types = list(body.event_types)
        if state.config.out_of_order:
            event_types.reverse()

        events = []
        for event_type in event_types:
            event = state.build_event(body.dispute_id, event_type)
            if event is None:
                return _error(404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID", "The specified dispute does not exist")
            events.append(event)

        if state.config.duplicate_delivery:
            events = [event for event in events for _ in range(2)]

        target = (body.target_url or os.environ.get("STUB_AGENT_URL", "http://localhost:8000")).rstrip("/")
        client = getattr(request.app.state, "delivery_client", None)
        owns_client = client is None
        if client is None:
            client = httpx.AsyncClient(timeout=10.0)

        statuses: list[int] = []
        try:
            for event in events:
                if state.config.delivery_delay_seconds:
                    await asyncio.sleep(state.config.delivery_delay_seconds)
                response = await client.post(
                    f"{target}/webhooks/paypal",
                    content=json.dumps(event).encode("utf-8"),
                    headers=_signature_headers(event),
                )
                statuses.append(response.status_code)
        finally:
            if owns_client:
                await client.aclose()

        return {"delivered": len(statuses), "status_codes": statuses}

    async def _mutable_dispute(
        request: Request, dispute_id: str, action: str
    ) -> tuple[dict[str, Any] | None, JSONResponse | None]:
        dispute = state.get_dispute(dispute_id)
        if dispute is None:
            return None, _error(
                404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID", "The specified dispute does not exist"
            )
        if state.is_resolved(dispute) and action not in ALLOWED_AFTER_RESOLUTION:
            return None, _error(
                422,
                "UNPROCESSABLE_ENTITY",
                "ACTION_NOT_ALLOWED",
                f"Action '{action}' is not allowed after the dispute is resolved",
            )
        return dispute, None

    return app


async def _json_body(request: Request) -> dict[str, Any] | None:
    try:
        payload = await request.json()
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _signature_headers(event: dict[str, Any]) -> dict[str, str]:
    """Headers the StubWebhookVerifier accepts; real PayPal verification rejects them."""
    return {
        "Content-Type": "application/json",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://localhost/stub-cert.pem",
        "paypal-transmission-id": event["id"],
        "paypal-transmission-sig": STUB_SIGNATURE,
        "paypal-transmission-time": event["create_time"],
    }


# NOTE: Do not instantiate a module-level `app` here.
# Use `create_stub_app()` directly (e.g. from main.py or tests).
# A module-level call would run the prod-guard and load fixtures at import
# time, before any environment variable patching by tests or deployment.
