"""Test seams for cross-app E2E testing in non-production environments.

Fulfills Step 34 blocker 0.3:
- Stores raw approval tokens in an outbox accessible via GET /__test__/approval-links.
- Mounted only when PAYPAL_ENV=stub and APP_ENV != prod.
"""

import contextlib
import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)

test_seams_router = APIRouter(prefix="/__test__", tags=["test-seams"])

_IN_MEMORY_OUTBOX: list[dict[str, Any]] = []


def _get_outbox_file() -> Path:
    return Path(tempfile.gettempdir()) / "signoff_test_approval_outbox.json"


def record_test_approval_token(dispute_id: str, raw_token: str) -> None:
    """Store raw approval token in test-only outbox for E2E browser navigation."""
    entry = {
        "dispute_id": dispute_id,
        "token": raw_token,
        "url": f"/approve/{raw_token}",
    }
    _IN_MEMORY_OUTBOX.append(entry)

    outbox_file = _get_outbox_file()
    entries: list[dict[str, Any]] = []
    if outbox_file.exists():
        try:
            entries = json.loads(outbox_file.read_text(encoding="utf-8"))
        except Exception:
            entries = []
    entries.append(entry)
    try:
        outbox_file.write_text(json.dumps(entries), encoding="utf-8")
    except Exception as exc:
        logger.warning("Failed to write test approval outbox file: %s", exc)


def get_test_approval_tokens(dispute_id: str) -> list[dict[str, Any]]:
    """Retrieve all approval links for a dispute from outbox."""
    outbox_file = _get_outbox_file()
    combined: list[dict[str, Any]] = list(_IN_MEMORY_OUTBOX)
    if outbox_file.exists():
        try:
            file_entries = json.loads(outbox_file.read_text(encoding="utf-8"))
            seen_tokens = {item["token"] for item in combined if "token" in item}
            for e in file_entries:
                if isinstance(e, dict) and e.get("token") not in seen_tokens:
                    combined.append(e)
        except Exception as exc:
            logger.warning("Failed to read test approval outbox file: %s", exc)

    return [e for e in combined if e.get("dispute_id") == dispute_id]


def clear_test_approval_outbox() -> None:
    """Clear in-memory and disk test approval outbox."""
    _IN_MEMORY_OUTBOX.clear()
    outbox_file = _get_outbox_file()
    if outbox_file.exists():
        with contextlib.suppress(Exception):
            outbox_file.unlink()


@test_seams_router.get("/approval-links")
async def get_approval_links(
    dispute_id: str = Query(..., description="PayPal dispute ID"),
) -> dict[str, Any]:
    """Retrieve raw approval links for a dispute in test mode."""
    links = get_test_approval_tokens(dispute_id)
    latest_token = links[-1]["token"] if links else None
    latest_url = links[-1]["url"] if links else None
    return {
        "dispute_id": dispute_id,
        "token": latest_token,
        "url": latest_url,
        "links": links,
    }


@test_seams_router.post("/reset")
async def reset_test_seams() -> dict[str, Any]:
    """Reset test seams state."""
    clear_test_approval_outbox()
    return {"status": "ok", "message": "Test seams outbox cleared."}
