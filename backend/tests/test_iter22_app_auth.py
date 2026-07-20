"""
Iteration 22 — App auth (login del ERP): roles, 2FA, anti-fuerza-bruta,
gestión de usuarios y aislamiento vs panel de licencias /admin.

Estrategia: NO cambiamos la contraseña del admin del taller para no romper
el estado (must_change_password=true). Creamos un operario de prueba y
sobre él probamos brute-force, RBAC y 2FA. Limpieza al final.
"""
import os
import time
import pytest
import requests
import pyotp

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-hub-861.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "administrador@taller.com"
ADMIN_PASSWORD = "Taller1234!"

TEST_OP_EMAIL = "test_op_iter22@taller.com"
TEST_OP_PASSWORD = "Operario1"  # cumple política (>=8, 1 mayus, 1 num)

LIC_ADMIN_EMAIL = "admin@nexopro.com"
LIC_ADMIN_PASSWORD = "Admin1234!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/app/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login admin fallo: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    assert data.get("must_change_password") is True, "Se esperaba must_change_password=true"
    return data["token"]


@pytest.fixture(scope="module")
def operario(admin_token):
    """Crea (idempotente) un operario de prueba y devuelve dict con id/email/password."""
    h = {"Authorization": f"Bearer {admin_token}"}
    # Si existe por prueba anterior, borrarlo
    lst = requests.get(f"{API}/app/usuarios", headers=h).json()
    for u in lst:
        if u.get("email") == TEST_OP_EMAIL:
            requests.delete(f"{API}/app/usuarios/{u['id']}", headers=h)
    r = requests.post(f"{API}/app/usuarios", headers=h, json={
        "nombre": "Operario Test", "email": TEST_OP_EMAIL,
        "password": TEST_OP_PASSWORD, "role": "operario", "activo": True,
    })
    assert r.status_code == 200, f"Crear operario fallo: {r.status_code} {r.text}"
    uid = r.json()["id"]
    yield {"id": uid, "email": TEST_OP_EMAIL, "password": TEST_OP_PASSWORD}
    # Cleanup
    requests.delete(f"{API}/app/usuarios/{uid}", headers=h)


