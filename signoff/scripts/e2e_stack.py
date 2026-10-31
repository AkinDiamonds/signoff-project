"""Start or stop the local stack used by cross-app Playwright tests.

Usage: python -m scripts.e2e_stack start|stop   (run from the repo root)

Uses a dedicated database (signoff_e2e), the PayPal stub, a fake LLM, an agent on 8000,
a frozen agent on 8001 (kill-switch test) and one worker. PIDs go to .e2e-stack/pids.json.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

from scripts.test_environment import DEFAULT_TEST_DATABASE_URL, isolate_test_environment

ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = ROOT / ".e2e-stack"
PID_FILE = STATE_DIR / "pids.json"
DB_NAME = "signoff_e2e"
DB_URL = f"postgresql+psycopg://signoff:signoff@localhost:5432/{DB_NAME}"
ORIGINS = "http://localhost:5173,http://localhost:5174,http://localhost:5175"


def stack_env() -> dict[str, str]:
    env = dict(os.environ)
    # Clear every Settings name/alias before supplying the dedicated stub stack.
    # The initial disposable URL is validated by the same guard as unit tests;
    # this stack then explicitly selects its separate local e2e database below.
    env["SIGNOFF_TEST_DATABASE_URL"] = DEFAULT_TEST_DATABASE_URL
    isolate_test_environment(env)
    env.update(
        {
            "PYTHONPATH": os.pathsep.join([str(ROOT / "signoff"), str(ROOT / "signoff" / "agent")]),
            "APP_ENV": "test",
            "PAYPAL_ENV": "stub",
            "PAYPAL_BASE_URL": "http://localhost:4010",
            "PAYPAL_CLIENT_ID": "stub-client",
            "PAYPAL_CLIENT_SECRET": "stub-secret",
            "PAYPAL_MERCHANT_ID": "MOCK-MERCHANT-001",
            "PAYPAL_BUYER_EMAIL": "alex.morgan@example.test",
            "APPROVAL_TOKEN_SECRET": "local-stub-only-approval-key-over-32-characters",
            "STORE_API_KEY": "local-stub-store-key",
            "DEMO_HOLD_DISPUTES": "false",
            "LLM_PROVIDER": "fake",
            "DATABASE_URL": DB_URL,
            "ALLOWED_ORIGINS": ORIGINS,
            "DEMO_POOL_SIZE_PER_SCENARIO": "10",
            "DEMO_SCENARIOS_PER_IP_PER_DAY": "1000",
            "DEMO_SCENARIOS_PER_SESSION_PER_DAY": "1000",
            "STUB_AGENT_URL": "http://localhost:8000",
            "STUB_PORT": "4010",
        }
    )
    return env


def run(args: list[str], env: dict[str, str]) -> None:
    subprocess.run(args, cwd=ROOT, env=env, check=True, capture_output=True)


def recreate_database() -> None:
    psql = ["docker", "exec", "signoff-postgres", "psql", "-U", "signoff", "-d", "postgres", "-c"]
    subprocess.run([*psql, f"DROP DATABASE IF EXISTS {DB_NAME} WITH (FORCE)"], check=True, capture_output=True)
    subprocess.run([*psql, f"CREATE DATABASE {DB_NAME}"], check=True, capture_output=True)


def spawn(name: str, args: list[str], env: dict[str, str]) -> int:
    log = open(STATE_DIR / f"{name}.log", "wb")  # noqa: SIM115 - handle lives as long as the child
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    proc = subprocess.Popen(args, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
    return proc.pid


def wait_for(url: str, name: str, timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if httpx.get(url, timeout=2.0).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    raise SystemExit(f"{name} did not become ready at {url}; see {STATE_DIR / (name + '.log')}")


def start() -> None:
    stop()
    STATE_DIR.mkdir(exist_ok=True)
    env = stack_env()
    py = sys.executable
    subprocess.run(["docker", "compose", "up", "-d", "postgres"], cwd=ROOT, check=True, capture_output=True)
    recreate_database()
    run([py, "-m", "alembic", "upgrade", "head"], env)
    run([py, "-m", "scripts.seed_sandbox"], env)

    uvicorn = [py, "-m", "uvicorn", "agent.app.main:app"]
    pids = {
        "stub": spawn("stub", [py, "-m", "scripts.paypal_stub.main"], env),
        "agent": spawn("agent", [*uvicorn, "--port", "8000"], env),
        "agent_frozen": spawn("agent_frozen", [*uvicorn, "--port", "8001"], {**env, "DEMO_FROZEN": "true"}),
        "worker": spawn(
            "worker",
            [py, "-m", "agent.app.worker", "--poll-interval", "0.2", "--reconcile-interval", "5"],
            env,
        ),
    }
    PID_FILE.write_text(json.dumps(pids), encoding="utf-8")
    wait_for("http://localhost:4010/health", "stub")
    wait_for("http://localhost:8000/readyz", "agent")
    wait_for("http://localhost:8001/readyz", "agent_frozen")
    print("e2e stack ready: stub 4010, agent 8000, frozen agent 8001, worker")


def stop() -> None:
    if not PID_FILE.exists():
        return
    for pid in json.loads(PID_FILE.read_text(encoding="utf-8")).values():
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
        else:
            subprocess.run(["kill", str(pid)], capture_output=True)
    PID_FILE.unlink()


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "start":
        start()
    elif command == "stop":
        stop()
    else:
        raise SystemExit("usage: python -m scripts.e2e_stack start|stop")
