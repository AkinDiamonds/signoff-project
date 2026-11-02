"""Owner web push destinations and leased delivery attempts; preserve inbox history."""

import os

import sqlalchemy as sa
from alembic import op

revision = 'e08b3df70008'
down_revision = 'd97a2ce60007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('notifications', 'source_event_id', existing_type=sa.Uuid(), nullable=True)
    op.create_table('push_subscriptions',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('endpoint_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.String(128), nullable=False),
        sa.Column('auth', sa.String(64), nullable=False),
        sa.Column('vapid_key', sa.String(128), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table('push_deliveries',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('notification_id', sa.Uuid(), sa.ForeignKey('notifications.id'), nullable=False),
        sa.Column('subscription_id', sa.Uuid(), sa.ForeignKey('push_subscriptions.id'), nullable=False),
        sa.Column('state', sa.String(24), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('lease_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lease_token', sa.Uuid(), nullable=True),
        sa.Column('last_error', sa.String(80), nullable=True),
        sa.UniqueConstraint('notification_id', 'subscription_id', name='uq_push_destination'),
    )


def downgrade() -> None:
    # Production rollback retains data. Only the existing disposable test-schema
    # round trip may tear down these tables; a test-mode flag alone is insufficient.
    url = op.get_bind().engine.url
    if (os.environ.get('APP_ENV') != 'test' or url.host not in {'localhost', '127.0.0.1', '::1'}
            or not url.database or not (url.database == 'signoff_test' or url.database.startswith('signoff_test_'))
            or url.query):
        raise RuntimeError('Forward-only: retain inbox and delivery history during application rollback')
    op.drop_table('push_deliveries')
    op.drop_table('push_subscriptions')
    op.alter_column('notifications', 'source_event_id', existing_type=sa.Uuid(), nullable=False)