class TestAppAuthBasico:
    def test_login_admin_ok(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_me_admin(self, admin_token):
        r = requests.get(f"{API}/app/auth/me",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"
        assert d["must_change_password"] is True

    def test_login_credenciales_invalidas(self):
        r = requests.post(f"{API}/app/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "PasswordMal1"})
        # Podría ser 401 o 423 si algún otro test ya intentó; aceptamos ambos.
        assert r.status_code in (401, 423)

    def test_me_sin_token(self):
        r = requests.get(f"{API}/app/auth/me")
        assert r.status_code == 401


class TestPoliticaPassword:
    def test_password_debil_al_crear(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{API}/app/usuarios", headers=h, json={
            "nombre": "Debil", "email": "test_weak_iter22@taller.com",
            "password": "abc", "role": "operario",
        })
        assert r.status_code == 400, f"Se esperaba 400 por política; got {r.status_code} {r.text}"
        assert "8" in r.text or "may" in r.text.lower() or "númer" in r.text.lower()

    def test_password_ok_al_crear_y_borrar(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{API}/app/usuarios", headers=h, json={
            "nombre": "Fuerte", "email": "test_strong_iter22@taller.com",
            "password": "Fuerte12", "role": "operario",
        })
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # Cleanup inmediato
        d = requests.delete(f"{API}/app/usuarios/{uid}", headers=h)
        assert d.status_code == 200


class TestGestionUsuarios:
    def test_listar_usuarios_admin(self, admin_token, operario):
        r = requests.get(f"{API}/app/usuarios",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        assert operario["email"] in emails

    def test_editar_usuario(self, admin_token, operario):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.put(f"{API}/app/usuarios/{operario['id']}", headers=h, json={
            "nombre": "Operario Editado", "email": operario["email"],
            "role": "recepcion", "activo": True,
        })
        assert r.status_code == 200, r.text
        # Verify
        lst = requests.get(f"{API}/app/usuarios", headers=h).json()
        u = next(u for u in lst if u["id"] == operario["id"])
        assert u["nombre"] == "Operario Editado"
        assert u["role"] == "recepcion"
        # Devolver a operario para siguientes tests
        requests.put(f"{API}/app/usuarios/{operario['id']}", headers=h, json={
            "nombre": "Operario Test", "email": operario["email"],
            "role": "operario", "activo": True,
        })

    def test_reset_password(self, admin_token, operario):
        h = {"Authorization": f"Bearer {admin_token}"}
        nueva = "Reset123A"
        r = requests.post(f"{API}/app/usuarios/{operario['id']}/reset-password",
                          headers=h, json={"nueva": nueva})
        assert r.status_code == 200, r.text
        # Login con la nueva y actualizar el password del fixture
        rl = requests.post(f"{API}/app/auth/login",
                           json={"email": operario["email"], "password": nueva})
        assert rl.status_code == 200
        assert rl.json().get("must_change_password") is True
        # Reset de nuevo a la password original para siguientes tests
        r2 = requests.post(f"{API}/app/usuarios/{operario['id']}/reset-password",
                           headers=h, json={"nueva": TEST_OP_PASSWORD})
        assert r2.status_code == 200


def _operario_token(email, password):
    r = requests.post(f"{API}/app/auth/login",
                      json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


class TestRBAC:
    def test_operario_no_puede_listar_usuarios(self, operario):
        tok = _operario_token(operario["email"], operario["password"])
        r = requests.get(f"{API}/app/usuarios",
                        headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403

    def test_operario_no_puede_crear_usuarios(self, operario):
        tok = _operario_token(operario["email"], operario["password"])
        r = requests.post(f"{API}/app/usuarios",
                        headers={"Authorization": f"Bearer {tok}"}, json={
            "nombre": "x", "email": "xyz_iter22@taller.com",
            "password": "AAAA1111", "role": "operario",
        })
        assert r.status_code == 403


class TestBruteForce:
    def test_bloqueo_al_5o_intento(self, admin_token, operario):
        # Cinco intentos fallidos deberían bloquear la cuenta
        email = operario["email"]
        codes = []
        for i in range(5):
            r = requests.post(f"{API}/app/auth/login",
                             json={"email": email, "password": "WrongPw123"})
            codes.append(r.status_code)
        # Últimos deben ser 423
        assert 423 in codes, f"Se esperaba 423 en algún intento, codes={codes}"
        # Ahora incluso con la contraseña correcta debe estar bloqueado
        r_ok = requests.post(f"{API}/app/auth/login",
                            json={"email": email, "password": operario["password"]})
        assert r_ok.status_code == 423
        # Limpiar bloqueo con reset-password (el admin fuerza nueva pwd y limpia locked_until vía update)
        # El endpoint reset-password NO limpia locked_until, así que usamos editar_usuario para desbloquear:
        # Alternativa robusta: esperar. Como no queremos esperar 15 min, borramos y recreamos al final via fixture teardown.
        # Para que siguientes tests (2FA) funcionen, recreamos el usuario:
        h = {"Authorization": f"Bearer {admin_token}"}
        requests.delete(f"{API}/app/usuarios/{operario['id']}", headers=h)
        rc = requests.post(f"{API}/app/usuarios", headers=h, json={
            "nombre": "Operario Test", "email": operario["email"],
            "password": operario["password"], "role": "operario", "activo": True,
        })
        assert rc.status_code == 200
        # Actualizar id para el teardown del fixture
        operario["id"] = rc.json()["id"]


class TestTwoFA:
    def test_ciclo_2fa(self, operario):
        tok = _operario_token(operario["email"], operario["password"])
        h = {"Authorization": f"Bearer {tok}"}
        # Setup
        r = requests.post(f"{API}/app/auth/2fa/setup", headers=h)
        assert r.status_code == 200
        secret = r.json()["secret"]
        assert r.json()["otpauth_uri"].startswith("otpauth://")
        # Enable
        code = pyotp.TOTP(secret).now()
        r2 = requests.post(f"{API}/app/auth/2fa/enable", headers=h, json={"code": code})
        assert r2.status_code == 200
        # Login sin código -> requires_2fa
        r3 = requests.post(f"{API}/app/auth/login",
                          json={"email": operario["email"], "password": operario["password"]})
        assert r3.status_code == 200
        assert r3.json().get("requires_2fa") is True
        # Login con código válido
        code2 = pyotp.TOTP(secret).now()
        r4 = requests.post(f"{API}/app/auth/login", json={
            "email": operario["email"], "password": operario["password"], "totp_code": code2})
        assert r4.status_code == 200
        assert "token" in r4.json()
        # Disable (usando token del último login por si fuera necesario)
        h2 = {"Authorization": f"Bearer {r4.json()['token']}"}
        code3 = pyotp.TOTP(secret).now()
        r5 = requests.post(f"{API}/app/auth/2fa/disable", headers=h2, json={"code": code3})
        assert r5.status_code == 200
        # Login normal ya sin 2FA
        r6 = requests.post(f"{API}/app/auth/login",
                          json={"email": operario["email"], "password": operario["password"]})
        assert r6.status_code == 200
        assert r6.json().get("requires_2fa") is not True


class TestAislamientoPanelLicencias:
    def test_panel_licencias_login(self):
        r = requests.post(f"{API}/auth/login",
                        json={"email": LIC_ADMIN_EMAIL, "password": LIC_ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        assert "token" in r.json() or "access_token" in r.json()

    def test_token_app_no_vale_para_panel(self, admin_token):
        # El token del taller no debería servir para endpoints del panel de licencias
        r = requests.get(f"{API}/auth/me",
                        headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code in (401, 403), f"Token del taller no debería valer, got {r.status_code}"
