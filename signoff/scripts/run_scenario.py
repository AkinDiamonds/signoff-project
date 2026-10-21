"""Scenario A and B end-to-end walking path runner.

Per build-plan/steps/21-walking-path.md:
Runs scenario A and B through the stub: webhook, sync, run, gate, execute, confirm, ledger.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Setup path so agent and scripts can be imported cleanly
root_dir = Path(__file__).resolve().parents[2]
agent_dir = root_dir / "signoff" / "agent"
signoff_dir = root_dir / "signoff"
for p in [str(agent_dir), str(signoff_dir), str(root_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from agent.app.agent.budget import DailyBudget
from agent.app.agent.cache import ScenarioCache
from agent.app.agent.llm import FakeProvider, LLMService, ProviderResponse
from agent.app.agent.loop import run_agent_loop
from agent.app.db.base import Base
from agent.app.db.models import Decision, Dispute, Execution, WebhookEvent
from agent.app.db.session import get_db_session, get_session_factory
from agent.app.db.triggers import install_append_only_triggers
from agent.app.domain.enums import ExecutionStatus, JobKind, TimelineEventKind, Verdict
from agent.app.executor.executor import execute_decision
from agent.app.ledger.service import get_timeline_events
from agent.app.main import create_app
from agent.app.paypal.auth import PayPalAuth
from agent.app.paypal.models import parse_dispute
from agent.app.paypal.mutating_client import PayPalMutatingClient
from agent.app.paypal.read_client import PayPalReadClient
from agent.app.policy.charter import get_or_seed_charter
from agent.app.settings import AppEnv, PayPalEnv, Settings
from agent.app.store_mock.seed import seed_scenarios
from scripts.paypal_stub.app import create_stub_app
from scripts.paypal_stub.state import iso

logger = logging.getLogger(__name__)

SCENARIO_CONFIGS = {
    "A": {
        "dispute_id": "PP-SCENARIO-A",
        "transaction_id": "TX-SCENARIO-A",
        "order_code": "SIG-A-1001",
        "amount": "42.00",
        "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "buyer_name": "Alex Morgan",
        "buyer_email": "alex.morgan@example.test",
        "plan_json": json.dumps({
            "actions": [
                {
                    "action_type": "PROVIDE_EVIDENCE",
                    "notes": "Delivered via UPS tracking 1Z999AA10123456784 to buyer address.",
                },
                {
                    "action_type": "SEND_MESSAGE",
                    "message": "Your package was confirmed delivered by UPS.",
                },
            ]
        }),
    },
    "B": {
        "dispute_id": "PP-SCENARIO-B",
        "transaction_id": "TX-SCENARIO-B",
        "order_code": "SIG-B-2001",
        "amount": "38.00",
        "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "buyer_name": "Blair Lee",
        "buyer_email": "blair.lee@example.test",
        "plan_json": json.dumps({
            "actions": [
                {
                    "action_type": "PROVIDE_EVIDENCE",
                    "notes": "Shipped via USPS tracking 9400111899223197428490, in transit.",
                },
                {
                    "action_type": "SEND_MESSAGE",
                    "message": "Your order is currently in transit via USPS.",
                },
            ]
        }),
    },
}


@dataclass
class ScenarioRunResult:
    scenario_id: str
    dispute_id: str
    verdict: str
    rule_id: str
    execution_status: str
    timeline_event_kinds: list[str]
    success: bool


def _signature_headers(event: dict[str, Any]) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://localhost/stub-cert.pem",
        "paypal-transmission-id": event["id"],
        "paypal-transmission-sig": "STUB-SIGNATURE",
        "paypal-transmission-time": event["create_time"],
    }


def seed_stub_dispute(stub_app: Any, config: dict[str, Any]) -> dict[str, Any]:
    """Ensure the target scenario dispute exists in the stub state."""
    state = stub_app.state.stub
    dispute_id = config["dispute_id"]
    now_str = state.now_iso()

    dispute = {
        "dispute_id": dispute_id,
        "create_time": now_str,
        "update_time": now_str,
        "reason": config["reason"],
        "status": "WAITING_FOR_SELLER_RESPONSE",
        "dispute_state": "REQUIRED_ACTION",
        "dispute_amount": {"currency_code": "USD", "value": config["amount"]},
        "dispute_life_cycle_stage": "INQUIRY",
        "dispute_channel": "INTERNAL",
        "disputed_transactions": [
            {
                "buyer_transaction_id": config["transaction_id"],
                "seller_transaction_id": f"TX-SELLER-{config['dispute_id']}",
                "transaction_status": "COMPLETED",
                "gross_amount": {"currency_code": "USD", "value": config["amount"]},
                "buyer": {
                    "payer_id": f"BUYER-{config['dispute_id']}",
                    "name": config["buyer_name"],
                    "email": config["buyer_email"],
                },
                "seller": {
                    "merchant_id": "MOCK-MERCHANT-001",
                    "name": "Signoff Shop",
                },
                "items": [
                    {
                        "item_name": "Fictional item",
                        "quantity": "1",
                        "reason": config["reason"],
                    }
                ],
                "seller_protection_eligible": True,
            }
        ],
        "messages": [
            {
                "posted_by": "BUYER",
                "content": f"Fictional dispute message for {dispute_id}",
                "time_posted": now_str,
            }
        ],
        "evidences": [],
        "seller_response_due_date": iso(datetime.now(UTC) + timedelta(days=10)),
        "allowed_response_options": {
            "accept_claim": {"accept_claim_types": ["REFUND"]},
            "make_offer": {"offer_types": ["REFUND"]},
        },
        "links": [
            state.link(dispute_id, "self"),
            {"href": f"{state.link(dispute_id)['href']}/provide-evidence", "rel": "provide_evidence", "method": "POST"},
            {"href": f"{state.link(dispute_id)['href']}/send-message", "rel": "send_message", "method": "POST"},
            {"href": f"{state.link(dispute_id)['href']}/make-offer", "rel": "make_offer", "method": "POST"},
            {"href": f"{state.link(dispute_id)['href']}/accept-claim", "rel": "accept_claim", "method": "POST"},
        ],
    }
    state.disputes[dispute_id] = dispute
    return dispute


async def run_scenario(
    scenario_id: str,
    *,
    db_session: Session | None = None,
    stub_app: Any | None = None,
    agent_app: Any | None = None,
    llm_service: LLMService | None = None,
) -> ScenarioRunResult:
    """Execute scenario end-to-end: webhook, sync, run, gate, execute, confirm, ledger."""
    config = SCENARIO_CONFIGS.get(scenario_id.upper())
    if not config:
        raise ValueError(f"Unknown scenario ID '{scenario_id}'. Supported: {list(SCENARIO_CONFIGS.keys())}")

    # 0. Infrastructure setup if in-process
    owns_session = False
    if db_session is None:
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        install_append_only_triggers(engine)
        session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
        db_session = session_factory()
        owns_session = True

    seed_scenarios(db_session)
    get_or_seed_charter(db_session)
    db_session.commit()

    stub = stub_app or create_stub_app()
    seed_stub_dispute(stub, config)

    settings = Settings(
        app_env=AppEnv.test,
        paypal_env=PayPalEnv.stub,
        paypal_merchant_id="MOCK-MERCHANT-001",
        approval_token_secret="test_approval_token_secret_32_bytes_minimum",
    )
    app = agent_app or create_app(settings)
    app.dependency_overrides[get_db_session] = lambda: db_session

    # 1. Step 1: Webhook delivery
    event_payload = stub.state.stub.build_event(config["dispute_id"], "CUSTOMER.DISPUTE.CREATED")
    assert event_payload is not None, "Failed to build event from stub"

    headers = _signature_headers(event_payload)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://agent") as client:
        resp = await client.post("/webhooks/paypal", json=event_payload, headers=headers)
        assert resp.status_code == 200, f"Webhook ingestion failed: {resp.status_code} {resp.text}"

    wh_event = db_session.get(WebhookEvent, event_payload["id"])
    assert wh_event is not None, "Webhook event was not recorded in database"

    # 2. Step 2: Sync dispute
    stub_http = httpx.AsyncClient(transport=httpx.ASGITransport(app=stub), base_url="https://api-m.sandbox.paypal.com")
    auth = PayPalAuth(
        client_id="test_client_id",
        client_secret="test_secret",
        base_url="https://api-m.sandbox.paypal.com",
        http_client=stub_http,
    )
    auth._access_token = "mock_stub_token"
    auth._expires_at = 9999999999.0

    read_client = PayPalReadClient(auth=auth, base_url="https://api-m.sandbox.paypal.com", http_client=stub_http)
    mutating_client = PayPalMutatingClient(auth=auth, base_url="https://api-m.sandbox.paypal.com", http_client=stub_http)

    from agent.app.sync.handler import sync_dispute

    sync_result = await sync_dispute(
        dispute_id=config["dispute_id"],
        session=db_session,
        paypal_client=read_client,
        event_id=event_payload["id"],
        event_type=event_payload["event_type"],
    )
    db_session.commit()
    assert sync_result.fingerprint_changed, "Dispute sync did not detect state fingerprint"

    dispute_row = db_session.get(Dispute, config["dispute_id"])
    assert dispute_row is not None, "Dispute row was not saved in DB"

    # 3. Step 3: Run agent loop & gate evaluation
    service = llm_service or LLMService(
        provider=FakeProvider([ProviderResponse(config["plan_json"])]),
        cache=ScenarioCache(enabled=False),
        budget=DailyBudget(Decimal("100.00")),
    )

    parsed_dispute = parse_dispute(dispute_row.snapshot)
    loop_result = await run_agent_loop(
        session=db_session,
        dispute_id=config["dispute_id"],
        dispute=parsed_dispute,
        llm_service=service,
    )
    db_session.commit()
    assert loop_result.status == "completed", f"Agent loop failed with status: {loop_result.status}"
    assert len(loop_result.decisions) > 0, "No decisions produced by gate"

    primary_decision = loop_result.decisions[0]
    assert primary_decision.verdict == Verdict.ALLOW, (
        f"Expected ALLOW verdict, got {primary_decision.verdict} "
        f"({primary_decision.rule_id}): {primary_decision.reason}"
    )

    # 4. Step 4: Execute decision write-ahead
    dec_row = db_session.execute(
        select(Decision)
        .where(Decision.dispute_id == config["dispute_id"])
        .order_by(Decision.created_at.asc())
    ).scalars().first()
    assert dec_row is not None, "Decision row not found in DB"

    from scripts.replay_decisions import parse_action_from_stored

    primary_action = parse_action_from_stored(dec_row.action_type, dec_row.action_payload)
    exec_result = await execute_decision(
        session=db_session,
        decision=primary_decision,
        action=primary_action,
        dispute_id=config["dispute_id"],
        read_client=read_client,
        mutating_client=mutating_client,
        decision_id=dec_row.id,
    )
    db_session.commit()
    assert exec_result.status == ExecutionStatus.CONFIRMED, f"Execution failed: {exec_result.status}"

    # 5. Step 5: Verify ledger timeline events
    timeline_items, _ = get_timeline_events(db_session, config["dispute_id"])
    event_kinds = [item["kind"] for item in timeline_items]

    # Required sequence per spec
    required_kinds = [
        TimelineEventKind.WEBHOOK_RECEIVED.value,
        TimelineEventKind.DISPUTE_SYNCED.value,
        TimelineEventKind.RUN_STARTED.value,
        TimelineEventKind.EVIDENCE_BUILT.value,
        TimelineEventKind.PLAN_PROPOSED.value,
        TimelineEventKind.GATE_DECIDED.value,
        TimelineEventKind.EXECUTION_INTENDED.value,
        TimelineEventKind.EXECUTION_SENT.value,
        TimelineEventKind.EXECUTION_CONFIRMED.value,
    ]
    for kind in required_kinds:
        assert kind in event_kinds, f"Missing expected ledger event kind: {kind}"

    await stub_http.aclose()
    if owns_session:
        db_session.close()

    return ScenarioRunResult(
        scenario_id=scenario_id,
        dispute_id=config["dispute_id"],
        verdict=primary_decision.verdict.value,
        rule_id=primary_decision.rule_id,
        execution_status=exec_result.status.value,
        timeline_event_kinds=event_kinds,
        success=True,
    )


def main() -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Run scenario A or B through end-to-end backend walking path.")
    parser.add_argument("scenario", choices=["A", "B", "all"], default="all", nargs="?", help="Scenario to run")
    args = parser.parse_args()

    scenarios = ["A", "B"] if args.scenario == "all" else [args.scenario.upper()]

    async def _run_all() -> int:
        for s in scenarios:
            print(f"Running scenario {s}...")
            res = await run_scenario(s)
            print(
                f"  [OK] Scenario {res.scenario_id}: dispute={res.dispute_id}, "
                f"verdict={res.verdict} ({res.rule_id}), status={res.execution_status}, "
                f"ledger_events={len(res.timeline_event_kinds)}"
            )
        print("All scenarios passed successfully.")
        return 0

    return asyncio.run(_run_all())


if __name__ == "__main__":
    sys.exit(main())
