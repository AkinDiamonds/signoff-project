"""Current approval availability must not be inferred from historical verdicts."""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from agent.app.api.disputes import approval_execution_attention, current_approval_dispute_ids
from agent.app.api.kpis import get_kpis
from agent.app.db.base import Base
from agent.app.db.models import Approval, Decision, Dispute, Execution, Job


def test_only_unexpired_pending_approvals_for_current_fingerprint_are_actionable() -> None:
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    now = datetime.now(UTC)
    with Session(engine) as session:
        for name, expiry, resolution, fingerprint in [
            ('active', now + timedelta(minutes=1), 'PENDING', 'current'),
            ('expired', now - timedelta(minutes=1), 'PENDING', 'current'),
            ('stale', now + timedelta(minutes=1), 'PENDING', 'old'),
            ('resolved', now + timedelta(minutes=1), 'APPROVE', 'current'),
        ]:
            session.add(Dispute(id=name, state_fingerprint='current', status='WAITING_FOR_BUYER_RESPONSE',
                                reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('10'),
                                currency='USD', snapshot={}))
            decision = Decision(dispute_id=name, action_type='MAKE_OFFER', action_payload={}, verdict='NEEDS_APPROVAL',
                                rule_id='G3-01', reason='Review', action_hash=name,
                                dispute_fingerprint=fingerprint, charter_version=1, also_triggered=[])
            session.add(decision)
            session.flush()
            session.add(Approval(dispute_id=name, decision_id=decision.id, token_hash=name,
                                 payload_hash=name, expires_at=expiry, resolution=resolution))
        session.flush()
        assert current_approval_dispute_ids(session, ['active', 'expired', 'stale', 'resolved'], now) == {'active'}
        assert asyncio.run(get_kpis(session)).open_disputes == 1
        assert approval_execution_attention(session, ['active', 'resolved']) == {'resolved': 'NOT_RECORDED'}
        resolved_decision = session.scalar(select(Decision).where(Decision.dispute_id == 'resolved'))
        assert resolved_decision is not None
        session.add(Job(kind='execute_decision', dispute_id='resolved', status='PENDING',
                        payload={'decision_id': str(resolved_decision.id)}))
        session.flush()
        assert approval_execution_attention(session, ['resolved']) == {}
        from agent.app.domain.enums import TimelineEventKind
        from agent.app.ledger.service import record_ledger_event

        approval = session.scalar(select(Approval).where(Approval.dispute_id == 'resolved'))
        assert approval is not None
        edited = Decision(dispute_id='resolved', action_type='MAKE_OFFER', action_payload={}, verdict='ALLOW',
                          rule_id='A-01', reason='Edited', action_hash='edited',
                          dispute_fingerprint='current', charter_version=1, also_triggered=[])
        session.add(edited)
        session.flush()
        record_ledger_event(session, 'resolved', TimelineEventKind.APPROVAL_RESOLVED,
                            {'approval_id': str(approval.id), 'decision_id': str(edited.id)})
        assert approval_execution_attention(session, ['resolved']) == {'resolved': 'NOT_RECORDED'}
        session.add(Job(kind='execute_decision', dispute_id='another', status='PENDING',
                        payload={'decision_id': str(edited.id)}))
        session.flush()
        assert approval_execution_attention(session, ['resolved']) == {}
        session.add(Execution(decision_id=edited.id, dispute_id='resolved', status='FAILED', request_hash='failed'))
        session.add(Execution(decision_id=resolved_decision.id, dispute_id='resolved', status='CONFIRMED',
                              request_hash='other-action'))
        session.flush()
        assert approval_execution_attention(session, ['resolved']) == {'resolved': 'FAILED'}



def test_only_latest_relevant_run_failure_requires_analysis_review() -> None:
    from agent.app.api.disputes import failed_analysis_dispute_ids
    from agent.app.domain.enums import TimelineEventKind
    from agent.app.ledger.service import record_ledger_event

    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        record_ledger_event(session, 'failed', TimelineEventKind.RUN_FAILED, {'error': 'failed'})
        record_ledger_event(session, 'recovered', TimelineEventKind.RUN_FAILED, {'error': 'failed'})
        record_ledger_event(session, 'recovered', TimelineEventKind.RUN_STARTED, {'run_id': 'new'})
        record_ledger_event(session, 'failed', TimelineEventKind.DISPUTE_SYNCED, {'status': 'OPEN'})
        record_ledger_event(session, 'failed', TimelineEventKind.EXECUTION_CONFIRMED, {'execution_id': 'other'})
        record_ledger_event(session, 'tracking', TimelineEventKind.NO_ACTION, {'reason': 'tracking_requires_review'})
        record_ledger_event(session, 'policy', TimelineEventKind.NO_ACTION, {'reason': 'signing_policy_changed'})
        record_ledger_event(session, 'other', TimelineEventKind.NO_ACTION, {'reason': 'no_action_needed'})
        assert failed_analysis_dispute_ids(session, ['failed', 'recovered', 'tracking', 'policy', 'other']) == {
            'failed', 'tracking', 'policy',
        }


