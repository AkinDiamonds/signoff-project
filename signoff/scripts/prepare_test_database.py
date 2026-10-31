"""Apply migrations only to a validated disposable local test database."""

import os

from alembic import command
from alembic.config import Config

from agent.app.settings import Settings
from scripts.test_environment import isolate_test_environment


def main() -> None:
    isolate_test_environment(os.environ)
    Settings.model_config["env_file"] = None
    command.upgrade(Config("alembic.ini"), "head")


if __name__ == "__main__":
    main()
