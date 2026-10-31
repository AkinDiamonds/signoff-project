"""Isolate settings before test modules instantiate applications or database engines."""

import os

from agent.app.settings import Settings
from scripts.test_environment import isolate_test_environment

isolate_test_environment(os.environ)
# Tests pass explicit settings or monkeypatch env; a developer's .env is never a test fixture.
Settings.model_config["env_file"] = None
