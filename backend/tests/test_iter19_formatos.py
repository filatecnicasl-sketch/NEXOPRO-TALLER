"""Tests for Formatos de impresión (Phase 1) and regression checks."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-hub-861.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- Formatos CRUD ----------

def test_list_formatos(s):
    r = s.get(f"{API}/formatos", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_update_delete_formato(s):
    payload = {
        "name": "TEST_Formato",
        "page": {"size": "A4", "orientation": "portrait"},
        "elements": [{"id": "e1", "type": "text", "x": 10, "y": 10, "w": 40, "h": 8, "text": "Hola"}],
    }
    r = s.post(f"{API}/formatos", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert "id" in doc and doc["name"] == "TEST_Formato"
    assert doc["page"]["size"] == "A4"
    assert len(doc["elements"]) == 1
    fid = doc["id"]

    # Update
    upd = {
        "name": "TEST_Formato_Updated",
        "page": {"size": "A5", "orientation": "landscape"},
        "elements": [],
    }
    r2 = s.put(f"{API}/formatos/{fid}", json=upd, timeout=30)
    assert r2.status_code == 200, r2.text
    ud = r2.json()
    assert ud["name"] == "TEST_Formato_Updated"
    assert ud["page"]["size"] == "A5"
    assert ud["elements"] == []

    # Verify persistence via list
    r3 = s.get(f"{API}/formatos", timeout=30)
    assert r3.status_code == 200
    found = [x for x in r3.json() if x.get("id") == fid]
    assert found and found[0]["name"] == "TEST_Formato_Updated"

    # Delete
    r4 = s.delete(f"{API}/formatos/{fid}", timeout=30)
    assert r4.status_code == 200
    assert r4.json().get("ok") is True

    # Confirm gone
    r5 = s.get(f"{API}/formatos", timeout=30)
    assert not any(x.get("id") == fid for x in r5.json())


def test_update_invalid_formato_404(s):
    upd = {"name": "x", "page": {"size": "A4", "orientation": "portrait"}, "elements": []}
    r = s.put(f"{API}/formatos/no-existe-xyz", json=upd, timeout=30)
    assert r.status_code == 404


# ---------- Regression ----------

def test_hoja_entrada_html_regression(s):
    # Need any orden id: list ordenes
    r = s.get(f"{API}/taller/ordenes", timeout=30)
    if r.status_code != 200 or not r.json():
        pytest.skip("No ordenes de taller para regresión")
    oid = r.json()[0].get("id")
    if not oid:
        pytest.skip("Orden sin id")
    r2 = s.get(f"{API}/taller/ordenes/{oid}/hoja-entrada.html", timeout=30)
    assert r2.status_code == 200
    assert "text/html" in r2.headers.get("content-type", "").lower()


def test_ajustes_modulo_inicio_regression(s):
    # GET current ajustes
    r = s.get(f"{API}/ajustes", timeout=30)
    assert r.status_code == 200
    cur = r.json() if isinstance(r.json(), dict) else {}
    prev = cur.get("modulo_inicio") or cur.get("moduloInicio") or "facturacion"
    # Try PUT with modulo_inicio
    r2 = s.put(f"{API}/ajustes", json={**cur, "modulo_inicio": "taller"}, timeout=30)
    assert r2.status_code in (200, 204)
    r3 = s.get(f"{API}/ajustes", timeout=30)
    assert r3.status_code == 200
    # Restore
    s.put(f"{API}/ajustes", json={**cur, "modulo_inicio": prev}, timeout=30)
