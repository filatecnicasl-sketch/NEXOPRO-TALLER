"""Tests for Taller Hoja de entrada PDF endpoint (WeasyPrint)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-hub-861.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def orden_id():
    r = requests.get(f"{BASE_URL}/api/taller/ordenes", timeout=30)
    assert r.status_code == 200, f"listing ordenes failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "no ordenes available"
    oid = data[0].get("id")
    assert oid, "orden has no id"
    return oid


def test_list_ordenes():
    r = requests.get(f"{BASE_URL}/api/taller/ordenes", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_hoja_entrada_pdf_valid(orden_id):
    r = requests.get(f"{BASE_URL}/api/taller/ordenes/{orden_id}/hoja-entrada.pdf", timeout=60)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    ct = r.headers.get("content-type", "").lower()
    assert "application/pdf" in ct, f"unexpected content-type: {ct}"
    body = r.content
    assert len(body) > 1000, f"pdf body too small: {len(body)} bytes"
    assert body[:4] == b"%PDF", f"body does not start with %PDF: {body[:8]!r}"


def test_hoja_entrada_pdf_invalid_id():
    r = requests.get(f"{BASE_URL}/api/taller/ordenes/nonexistent-id-xyz-000/hoja-entrada.pdf", timeout=30)
    assert r.status_code == 404, f"expected 404, got {r.status_code}"
