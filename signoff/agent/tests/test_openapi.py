"""Tests for deterministic OpenAPI schema generation."""

import json
from pathlib import Path

from scripts.export_openapi import export_openapi


def test_openapi_export_run_twice_yields_identical_bytes(tmp_path: Path):
    """OpenAPI export run twice yields identical bytes."""
    path1 = export_openapi(tmp_path / "openapi.json")
    content1 = path1.read_bytes()

    path2 = export_openapi(tmp_path / "openapi.json")
    content2 = path2.read_bytes()

    assert content1 == content2, "OpenAPI schema generation must be strictly deterministic"


def test_openapi_schema_contains_error_envelope(tmp_path: Path):
    """Verify that OpenAPI schema includes ErrorEnvelope for standard error responses."""
    path = export_openapi(tmp_path / "openapi.json")
    schema = json.loads(path.read_text(encoding="utf-8"))

    # Components / schemas should include ErrorEnvelope
    schemas = schema.get("components", {}).get("schemas", {})
    assert "ErrorEnvelope" in schemas
    assert "ErrorDetail" in schemas
    assert "FieldError" in schemas
