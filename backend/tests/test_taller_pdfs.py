"""Tests for Taller PDFs (Parte de trabajo + Hoja de entrada) via WeasyPrint."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def orden_id():
    r = requests.get(f"{BASE_URL}/api/taller/ordenes", timeout=30)
    assert r.status_code == 200, f"listing failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "no ordenes available"
    oid = data[0].get("id")
    assert oid
    return oid


def _assert_pdf(r):
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    ct = r.headers.get("content-type", "").lower()
    assert "application/pdf" in ct, f"unexpected content-type: {ct}"
    body = r.content
    assert len(body) > 1000, f"pdf too small: {len(body)}"
    assert body[:4] == b"%PDF", f"not a pdf: {body[:8]!r}"


def test_parte_trabajo_pdf_valid(orden_id):
    r = requests.get(f"{BASE_URL}/api/taller/ordenes/{orden_id}/parte-trabajo.pdf", timeout=60)
    _assert_pdf(r)


def test_parte_trabajo_pdf_invalid():
    r = requests.get(f"{BASE_URL}/api/taller/ordenes/nonexistent-xyz-000/parte-trabajo.pdf", timeout=30)
    assert r.status_code == 404


def test_hoja_entrada_pdf_valid(orden_id):
    r = requests.get(f"{BASE_URL}/api/taller/ordenes/{orden_id}/hoja-entrada.pdf", timeout=60)
    _assert_pdf(r)


def test_hoja_entrada_pdf_invalid():
    r = requests.get(f"{BASE_URL}/api/taller/ordenes/nonexistent-xyz-000/hoja-entrada.pdf", timeout=30)
    assert r.status_code == 404
