"""Apply reviewed forward migrations before production API/worker startup."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from agent.app.settings import AppEnv, Settings

# Session-level lock shared by API and worker releases, including rolling deploys.
_MIGRATION_LOCK = 7364466631


def upgrade_release_schema(database_url: str) -> None:
    """Upgrade only; serialize release processes and preserve all existing data.

    This is a production release operation, never a test/seed/reset helper. Test
    callers must supply their explicitly isolated database URL. A failed upgrade
    raises and prevents this new process from accepting jobs or traffic.
    """
    root = Path(__file__).resolve().parents[4]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    engine = create_engine(database_url, poolclass=NullPool)
    try:
        if engine.dialect.name != "postgresql":
            raise RuntimeError("Production release migrations require PostgreSQL")
        with engine.connect() as connection:
            # A missing migration lock holder cannot hang a release indefinitely.
            connection.execute(text("SET statement_timeout = '60s'"))
            connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": _MIGRATION_LOCK})
            connection.commit()
            try:
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
                connection.commit()
            finally:
                connection.rollback()
                connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _MIGRATION_LOCK})
                connection.commit()
    finally:
        engine.dispose()


def prepare_production_schema(settings: Settings) -> None:
    if settings.app_env == AppEnv.prod:
        upgrade_release_schema(settings.database_url)
