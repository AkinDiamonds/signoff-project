"""Database engine, session factories, and connection health checks."""

import logging
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from agent.app.settings import Settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_engine(database_url: str | None = None) -> Engine:
    """Create or return cached SQLAlchemy engine."""
    url = database_url or Settings().database_url
    # Configure connection pool with conservative timeouts
    engine_kwargs: dict[str, object] = {
        "pool_pre_ping": True,
    }
    if not url.startswith("sqlite"):
        engine_kwargs.update(
            {
                "pool_size": 5,
                "max_overflow": 10,
                "pool_timeout": 10,
            }
        )
    return create_engine(url, **engine_kwargs)


def reset_engine() -> None:
    """Clear cached engine for tests and reconfiguration."""
    get_engine.cache_clear()


def get_session_factory(engine: Engine | None = None) -> sessionmaker[Session]:
    """Create session factory bound to given or default engine."""
    eng = engine or get_engine()
    return sessionmaker(bind=eng, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db_session() -> Generator[Session, None, None]:
    """FastAPI dependency for scoped database sessions."""
    factory = get_session_factory()
    with factory() as session:
        yield session


def check_database_health(engine: Engine | None = None) -> bool:
    """Execute ping query (SELECT 1) to verify database connectivity.

    Returns True if healthy, False if unreachable or failing.
    """
    try:
        eng = engine or get_engine()
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        return False
