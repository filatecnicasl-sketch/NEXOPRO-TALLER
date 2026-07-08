"""Backend tests for the appointment reminders (recordatorios) feature.

Covers:
- GET /api/ajustes returns notificaciones with masked secrets + *_set flags
- PUT /api/ajustes preserves masked secrets, empresa data and series
- POST /api/notificaciones/test returns 400 (Spanish) when unconfigured
- POST /api/taller/citas/{cid}/recordatorio graceful handling when unconfigured, and 404 for missing cita
- Scheduler doesn't crash backend (GET /api/ returns ok)
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE:
    # fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.strip().split("=", 1)[1]
                break
BASE = BASE.rstrip("/")
API = f"{BASE}/api"
MASK = "••••••••"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def initial_ajustes(client):
    r = client.get(f"{API}/ajustes", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---- Health / scheduler ----
def test_health_ok(client):
    r = client.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    # Accept either {"status":"ok"} or {"message": ...}
    assert isinstance(data, dict)
    # Just ensuring backend up and scheduler didn't crash it


# ---- GET /api/ajustes structure ----
def test_ajustes_notificaciones_structure(initial_ajustes):
    cfg = initial_ajustes
    assert "notificaciones" in cfg
    notif = cfg["notificaciones"]
    for sec in ("email", "whatsapp", "recordatorios"):
        assert sec in notif, f"missing section {sec}"
    # api_key / auth_token fields exist
    assert "api_key" in notif["email"]
    assert "api_key_set" in notif["email"]
    assert "auth_token" in notif["whatsapp"]
    assert "auth_token_set" in notif["whatsapp"]
    # When unset (or set), api_key value must be empty or the mask (never real value)
    assert notif["email"]["api_key"] in ("", MASK)
    assert notif["whatsapp"]["auth_token"] in ("", MASK)


# ---- Secret masking + preservation on PUT ----
def test_put_preserves_masked_secrets_and_empresa_series(client, initial_ajustes):
    prev = initial_ajustes
    empresa_prev = prev.get("empresa", {})
    sv_prev = prev.get("series_venta", [])
    sc_prev = prev.get("series_compra", [])

    # Step 1: save real secrets
    payload = {
        "empresa": empresa_prev,
        "series_venta": sv_prev,
        "series_compra": sc_prev,
        "notificaciones": {
            "email": {
                "activo": True,
                "api_key": "re_TEST_realkey_ABCDEFG",
                "from_email": "test@example.com",
                "from_nombre": "TEST",
            },
            "whatsapp": {
                "activo": True,
                "account_sid": "ACtestsid",
                "auth_token": "TEST_wa_realtoken_XYZ",
                "from_number": "+34600000000",
            },
            "recordatorios": {"activo": False, "horas_antes": 24, "canal": "ambos"},
        },
    }
    r = client.put(f"{API}/ajustes", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    saved = r.json()
    # Response should be masked
    assert saved["notificaciones"]["email"]["api_key"] == MASK
    assert saved["notificaciones"]["email"]["api_key_set"] is True
    assert saved["notificaciones"]["whatsapp"]["auth_token"] == MASK
    assert saved["notificaciones"]["whatsapp"]["auth_token_set"] is True
    # from_email preserved
    assert saved["notificaciones"]["email"]["from_email"] == "test@example.com"

    # Step 2: save again with mask -> secret must be preserved
    payload2 = {
        "empresa": empresa_prev,
        "series_venta": sv_prev,
        "series_compra": sc_prev,
        "notificaciones": {
            "email": {
                "activo": True,
                "api_key": MASK,  # placeholder
                "from_email": "test@example.com",
                "from_nombre": "TEST2",
            },
            "whatsapp": {
                "activo": True,
                "account_sid": "ACtestsid",
                "auth_token": MASK,  # placeholder
                "from_number": "+34600000000",
            },
            "recordatorios": {"activo": False, "horas_antes": 24, "canal": "ambos"},
        },
    }
    r2 = client.put(f"{API}/ajustes", json=payload2, timeout=30)
    assert r2.status_code == 200, r2.text
    saved2 = r2.json()
    assert saved2["notificaciones"]["email"]["api_key_set"] is True, "secret was wiped by mask"
    assert saved2["notificaciones"]["whatsapp"]["auth_token_set"] is True, "wa secret wiped by mask"
    assert saved2["notificaciones"]["email"]["from_nombre"] == "TEST2"  # non-secret updated

    # Verify empresa & series preserved
    got = client.get(f"{API}/ajustes", timeout=15).json()
    assert got["empresa"] == empresa_prev, "empresa data changed"
    # Compare series by nombre (ignore counter increments from other tests)
    sv_names_before = sorted([s["nombre"] for s in sv_prev])
    sv_names_after = sorted([s["nombre"] for s in got.get("series_venta", [])])
    assert sv_names_before == sv_names_after, "series_venta names changed"
    sc_names_before = sorted([s["nombre"] for s in sc_prev])
    sc_names_after = sorted([s["nombre"] for s in got.get("series_compra", [])])
    assert sc_names_before == sc_names_after, "series_compra names changed"


# ---- POST /api/notificaciones/test error paths ----
def test_notificacion_test_email_not_configured(client):
    # First clear email config
    prev = client.get(f"{API}/ajustes", timeout=15).json()
    payload = {
        "empresa": prev.get("empresa", {}),
        "series_venta": prev.get("series_venta", []),
        "series_compra": prev.get("series_compra", []),
        "notificaciones": {
            "email": {"activo": False, "api_key": "", "from_email": "", "from_nombre": ""},
            "whatsapp": {"activo": False, "account_sid": "", "auth_token": "", "from_number": ""},
            "recordatorios": {"activo": False},
        },
    }
    r = client.put(f"{API}/ajustes", json=payload, timeout=30)
    assert r.status_code == 200

    r = client.post(f"{API}/notificaciones/test",
                    json={"canal": "email", "destino": "foo@bar.com"}, timeout=15)
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "")
    assert "Configura" in detail or "configur" in detail.lower()


def test_notificacion_test_whatsapp_not_configured(client):
    r = client.post(f"{API}/notificaciones/test",
                    json={"canal": "whatsapp", "destino": "+34600000000"}, timeout=15)
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "")
    assert "Configura" in detail or "SID" in detail or "token" in detail.lower()


# ---- Cita recordatorio: graceful error, no 500 ----
@pytest.fixture(scope="module")
def test_cita(client):
    payload = {
        "vehiculo_id": "",
        "vehiculo_matricula": "TEST-ZZZ",
        "cliente_id": "",
        "cliente_nombre": "TEST_Cliente",
        "fecha": "2099-12-31T10:00",
        "motivo": "TEST recordatorio",
        "estado": "pendiente",
    }
    r = client.post(f"{API}/taller/citas", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    cita = r.json()
    assert cita.get("id")
    yield cita
    # teardown
    try:
        client.delete(f"{API}/taller/citas/{cita['id']}", timeout=15)
    except Exception:
        pass


def test_recordatorio_cita_no_config(client, test_cita):
    # Neither channel configured -> should return enviado False and per-channel error, NOT 500
    r = client.post(f"{API}/taller/citas/{test_cita['id']}/recordatorio",
                    data={"canal": "ambos"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("enviado") is False
    resultados = body.get("resultados", {})
    assert "email" in resultados
    assert resultados["email"]["ok"] is False
    assert "configurad" in resultados["email"].get("error", "").lower() or \
           "Ajustes" in resultados["email"].get("error", "")
    assert "whatsapp" in resultados
    assert resultados["whatsapp"]["ok"] is False


def test_recordatorio_cita_not_found(client):
    r = client.post(f"{API}/taller/citas/nonexistent-id-xxx/recordatorio", timeout=15)
    assert r.status_code == 404


# ---- Final cleanup: leave the demo instance clean ----
def test_zzz_cleanup_notificaciones(client):
    prev = client.get(f"{API}/ajustes", timeout=15).json()
    payload = {
        "empresa": prev.get("empresa", {}),
        "series_venta": prev.get("series_venta", []),
        "series_compra": prev.get("series_compra", []),
        "notificaciones": {
            "email": {"activo": False, "api_key": "", "from_email": "", "from_nombre": ""},
            "whatsapp": {"activo": False, "account_sid": "", "auth_token": "", "from_number": ""},
            "recordatorios": {"activo": False, "horas_antes": 24, "canal": "email"},
        },
    }
    # Note: sending "" for api_key here — server treats None or MASK as preserve, but "" overwrites.
    # Actually re-check: guardar_ajustes preserves prev secret if entrante is None OR MASK.
    # Empty string "" is NOT preserved -> it goes through the merge as-is => cleared. Good.
    r = client.put(f"{API}/ajustes", json=payload, timeout=30)
    assert r.status_code == 200
    got = r.json()
    assert got["notificaciones"]["email"]["api_key_set"] is False
    assert got["notificaciones"]["whatsapp"]["auth_token_set"] is False
    assert got["notificaciones"]["recordatorios"]["activo"] is False
