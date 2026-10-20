"""Sanitization and truncation utilities for untrusted text in API outputs.

Per Step 14 and CONVENTIONS.md:
- Buyer messages and PayPal free text are untrusted data.
- Untrusted text is truncated and flagged in API output; the UI still escapes it.
"""

from typing import Any

MAX_UNTRUSTED_TEXT_LENGTH = 500
TRUNCATION_MARKER = "... [TRUNCATED]"


def sanitize_untrusted_text(
    text: str | None,
    max_length: int = MAX_UNTRUSTED_TEXT_LENGTH,
) -> tuple[str, bool]:
    """Truncate untrusted text if exceeding max_length and flag truncation."""
    if text is None:
        return "", False
    if len(text) > max_length:
        return text[:max_length] + TRUNCATION_MARKER, True
    return text, False


def sanitize_payload_dict(
    data: dict[str, Any] | None,
    max_length: int = MAX_UNTRUSTED_TEXT_LENGTH,
) -> tuple[dict[str, Any], bool]:
    """Recursively sanitize string values in a dictionary.

    Returns (sanitized_dict, was_truncated).
    """
    if not data:
        return {}, False

    result: dict[str, Any] = {}
    any_truncated = False

    for key, value in data.items():
        if isinstance(value, str):
            sanitized, truncated = sanitize_untrusted_text(value, max_length)
            result[key] = sanitized
            if truncated:
                any_truncated = True
        elif isinstance(value, dict):
            sub_sanitized, sub_truncated = sanitize_payload_dict(value, max_length)
            result[key] = sub_sanitized
            if sub_truncated:
                any_truncated = True
        elif isinstance(value, list):
            sub_list, list_truncated = _sanitize_list(value, max_length)
            result[key] = sub_list
            if list_truncated:
                any_truncated = True
        else:
            result[key] = value

    return result, any_truncated


def _sanitize_list(
    items: list[Any],
    max_length: int,
) -> tuple[list[Any], bool]:
    """Helper to sanitize items within a list."""
    result: list[Any] = []
    any_truncated = False
    for item in items:
        if isinstance(item, str):
            sanitized, truncated = sanitize_untrusted_text(item, max_length)
            result.append(sanitized)
            if truncated:
                any_truncated = True
        elif isinstance(item, dict):
            sub_dict, sub_truncated = sanitize_payload_dict(item, max_length)
            result.append(sub_dict)
            if sub_truncated:
                any_truncated = True
        elif isinstance(item, list):
            sub_list, list_truncated = _sanitize_list(item, max_length)
            result.append(sub_list)
            if list_truncated:
                any_truncated = True
        else:
            result.append(item)
    return result, any_truncated
