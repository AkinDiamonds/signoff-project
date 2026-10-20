"""Replay script wrapper forwarding to signoff/scripts/replay_decisions.py."""

import sys
from pathlib import Path

# Add signoff/agent and signoff to sys.path
root_dir = Path(__file__).resolve().parent.parent
agent_dir = root_dir / "signoff" / "agent"
signoff_dir = root_dir / "signoff"

for p in [str(agent_dir), str(signoff_dir), str(root_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from signoff.scripts.replay_decisions import (  # noqa: E402
    ReplayResult,
    main,
    parse_action_from_stored,
    replay_all_decisions,
    replay_single_decision,
)

__all__ = [
    "ReplayResult",
    "main",
    "parse_action_from_stored",
    "replay_all_decisions",
    "replay_single_decision",
]

if __name__ == "__main__":
    sys.exit(main())
