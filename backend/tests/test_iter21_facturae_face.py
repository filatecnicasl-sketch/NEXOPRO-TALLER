"""Iteration 21 — Facturae Fase 2: firma XAdES-EPES + FACe."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-hub-861.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
P12_PATH = "/tmp/test.p12"
P12_PASS = "1234"


@pytest.fixture(scope="module")
def factura_id():
    r = requests.get(f"{API}/facturas-emitidas", timeout=30)
    r.raise_for_status()
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", [])
    assert items, "No hay facturas emitidas para probar"
    return items[0]["id"]


def _subir_cert():
    with open(P12_PATH, "rb") as fh:
        files = {"file": ("test.p12", fh.read(), "application/x-pkcs12")}
    data = {"password": P12_PASS, "entorno": "pruebas", "proveedor_email": "taller@demo.es"}
    return requests.post(f"{API}/facturae/certificado", files=files, data=data, timeout=30)


# ---------- Ajustes: metadatos facturae, sin secretos ----------
class TestAjustesFacturaeMetadata:
    def test_get_ajustes_facturae_metadata(self):
        r = requests.get(f"{API}/ajustes", timeout=30)
        assert r.status_code == 200
        cfg = r.json()
        assert "facturae" in cfg
        fe = cfg["facturae"]
        # metadata keys presentes
        for k in ["entorno", "proveedor_email", "cert_configurado",
                  "cert_titular", "cert_valido_desde", "cert_valido_hasta", "cert_emisor"]:
            assert k in fe, f"Falta clave {k} en facturae"
        # secretos nunca expuestos
        assert "cert_p12_base64" not in fe
        assert "cert_password" not in fe


# ---------- Certificado: subir/validar ----------
class TestCertificado:
    def test_subir_cert_valido(self):
        r = _subir_cert()
        assert r.status_code == 200, r.text
        fe = r.json()["facturae"]
        assert fe["cert_configurado"] is True
        assert "Test Emisor SL" in fe["cert_titular"]
        assert "cert_p12_base64" not in fe

    def test_subir_cert_password_incorrecta(self):
        with open(P12_PATH, "rb") as fh:
            files = {"file": ("test.p12", fh.read(), "application/x-pkcs12")}
        data = {"password": "wrongpass", "entorno": "pruebas", "proveedor_email": ""}
        r = requests.post(f"{API}/facturae/certificado", files=files, data=data, timeout=30)
        assert r.status_code == 400, f"Esperaba 400, got {r.status_code}: {r.text}"
        assert "certificado" in r.text.lower() or "contraseña" in r.text.lower()

    def test_subir_cert_fichero_invalido(self):
        files = {"file": ("bad.p12", b"not-a-real-p12", "application/x-pkcs12")}
        data = {"password": "1234", "entorno": "pruebas", "proveedor_email": ""}
        r = requests.post(f"{API}/facturae/certificado", files=files, data=data, timeout=30)
        assert r.status_code == 400

    def test_put_config_no_borra_cert(self):
        # asegurar cert subido
        _subir_cert()
        r = requests.put(f"{API}/facturae/config",
                         data={"entorno": "pruebas", "proveedor_email": "nuevo@demo.es"},
                         timeout=30)
        assert r.status_code == 200, r.text
        fe = r.json()["facturae"]
        assert fe["cert_configurado"] is True
        assert fe["proveedor_email"] == "nuevo@demo.es"
        assert fe["entorno"] == "pruebas"

    def test_delete_cert(self):
        r = requests.delete(f"{API}/facturae/certificado", timeout=30)
        assert r.status_code == 200, r.text
        fe = r.json()["facturae"]
        assert fe["cert_configurado"] is False


# ---------- Firma XAdES-EPES ----------
class TestFirma:
    def test_firmado_sin_certificado_400(self, factura_id):
        # asegurar sin certificado
        requests.delete(f"{API}/facturae/certificado", timeout=30)
        r = requests.get(f"{API}/facturas-emitidas/{factura_id}/facturae-firmado", timeout=30)
        assert r.status_code == 400, f"Esperaba 400, got {r.status_code}"
        assert "certificado" in r.text.lower()

    def test_firmado_con_certificado_ok(self, factura_id):
        up = _subir_cert()
        assert up.status_code == 200, up.text
        r = requests.get(f"{API}/facturas-emitidas/{factura_id}/facturae-firmado", timeout=60)
        assert r.status_code == 200, r.text[:500]
        body = r.content
        assert len(body) > 1000, f"XSIG demasiado corto: {len(body)}"
        txt = body.decode("utf-8", errors="ignore")
        assert "ds:Signature" in txt or "<Signature" in txt
        assert "SignedProperties" in txt
        assert "SignaturePolicyIdentifier" in txt or "SignaturePolicyId" in txt


# ---------- FACe: error controlado 502 ----------
class TestEnviarFace:
    def test_enviar_face_error_controlado(self, factura_id):
        # cert debe estar configurado
        _subir_cert()
        # Test against local backend to bypass Cloudflare 502 HTML masking
        local = "http://localhost:8001/api"
        r = requests.post(f"{local}/facturas-emitidas/{factura_id}/enviar-face", timeout=120)
        assert r.status_code != 500, f"Backend crash! 500: {r.text[:300]}"
        assert r.status_code in (400, 502), f"Esperaba 502/400, got {r.status_code}: {r.text[:300]}"
        j = r.json()
        assert "detail" in j
        assert "FACe" in j["detail"] or "face" in j["detail"].lower()

    def test_backend_sigue_vivo(self):
        r = requests.get(f"{API}/ajustes", timeout=10)
        assert r.status_code == 200
