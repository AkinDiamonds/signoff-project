"""Hosted data must never be dropped by a test-mode flag or wrong database selector."""

import importlib
from types import SimpleNamespace

import pytest
from sqlalchemy.engine import make_url


@pytest.mark.parametrize(('mode', 'url'), [
    ('prod', 'postgresql://fixture@localhost/signoff_test'),
    ('test', 'postgresql://fixture@remote.example.test/signoff_test'),
    ('test', 'postgresql://fixture@localhost/signoff_db'),
    ('test', 'postgresql://fixture@localhost/signoff_test?host=remote.example.test'),
    ('test', 'sqlite:///signoff_test'),
])
def test_push_migration_refuses_hosted_or_unvalidated_downgrade(monkeypatch, mode, url):
    migration = importlib.import_module('migrations.versions.e08b3df70008_web_push')
    monkeypatch.setenv('APP_ENV', mode)
    monkeypatch.setattr(migration.op, 'get_bind', lambda: SimpleNamespace(engine=SimpleNamespace(url=make_url(url))))
    monkeypatch.setattr(migration.op, 'drop_table', lambda *args: pytest.fail('Unsafe table drop'))
    with pytest.raises(RuntimeError, match='Forward-only'):
        migration.downgrade()
