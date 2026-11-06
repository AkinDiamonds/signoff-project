"""Wipe app data and start fresh without PayPal re-importing the old disputes.

Usage (from the repo root, with DATABASE_URL pointing at the database to reset):
    python -m scripts.fresh_start --email you@example.com --yes

It keeps the product catalog, migration state and PayPal readiness checks,
records "now" as the sync cutoff, and prints MERCHANT_EMAIL / MERCHANT_PASSWORD_HASH
for the API environment. Run it again any time for another fresh start.
"""

import argparse
from datetime import UTC, datetime
from getpass import getpass
from pathlib import Path

from sqlalchemy import delete, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from agent.app.auth import hash_password
from agent.app.db.models import Base
from agent.app.db.session import get_engine
from agent.app.settings import Settings
from agent.app.shop import models as _shop_models  # noqa: F401  (registers the products table)
from agent.app.sync.fresh_start import set_cutoff

KEEP = {"products", "integration_observations"}


def wipe(session: Session) -> list[str]:
    tables = [t for t in Base.metadata.sorted_tables if t.name not in KEEP]
    if session.get_bind().dialect.name == "postgresql":
        names = ", ".join(f'"{t.name}"' for t in tables)
        session.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
    else:
        for table in reversed(tables):
            session.execute(delete(table))
    return [t.name for t in tables]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True, help="New owner login email")
    parser.add_argument("--password", help="New owner password (prompted if omitted)")
    parser.add_argument("--yes", action="store_true", help="Confirm that all app data will be deleted")
    args = parser.parse_args()

    Settings.model_config["env_file"] = Path(__file__).resolve().parents[1] / ".env"
    password = args.password or getpass("New owner password: ")
    credential = hash_password(password)

    url = make_url(Settings().database_url)
    print(f"Target database: {url.host or 'local file'}/{url.database}")
    if not args.yes:
        raise SystemExit("Nothing changed. Re-run with --yes to delete all disputes, orders, runs and ledger data.")

    with Session(get_engine()) as session:
        wiped = wipe(session)
        set_cutoff(session, datetime.now(UTC))
        session.commit()

    print(f"Wiped {len(wiped)} tables. PayPal disputes created before now will not be imported.")
    print("\nSet these on the API service (and in signoff/.env locally), then restart it:")
    print(f"MERCHANT_EMAIL={args.email.strip()}")
    print(f"MERCHANT_PASSWORD_HASH={credential}")


if __name__ == "__main__":
    main()
