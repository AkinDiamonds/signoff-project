"""Current approval availability must not be inferred from historical verdicts."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from agent.app.api.disputes import current_approval_dispute_ids
from agent.app.db.base import Base
from agent.app.db.models import Approval, Decision, Dispute


def test_only_unexpired_pending_approvals_for_current_fingerprint_are_actionable() -> None:
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    now = datetime(2026, 11, 3, tzinfo=UTC)
    with Session(engine) as session:
        for name, expiry, resolution, fingerprint in [
            ('active', now + timedelta(minutes=1), 'PENDING', 'current'),
            ('expired', now - timedelta(minutes=1), 'PENDING', 'current'),
            ('stale', now + timedelta(minutes=1), 'PENDING', 'old'),
            ('resolved', now + timedelta(minutes=1), 'APPROVE', 'current'),
        ]:
            session.add(Dispute(id=name, state_fingerprint='current', status='WAITING_FOR_SELLER_RESPONSE',
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
