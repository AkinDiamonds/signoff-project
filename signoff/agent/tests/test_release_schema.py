"""Forward release migration is serialized; startup fails closed on migration errors."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from agent.app.db.models import Order
from agent.app.db.release import upgrade_release_schema
from agent.app.main import create_app
from agent.app.settings import AppEnv, Settings


def test_concurrent_forward_release_checks_preserve_order_data():
    # conftest has already validated and installed only the dedicated local test
    # URL. Never select an inherited deployment URL for this test.
    url = Settings().database_url
    engine = create_engine(url)
    identifier = uuid.uuid4()
    with Session(engine) as session:
        row = Order(
            id=identifier, order_code=f"SIGREL{uuid.uuid4().hex[:16]}", merchant_id='MOCK-MERCHANT-001',
            customer_email='buyer@example.test', amount=Decimal('21.00'), currency='USD',
            status='PENDING', items=[], created_at=datetime.now(UTC),
        )
        session.add(row)
        session.commit()
        try:
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = [pool.submit(upgrade_release_schema, url) for _ in range(2)]
                for result in results:
                    result.result(timeout=30)
            session.expire_all()
            stored = session.get(Order, identifier)
            assert stored is not None and stored.amount == Decimal('21.00') and stored.status == 'PENDING'
        finally:
            session.delete(row)
            session.commit()
    engine.dispose()


def test_evidence_snapshot_is_append_only_in_migrated_postgres():
    engine = create_engine(Settings().database_url)
    identifier = uuid.uuid4()
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            conn.execute(text("INSERT INTO agent_runs (id, dispute_id, model, prompt_version, input_hash, cache_hit) "
                              "VALUES (:id, 'PP-FICTIONAL', 'test', 'test', 'test', false)"), {'id': identifier})
            conn.execute(text("INSERT INTO evidence_snapshots (run_id, dispute_id, content_hash, captured_at, payload) "
                              "VALUES (:id, 'PP-FICTIONAL', 'hash', now(), '{}')"), {'id': identifier})
            for sql in ("UPDATE evidence_snapshots SET content_hash='modified' WHERE run_id=:id",
                        "DELETE FROM evidence_snapshots WHERE run_id=:id"):
                savepoint = conn.begin_nested()
                with pytest.raises(DBAPIError, match='append-only'):
                    conn.execute(text(sql), {'id': identifier})
                savepoint.rollback()
        finally:
            transaction.rollback()
    engine.dispose()


def test_api_runs_release_preparation_before_serving(monkeypatch):
    calls = []
    monkeypatch.setattr('agent.app.main.prepare_production_schema', lambda settings: calls.append(settings.app_env))
    settings = Settings().model_copy(update={'app_env': AppEnv.prod})
    with TestClient(create_app(settings)) as client:
        assert calls == [AppEnv.prod]
        assert client.get('/healthz').status_code == 200


def test_failed_migration_prevents_api_startup(monkeypatch):
    def fail(_):
        raise RuntimeError('Release migration failed')

    monkeypatch.setattr('agent.app.main.prepare_production_schema', fail)
    with pytest.raises(RuntimeError, match='Release migration failed'), TestClient(create_app()):
        pytest.fail('The API must not start accepting traffic after a migration failure')
