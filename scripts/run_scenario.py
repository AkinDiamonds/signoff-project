"""Scenario runner script wrapper forwarding to signoff/scripts/run_scenario.py."""

import sys
from pathlib import Path

# Add signoff/agent and signoff to sys.path
root_dir = Path(__file__).resolve().parent.parent
agent_dir = root_dir / "signoff" / "agent"
signoff_dir = root_dir / "signoff"

for p in [str(agent_dir), str(signoff_dir), str(root_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from signoff.scripts.run_scenario import (  # noqa: E402
    ScenarioRunResult,
    main,
    run_scenario,
)

__all__ = [
    "ScenarioRunResult",
    "main",
    "run_scenario",
]

if __name__ == "__main__":
    sys.exit(main())
