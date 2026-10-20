"""Content injection screener and adversarial pattern detector.

Per Step 18:
- Detects hostile attempts to manipulate LLM or gate decisions.
- Signals:
  * impersonation of system or admin
  * instructions aimed at the assistant (jailbreaks, prompt overrides)
  * attempts to change limits or standing authority
  * plan-shaped JSON in text
- Normal buyer refund requests must NOT be flagged.
- Normalizes zero-width characters, homoglyphs, accents, and mixed language.
- Produces a typed InjectionFlag object with an enum of detected signals.
"""

import json
import re
import unicodedata
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class InjectionSignal(StrEnum):
    """Categorized signals detected by the injection screener."""

    SYSTEM_IMPERSONATION = "system_impersonation"
    ASSISTANT_INSTRUCTION = "assistant_instruction"
    LIMIT_OVERRIDE = "limit_override"
    PLAN_JSON = "plan_json"


@dataclass(frozen=True, slots=True)
class InjectionFlag:
    """Typed result of screening untrusted text inputs."""

    is_flagged: bool
    signals: tuple[InjectionSignal, ...] = ()
    reasons: tuple[str, ...] = ()
    matches: tuple[str, ...] = ()


# Zero-width and formatting control characters
_ZERO_WIDTH_PATTERN = re.compile(
    r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u00AD\u2060\u2061\u2062\u2063\u2064]"
)

# Cyrillic and Greek homoglyphs to Latin ASCII lookalikes
_HOMOGLYPH_MAP = str.maketrans({
    "а": "a", "А": "A",
    "в": "b", "В": "B",
    "с": "c", "С": "C",
    "е": "e", "Е": "E",
    "н": "h", "Н": "H",
    "і": "i", "І": "I",
    "ј": "j", "Ј": "J",
    "к": "k", "К": "K",
    "м": "m", "М": "M",
    "о": "o", "О": "O",
    "р": "p", "Р": "P",
    "ѕ": "s", "Ѕ": "S",
    "т": "t", "Т": "T",
    "у": "y", "У": "Y",
    "х": "x", "Х": "X",
    "ɡ": "g",
    # Greek
    "α": "a", "Α": "A",
    "β": "b", "Β": "B",
    "ε": "e", "Ε": "E",
    "ο": "o", "Ο": "O",
    "ρ": "p", "Ρ": "P",
})

# System / Admin impersonation patterns
_SYSTEM_IMPERSONATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:^|[\r\n\[<{\s])(?:system|admin|administrator|developer|root|supervisor)\s*[:\]>}]", re.IGNORECASE),
    re.compile(r"role\s*:\s*[\"']?(?:system|admin|developer)[\"']?", re.IGNORECASE),
    re.compile(r"\b(?:system\s+message|system\s+instructions?|system\s+prompt|system\s+directive)\b", re.IGNORECASE),
    re.compile(r"\byou\s+are\s+now\s+in\s+developer\s+mode\b", re.IGNORECASE),
    re.compile(r"\bauthorized\s+administrator\b", re.IGNORECASE),
    re.compile(r"\b(?:system|admin)\s+override\b", re.IGNORECASE),
    re.compile(r"\boverride\s+authority\b", re.IGNORECASE),
    re.compile(r"\broot\s+privilege\b", re.IGNORECASE),
)

# Assistant instruction override / jailbreak patterns
_ASSISTANT_INSTRUCTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:ignore|disregard|forget|override|bypass|cancel)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions?|rules?|prompts?|constraints?|directives?)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bnew\s+instructions?\s*[:\-]", re.IGNORECASE),
    re.compile(r"\byou\s+must\s+now\s+(?:ignore|execute|act|refund|approve|output)\b", re.IGNORECASE),
    re.compile(r"(?:^|[\r\n\[<{\s])assistant\s*[:\]>}]", re.IGNORECASE),
    re.compile(
        r"\b(?:act\s+as\s+(?:a|an)?|pretend\s+you\s+are)\s+(?:an?\s+)?(?:system|admin|unrestricted|jailbroken|evaluator)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bjailbreak\b", re.IGNORECASE),
    re.compile(r"\bdo\s+not\s+follow\s+(?:the\s+)?policy\b", re.IGNORECASE),
    re.compile(r"\bdisregard\s+(?:the\s+)?charter\b", re.IGNORECASE),
    re.compile(r"\bfrom\s+now\s+on\s+you\s+will\b", re.IGNORECASE),
    re.compile(r"\bdan\s+mode\b", re.IGNORECASE),
    re.compile(r"\bdo\s+anything\s+now\b", re.IGNORECASE),
)

