"""Remove application credentials and select a disposable database before pytest imports the app."""

from collections.abc import MutableMapping

from pydantic import AliasChoices, AliasPath
from sqlalchemy.engine import make_url

from agent.app.settings import Settings

DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://signoff:signoff@localhost:5432/signoff_test"


def _aliases(alias: str | AliasChoices | AliasPath | None) -> list[str]:
    if isinstance(alias, str):
        return [alias]
    if isinstance(alias, AliasChoices):
        return [name for choice in alias.choices for name in _aliases(choice)]
    if isinstance(alias, AliasPath) and alias.path and isinstance(alias.path[0], str):
        return [alias.path[0]]
    return []


def isolate_test_environment(environ: MutableMapping[str, str]) -> None:
    """Never inherit a shared database, credential, provider mode or alternative settings alias.

    Only SIGNOFF_TEST_DATABASE_URL can select the test DB. Validate before changing
    anything, and never include a rejected URL/credential in an exception.
    """
    database_url = environ.get("SIGNOFF_TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)
    try:
        parsed = make_url(database_url)
    except Exception:
        raise ValueError(
            "SIGNOFF_TEST_DATABASE_URL must identify a disposable local PostgreSQL test database"
        ) from None
    if (
        parsed.drivername != "postgresql+psycopg"
        or parsed.host not in {"localhost", "127.0.0.1", "::1"}
        or not parsed.database
        or not (parsed.database == "signoff_test" or parsed.database.startswith("signoff_test_"))
        or parsed.query
    ):
        raise ValueError("SIGNOFF_TEST_DATABASE_URL must identify a disposable local PostgreSQL test database")

    names: set[str] = set()
    for name, field in Settings.model_fields.items():
        names.add(name.casefold())
        names.update(alias.casefold() for alias in _aliases(field.validation_alias))
    # Settings are case-insensitive; remove lower-case aliases as well.
    for name in list(environ):
        if name.casefold() in names:
            del environ[name]
    environ["APP_ENV"] = "test"
    environ["DATABASE_URL"] = database_url
