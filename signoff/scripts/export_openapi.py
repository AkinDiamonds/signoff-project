"""Export deterministic OpenAPI specification to packages/api-client/openapi.json."""

import json
import sys
from pathlib import Path

# Add signoff/agent to sys.path so 'agent.app.main' is importable
repo_root = Path(__file__).resolve().parent.parent
agent_dir = repo_root / "agent"
if str(agent_dir) not in sys.path:
    sys.path.insert(0, str(agent_dir))
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from agent.app.main import create_app
from agent.app.settings import AppEnv, Settings


def export_openapi() -> Path:
    """Generate and write deterministic OpenAPI schema."""
    settings = Settings(
        app_env=AppEnv.test,
        paypal_client_id="test_client_id",
        paypal_client_secret="test_secret",
        approval_token_secret="test_approval_token_secret_32_bytes_minimum",
    )
    app = create_app(settings)
    openapi_schema = app.openapi()

    output_dir = repo_root / "packages" / "api-client"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "openapi.json"

    # Deterministic serialization (sorted keys, consistent indentation, trailing newline)
    serialized = json.dumps(openapi_schema, indent=2, sort_keys=True) + "\n"
    output_file.write_text(serialized, encoding="utf-8")
    return output_file


if __name__ == "__main__":
    out = export_openapi()
    print(f"OpenAPI schema successfully written to {out}")
