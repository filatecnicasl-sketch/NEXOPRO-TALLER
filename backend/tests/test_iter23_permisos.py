"""Iter23 — backend permisos por módulo (POST/PUT /api/app/usuarios, GET /me)."""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "administrador@taller.com"
ADMIN_PASS = "Taller1234!"
MECANICO_EMAIL = "mecanico@taller.com"
MECANICO_PASS = "Mecanico1"

API = f"{BASE_URL}/api/app"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert not data.get("must_change_password"), "admin must_change_password should be False in preview"
    return data["token"]


@pytest.fixture(scope="module")
def mecanico_token():
    r = requests.post(f"{API}/auth/login", json={"email": MECANICO_EMAIL, "password": MECANICO_PASS}, timeout=15)
    assert r.status_code == 200, f"mecanico login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


# ---- /me con permisos y es_admin ----
def test_me_admin_permisos_todos(admin_token):
    r = requests.get(f"{API}/auth/me", headers=h(admin_token), timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["es_admin"] is True
    assert set(d["permisos"]) == {"articulos", "ventas", "compras", "taller"}


def test_me_mecanico_solo_taller(mecanico_token):
    r = requests.get(f"{API}/auth/me", headers=h(mecanico_token), timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["es_admin"] is False
    assert d["permisos"] == ["taller"]


# ---- POST filtra 'ajustes' ----
def test_crear_usuario_filtra_ajustes(admin_token):
    email = "TEST_iter23_ventasajustes@taller.com"
    payload = {
        "nombre": "Test Iter23",
        "email": email,
        "password": "Testing1234",
        "role": "recepcion",
        "activo": True,
        "permisos": ["ventas", "ajustes", "articulos", "loquesea"],
    }
    r = requests.post(f"{API}/usuarios", headers=h(admin_token), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    uid = body["id"]
    try:
        assert body["es_admin"] is False
        assert "ajustes" not in body["permisos"]
        assert set(body["permisos"]) == {"ventas", "articulos"}

        # GET listar y verificar persistencia
        r2 = requests.get(f"{API}/usuarios", headers=h(admin_token), timeout=10)
        assert r2.status_code == 200
        found = [u for u in r2.json() if u["id"] == uid]
        assert found and set(found[0]["permisos"]) == {"ventas", "articulos"}

        # PUT actualizar permisos, incluye 'ajustes' -> filtra
        upd = {**payload, "permisos": ["taller", "ajustes"], "password": None}
        r3 = requests.put(f"{API}/usuarios/{uid}", headers=h(admin_token), json=upd, timeout=15)
        assert r3.status_code == 200, r3.text
        assert set(r3.json()["permisos"]) == {"taller"}
    finally:
        requests.delete(f"{API}/usuarios/{uid}", headers=h(admin_token), timeout=10)


# ---- role=admin fuerza permisos a todos ----
def test_crear_admin_permisos_forzados(admin_token):
    email = "TEST_iter23_admin@taller.com"
    payload = {
        "nombre": "Admin Iter23",
        "email": email,
        "password": "Testing1234",
        "role": "admin",
        "activo": True,
        "permisos": [],  # vacío pero debe forzarse a todos
    }
    r = requests.post(f"{API}/usuarios", headers=h(admin_token), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    uid = body["id"]
    try:
        assert body["es_admin"] is True
        assert set(body["permisos"]) == {"articulos", "ventas", "compras", "taller"}
    finally:
        requests.delete(f"{API}/usuarios/{uid}", headers=h(admin_token), timeout=10)


# ---- RBAC: operario no puede listar usuarios ----
def test_operario_no_puede_listar_usuarios(mecanico_token):
    r = requests.get(f"{API}/usuarios", headers=h(mecanico_token), timeout=10)
    assert r.status_code == 403


# ---- Login gate: sin token /me devuelve 401 ----
def test_me_sin_token():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code in (401, 403)
