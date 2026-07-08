"""Tests for iteration 10: PDF storage for facturas recibidas, albaranes compra, and proveedor bank fields."""
import os
import io
import pytest
import requests

def _load_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return ""
    return ""

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _load_env()).rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL not set"
API = f"{BASE}/api"

# minimal valid PDF bytes
PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000053 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n96\n%%EOF"


@pytest.fixture(scope="module")
def uploaded_pdf():
    files = {"file": ("test.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = requests.post(f"{API}/archivos/subir", files=files, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "pdf_path" in data and "pdf_filename" in data
    return data


def test_upload_pdf(uploaded_pdf):
    assert uploaded_pdf["pdf_filename"] == "test.pdf"
    assert uploaded_pdf["pdf_path"]


def test_get_pdf_returns_application_pdf(uploaded_pdf):
    r = requests.get(f"{API}/archivos/{uploaded_pdf['pdf_path']}", timeout=30)
    assert r.status_code == 200
    assert "application/pdf" in r.headers.get("content-type", "").lower()
    assert r.content.startswith(b"%PDF")


def test_upload_non_pdf_rejected():
    files = {"file": ("x.txt", io.BytesIO(b"nope"), "text/plain")}
    r = requests.post(f"{API}/archivos/subir", files=files, timeout=15)
    assert r.status_code == 400


def test_proveedor_bank_fields_persist():
    payload = {
        "nombre": "TEST_ProvBanco",
        "nif": "B99999999",
        "tipo": "proveedor",
        "iban": "ES9121000418450200051332",
        "banco": "CaixaBank",
        "swift": "CAIXESBBXXX",
    }
    r = requests.post(f"{API}/contactos", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    prov = r.json()
    pid = prov.get("id")
    assert pid
    # GET
    r2 = requests.get(f"{API}/contactos/{pid}", timeout=15)
    assert r2.status_code == 200
    d = r2.json()
    assert d.get("iban") == payload["iban"]
    assert d.get("banco") == payload["banco"]
    assert d.get("swift") == payload["swift"]
    # cleanup
    requests.delete(f"{API}/contactos/{pid}", timeout=15)


def test_factura_recibida_persists_pdf(uploaded_pdf):
    # create proveedor
    prov = requests.post(f"{API}/contactos", json={"nombre": "TEST_ProvFR", "nif": "B88888888", "tipo": "proveedor"}, timeout=15).json()
    payload = {
        "contacto_id": prov["id"],
        "serie": "C",
        "lineas": [{"descripcion": "Item", "cantidad": 1, "precio": 10.0, "iva": 21}],
        "pdf_path": uploaded_pdf["pdf_path"],
        "pdf_filename": uploaded_pdf["pdf_filename"],
    }
    r = requests.post(f"{API}/facturas-recibidas", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    fr = r.json()
    assert fr.get("pdf_path") == uploaded_pdf["pdf_path"]
    assert fr.get("pdf_filename") == uploaded_pdf["pdf_filename"]


def test_albaran_compra_persists_pdf(uploaded_pdf):
    prov = requests.post(f"{API}/contactos", json={"nombre": "TEST_ProvAlb", "nif": "B77777777", "tipo": "proveedor"}, timeout=15).json()
    payload = {
        "tipo_operacion": "compra",
        "contacto_id": prov["id"],
        "contacto_nombre": "TEST_ProvAlb",
        "serie": "C",
        "lineas": [{"descripcion": "Item", "cantidad": 2, "precio": 5.0, "iva": 21}],
        "pdf_path": uploaded_pdf["pdf_path"],
        "pdf_filename": uploaded_pdf["pdf_filename"],
    }
    r = requests.post(f"{API}/albaranes", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("pdf_path") == uploaded_pdf["pdf_path"]
    assert d.get("pdf_filename") == uploaded_pdf["pdf_filename"]