# Limit override / charter tampering patterns
_LIMIT_OVERRIDE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:change|raise|increase|set|override|update|lift)\s+(?:the\s+)?(?:limits?|ceilings?|standing\s+authority|policy\s+limits?)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bstanding\s+authority\s+is\s+now\b", re.IGNORECASE),
    re.compile(r"\bmax_auto_refund\s+is\s+now\b", re.IGNORECASE),
    re.compile(r"\bunlimited\s+refunds?\b", re.IGNORECASE),
    re.compile(r"\bwaive\s+(?:all\s+)?approvals?\b", re.IGNORECASE),
    re.compile(r"\bauto\s+approve\s+all\b", re.IGNORECASE),
    re.compile(r"\ballow\s+up\s+to\s+\$?\d{4,}\b", re.IGNORECASE),
    re.compile(r"\bset\s+standing\s+authority\b", re.IGNORECASE),
    re.compile(r"\bforce\s+allow\b", re.IGNORECASE),
    re.compile(r"\bwaive\s+gate\b", re.IGNORECASE),
)

# Plan-shaped JSON patterns
_PLAN_JSON_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"[\"']action_type[\"']\s*:\s*[\"'](?:PROVIDE_EVIDENCE|SEND_MESSAGE|MAKE_OFFER|ACCEPT_CLAIM|ESCALATE|APPEAL|REFUND|CANCEL)[\"']",
        re.IGNORECASE,
    ),
    re.compile(r"[\"']proposed_action[\"']\s*:\s*\{", re.IGNORECASE),
    re.compile(r"[\"']actions[\"']\s*:\s*\[\s*\{.*[\"']action_type[\"']", re.IGNORECASE | re.DOTALL),
    re.compile(r"[\"']verdict[\"']\s*:\s*[\"']ALLOW[\"']", re.IGNORECASE),
)


def normalize_text(text: str) -> str:
    """Normalize input text: strip zero-width characters, replace homoglyphs, and normalize unicode."""
    if not text:
        return ""
    # 1. Strip zero-width & non-printable formatting characters
    cleaned = _ZERO_WIDTH_PATTERN.sub("", text)
    # 2. Transliterate lookalike homoglyphs
    cleaned = cleaned.translate(_HOMOGLYPH_MAP)
    # 3. Unicode normalization (NFKD decomposes accents and combining characters)
    normalized = unicodedata.normalize("NFKD", cleaned)
    # 4. Strip leftover combining characters
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    return normalized


def _check_plan_json(raw_text: str) -> tuple[bool, str]:
    """Check whether text contains plan-shaped JSON structures."""
    # Fast regex scan first
    for pattern in _PLAN_JSON_PATTERNS:
        match = pattern.search(raw_text)
        if match:
            return True, match.group(0)

    # Attempt to extract and parse any JSON blocks {...}
    json_candidates = re.findall(r"\{[^{}]*\}", raw_text)
    for candidate in json_candidates:
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                keys = {k.lower() for k in data}
                is_plan = (
                    "action_type" in keys
                    or "proposed_action" in keys
                    or ("verdict" in keys and data.get("verdict") == "ALLOW")
                )
                if is_plan:
                    return True, candidate
        except Exception:
            continue

    return False, ""


