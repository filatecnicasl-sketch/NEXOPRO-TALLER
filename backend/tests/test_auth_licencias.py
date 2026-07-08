"""Backend tests for NexoPro auth + license admin feature."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
API = BASE_URL.rstrip("/") + "/api"

ADMIN_EMAIL = "admin@nexopro.com"
ADMIN_PASSWORD = "Admin1234!"
DEMO_KEY = "NEXO-DEMO-0001"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_success():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["email"] == ADMIN_EMAIL
    assert isinstance(d["token"], str) and len(d["token"]) > 10


def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_auth_me_requires_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_auth_me_with_token(auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_licencias_requires_auth():
    r = requests.get(f"{API}/admin/licencias")
    assert r.status_code == 401


def test_licencias_list_has_demo(auth_headers):
    r = requests.get(f"{API}/admin/licencias", headers=auth_headers)
    assert r.status_code == 200
    lics = r.json()
    demo = next((l for l in lics if l["license_key"] == DEMO_KEY), None)
    assert demo is not None, "Demo license not seeded"
    assert demo["empresa"] == "Empresa Demo SL"


def test_verificar_licencia_public_active():
    r = requests.get(f"{API}/licencia/verificar/{DEMO_KEY}")
    assert r.status_code == 200
    d = r.json()
    assert d["valida"] is True
    assert d["estado"] == "activa"


def test_full_lifecycle_crud(auth_headers):
    # Create
    payload = {"empresa": "TEST_Empresa SL", "email": "test@x.com", "precio_mensual": 49}
    r = requests.post(f"{API}/admin/licencias", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    lic = r.json()
    assert lic["empresa"] == "TEST_Empresa SL"
    assert lic["license_key"].startswith("NEXO-")
    assert lic["estado"] == "activa"
    lic_id = lic["id"]

    # Suspend via Form
    r = requests.patch(f"{API}/admin/licencias/{lic_id}/estado", data={"estado": "suspendida"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["estado"] == "suspendida"

    # Verify public says invalid
    r = requests.get(f"{API}/licencia/verificar/{lic['license_key']}")
    assert r.json()["valida"] is False

    # Activate
    r = requests.patch(f"{API}/admin/licencias/{lic_id}/estado", data={"estado": "activa"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["estado"] == "activa"

    # Registrar pago
    r = requests.post(f"{API}/admin/licencias/{lic_id}/pago", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["ultimo_pago"] is not None
    assert d["estado"] == "activa"

    # Delete
    r = requests.delete(f"{API}/admin/licencias/{lic_id}", headers=auth_headers)
    assert r.status_code == 200


def test_demo_left_active(auth_headers):
    r = requests.get(f"{API}/licencia/verificar/{DEMO_KEY}")
    assert r.json()["estado"] == "activa"
