"""Enum parity script: verifies exact parity between Python domain enums, TypeScript enums, and OpenAPI spec.

Fails loudly if any member is added, removed, or mismatched across languages.
"""

import json
import re
import sys
from pathlib import Path

# Setup sys.path
repo_root = Path(__file__).resolve().parent.parent.parent
signoff_dir = repo_root / "signoff"
agent_dir = signoff_dir / "agent"

for p in [str(agent_dir), str(signoff_dir), str(repo_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from agent.app.domain.enums import ALL_DOMAIN_ENUMS  # noqa: E402


def parse_typescript_enums(ts_file_path: Path) -> dict[str, list[str]]:
    """Parse array literals like `export const VERDICTS = ['ALLOW', ...] as const;`."""
    content = ts_file_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"export\s+const\s+([A-Z_]+)\s*=\s*\[([^\]]+)\]\s*as\s*const;",
        re.MULTILINE | re.DOTALL,
    )
    result: dict[str, list[str]] = {}
    for match in pattern.finditer(content):
        name = match.group(1)
        raw_items = match.group(2)
        # Extract quoted strings
        items = re.findall(r"['\"]([^'\"]+)['\"]", raw_items)
        result[name] = items
    return result


def check_parity() -> bool:
    ts_file = signoff_dir / "packages" / "api-client" / "src" / "enums.ts"
    openapi_file = signoff_dir / "packages" / "api-client" / "openapi.json"

    if not ts_file.exists():
        print(f"Error: TypeScript enums file not found at {ts_file}", file=sys.stderr)
        return False

    ts_enums = parse_typescript_enums(ts_file)
    openapi_spec = {}
    if openapi_file.exists():
        try:
            openapi_spec = json.loads(openapi_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Warning: Failed to parse openapi.json: {e}", file=sys.stderr)

    # Mapping from Python enum name (snake_case in ALL_DOMAIN_ENUMS) to TS const name
    mapping = {
        "verdict": "VERDICTS",
        "action_type": "ACTION_TYPES",
        "dispute_reason": "DISPUTE_REASONS",
        "dispute_status": "DISPUTE_STATUSES",
        "execution_status": "EXECUTION_STATUSES",
        "job_kind": "JOB_KINDS",
        "job_status": "JOB_STATUSES",
        "approval_resolution": "APPROVAL_RESOLUTIONS",
        "timeline_event_kind": "TIMELINE_EVENT_KINDS",
        "order_status": "ORDER_STATUSES",
        "tracking_status": "TRACKING_STATUSES",
        "evidence_strength_label": "EVIDENCE_STRENGTH_LABELS",
        "llm_mode": "LLM_MODES",
    }

    errors: list[str] = []

    print("Checking enum parity across Python, TypeScript, and OpenAPI...")

    for py_name, ts_const_name in mapping.items():
        if py_name not in ALL_DOMAIN_ENUMS:
            errors.append(f"Missing Python domain enum for key '{py_name}'")
            continue

        py_enum_cls = ALL_DOMAIN_ENUMS[py_name]
        py_values = [e.value for e in py_enum_cls]

        if ts_const_name not in ts_enums:
            errors.append(f"Missing TypeScript constant '{ts_const_name}' in {ts_file.name}")
            continue

        ts_values = ts_enums[ts_const_name]

        # Check equality of sets and sequence
        if py_values != ts_values:
            errors.append(
                f"Mismatch for enum '{py_name}' ({ts_const_name}):\n"
                f"  Python ({len(py_values)}):     {py_values}\n"
                f"  TypeScript ({len(ts_values)}): {ts_values}"
            )

    # Check ScenarioId (contracts.md)
    if "SCENARIO_IDS" not in ts_enums or ts_enums["SCENARIO_IDS"] != ["A", "B", "C", "D", "E"]:
        errors.append("TypeScript SCENARIO_IDS does not match expected contracts ['A', 'B', 'C', 'D', 'E']")

    # Check schemas in OpenAPI if any match
    schemas = openapi_spec.get("components", {}).get("schemas", {})
    for schema_name, schema_body in schemas.items():
        if "enum" in schema_body:
            clean_schema = re.sub(r"[^a-z0-9]", "", schema_name.lower())
            for py_name, py_enum_cls in ALL_DOMAIN_ENUMS.items():
                clean_py = re.sub(r"[^a-z0-9]", "", py_name.lower())
                if clean_schema == clean_py:
                    py_values = [e.value for e in py_enum_cls]
                    spec_values = schema_body["enum"]
                    if set(py_values) != set(spec_values):
                        errors.append(
                            f"OpenAPI schema '{schema_name}' values do not match Python '{py_name}':\n"
                            f"  Python:  {py_values}\n"
                            f"  OpenAPI: {spec_values}"
                        )

    if errors:
        print("\n[FAIL] Enum parity check FAILED with the following discrepancies:", file=sys.stderr)
        for err in errors:
            print(f"- {err}", file=sys.stderr)
        return False

    print("[PASS] All domain enums match identically across Python and TypeScript.")
    return True


if __name__ == "__main__":
    if not check_parity():
        sys.exit(1)
    sys.exit(0)