def screen_text(text: str) -> InjectionFlag:
    """Screen a single string for content-injection attempts.

    Returns an InjectionFlag with all detected signals.
    """
    if not text or not text.strip():
        return InjectionFlag(is_flagged=False)

    normalized = normalize_text(text)

    detected_signals: list[InjectionSignal] = []
    reasons: list[str] = []
    matches: list[str] = []

    # 1. System / Admin impersonation
    for pattern in _SYSTEM_IMPERSONATION_PATTERNS:
        match = pattern.search(normalized)
        if match:
            if InjectionSignal.SYSTEM_IMPERSONATION not in detected_signals:
                detected_signals.append(InjectionSignal.SYSTEM_IMPERSONATION)
                reasons.append("Impersonation of system or admin role detected")
            matches.append(match.group(0).strip())
            break

    # 2. Assistant instruction override / jailbreak
    for pattern in _ASSISTANT_INSTRUCTION_PATTERNS:
        match = pattern.search(normalized)
        if match:
            if InjectionSignal.ASSISTANT_INSTRUCTION not in detected_signals:
                detected_signals.append(InjectionSignal.ASSISTANT_INSTRUCTION)
                reasons.append("Instructions aimed at overriding assistant instructions detected")
            matches.append(match.group(0).strip())
            break

    # 3. Limit override / policy tampering
    for pattern in _LIMIT_OVERRIDE_PATTERNS:
        match = pattern.search(normalized)
        if match:
            if InjectionSignal.LIMIT_OVERRIDE not in detected_signals:
                detected_signals.append(InjectionSignal.LIMIT_OVERRIDE)
                reasons.append("Attempt to alter policy limits or standing authority detected")
            matches.append(match.group(0).strip())
            break

    # 4. Plan-shaped JSON in text
    is_json, match_snippet = _check_plan_json(normalized)
    if is_json:
        if InjectionSignal.PLAN_JSON not in detected_signals:
            detected_signals.append(InjectionSignal.PLAN_JSON)
            reasons.append("Plan-shaped JSON structure embedded in text")
        matches.append(match_snippet[:80])

    is_flagged = len(detected_signals) > 0
    return InjectionFlag(
        is_flagged=is_flagged,
        signals=tuple(detected_signals),
        reasons=tuple(reasons),
        matches=tuple(matches),
    )


def screen_fields(fields: dict[str, str | None]) -> InjectionFlag:
    """Screen multiple named fields for injection.

    Aggregates signals across all fields.
    """
    all_signals: list[InjectionSignal] = []
    all_reasons: list[str] = []
    all_matches: list[str] = []

    for field_name, value in fields.items():
        if not value:
            continue
        flag = screen_text(value)
        if flag.is_flagged:
            for sig in flag.signals:
                if sig not in all_signals:
                    all_signals.append(sig)
            for reason in flag.reasons:
                formatted_reason = f"[{field_name}] {reason}"
                if formatted_reason not in all_reasons:
                    all_reasons.append(formatted_reason)
            all_matches.extend(flag.matches)

    return InjectionFlag(
        is_flagged=len(all_signals) > 0,
        signals=tuple(all_signals),
        reasons=tuple(all_reasons),
        matches=tuple(all_matches),
    )


def screen_dispute_and_context(dispute: Any, order_context: Any | None = None) -> InjectionFlag:
    """Screen an entire dispute and its order context for injection.

    Checks:
    - Dispute messages from buyer
    - Item notes / buyer notes in order items
    - Tracking notes / payloads in shipments
    """
    fields_to_check: dict[str, str | None] = {}

    # Extract dispute messages
    messages = getattr(dispute, "messages", None) or []
    for idx, msg in enumerate(messages):
        content = getattr(msg, "content", None)
        if content is None and isinstance(msg, dict):
            content = msg.get("content")
        if content:
            fields_to_check[f"message_{idx}"] = str(content)

    # Extract order context buyer notes
    if order_context is not None:
        items = getattr(order_context, "items", None) or ()
        for idx, item in enumerate(items):
            if isinstance(item, dict):
                buyer_note = item.get("buyer_note")
                if buyer_note:
                    fields_to_check[f"order_item_{idx}_buyer_note"] = str(buyer_note)

        shipments = getattr(order_context, "shipments", None) or ()
        for idx, shipment in enumerate(shipments):
            payload = getattr(shipment, "payload", None)
            if isinstance(payload, dict):
                note = payload.get("note") or payload.get("tracking_note") or payload.get("comment")
                if note:
                    fields_to_check[f"shipment_{idx}_payload"] = str(note)

    return screen_fields(fields_to_check)