def test_session_scope_only_narrows_results_and_missing_session_is_empty() -> None:
    from agent.app.api.disputes import session_scope_predicate

    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for name, demo_session in [('one', 'session-a'), ('two', 'session-b'), ('owner', None)]:
            session.add(Dispute(id=name, state_fingerprint='current', status='WAITING_FOR_SELLER_RESPONSE',
                                reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('10'),
                                currency='USD', snapshot={}, demo_session_id=demo_session))
        session.flush()
        query = select(Dispute.id)
        assert set(session.scalars(query.where(session_scope_predicate('all', None)))) == {'one', 'two', 'owner'}
        assert set(session.scalars(query.where(session_scope_predicate('mine', 'session-a')))) == {'one'}
        assert set(session.scalars(query.where(session_scope_predicate('mine', None)))) == set()


def test_attention_view_filters_before_pagination() -> None:
    from types import SimpleNamespace

    from agent.app.api.disputes import list_disputes
    from agent.app.domain.enums import TimelineEventKind
    from agent.app.ledger.service import record_ledger_event
    from agent.app.settings import AppEnv

    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for name, status in [('a', 'WAITING_FOR_SELLER_RESPONSE'), ('b', 'WAITING_FOR_SELLER_RESPONSE'),
                             ('closed', 'RESOLVED'), ('waiting', 'WAITING_FOR_BUYER_RESPONSE')]:
            session.add(Dispute(id=name, state_fingerprint='fp', status=status,
                                reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('10'),
                                currency='USD', snapshot={}))
        session.flush()
        for name in ('a', 'b', 'closed'):
            record_ledger_event(session, name, TimelineEventKind.RUN_FAILED, {'error': 'failed'})
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
            settings=SimpleNamespace(paypal_merchant_id='', app_env=AppEnv.test))))
        page = asyncio.run(list_disputes(request, session, scope='all', view='attention', demo_session=None,
                                         status_filter=None, reason_filter=None, due_before=None, limit=1,
                                         cursor=None, sort_by='due_date', sort_direction='asc'))
        assert page.total_count == 2 and len(page.items) == 1 and page.next_cursor is not None
        next_page = asyncio.run(list_disputes(request, session, scope='all', view='attention', demo_session=None,
                                              status_filter=None, reason_filter=None, due_before=None, limit=1,
                                              cursor=page.next_cursor, sort_by='due_date', sort_direction='asc'))
        assert next_page.total_count == 2 and next_page.items[0].id != page.items[0].id


def test_search_matches_order_reference_before_pagination() -> None:
    from types import SimpleNamespace

    from agent.app.api.disputes import list_disputes
    from agent.app.db.models import Order
    from agent.app.settings import AppEnv

    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for name, transaction in [('a', 'capture-a'), ('b', 'capture-b')]:
            session.add(Dispute(id=name, state_fingerprint='fp', status='WAITING_FOR_SELLER_RESPONSE',
                                reason='MERCHANDISE_OR_SERVICE_NOT_RECEIVED', amount=Decimal('10'),
                                currency='USD', snapshot={'disputed_transactions': [
                                    {'seller_transaction_id': transaction}]}))
            session.add(Order(order_code=f'ORDER-{name}', merchant_id='fictional', customer_email='test@example.test',
                              paypal_transaction_id=transaction, amount=Decimal('10'), currency='USD',
                              status='PAID', items=[]))
        session.flush()
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
            settings=SimpleNamespace(paypal_merchant_id='', app_env=AppEnv.test))))
        page = asyncio.run(list_disputes(request, session, scope='all', view='all', demo_session=None,
                                         search='order-b', status_filter=None, reason_filter=None, due_before=None,
                                         limit=1, cursor=None, sort_by='due_date', sort_direction='asc'))
        assert page.total_count == 1 and page.items[0].id == 'b' and page.next_cursor is None
