"""Iter 9: proveedor auto-alta on factura recibida, DIR3 fields on Cliente, Facturae 3.2.2 XML."""
import os
import re
import uuid
import xml.etree.ElementTree as ET

import pytest
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

UNIQ = uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- (1) Proveedor auto-alta on factura recibida ---
class TestProveedorAutoAlta:
    def test_factura_recibida_creates_proveedor(self, s):
        nombre = f"TEST_Iter9 AutoProv {UNIQ}"
        nif = f"B{UNIQ[:8].upper()}"
        payload = {
            "proveedor_nombre": nombre,
            "proveedor_nif": nif,
            "fecha": "2026-01-15",
            "lineas": [
                {"descripcion": "Servicio X", "cantidad": 1, "precio": 100.0, "iva": 21.0, "descuento": 0}
            ],
        }
        r = s.post(f"{API}/facturas-recibidas", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("proveedor_nombre") == nombre

        # verify appears in contactos?tipo=proveedor
        rc = s.get(f"{API}/contactos", params={"tipo": "proveedor"})
        assert rc.status_code == 200
        provs = rc.json()
        assert any(p.get("nombre") == nombre for p in provs), \
            f"Proveedor {nombre} not auto-created"


# --- (2) DIR3 fields on Cliente round-trip ---
class TestClienteDIR3:
    def test_cliente_es_publica_dir3_roundtrip(self, s):
        payload = {
            "tipo": "cliente",
            "nombre": f"TEST_Iter9 Publica {UNIQ}",
            "nif": f"P{UNIQ[:8].upper()}",
            "es_publica": True,
            "dir3_oficina_contable": "L01000001",
            "dir3_organo_gestor": "L01000002",
            "dir3_unidad_tramitadora": "L01000003",
        }
        r = s.post(f"{API}/contactos", json=payload)
        assert r.status_code in (200, 201), r.text
        c = r.json()
        assert c["es_publica"] is True
        assert c["dir3_oficina_contable"] == "L01000001"
        assert c["dir3_organo_gestor"] == "L01000002"
        assert c["dir3_unidad_tramitadora"] == "L01000003"
        cid = c["id"]

        # GET
        rg = s.get(f"{API}/contactos/{cid}")
        assert rg.status_code == 200
        g = rg.json()
        assert g["es_publica"] is True
        assert g["dir3_oficina_contable"] == "L01000001"

        # PUT update
        upd = dict(payload)
        upd["dir3_oficina_contable"] = "L01000099"
        rp = s.put(f"{API}/contactos/{cid}", json=upd)
        assert rp.status_code == 200
        rg2 = s.get(f"{API}/contactos/{cid}")
        assert rg2.json()["dir3_oficina_contable"] == "L01000099"


# --- (3) Facturae XML ---
class TestFacturaeXML:
    @pytest.fixture(scope="class")
    def publico_cliente_and_factura(self):
        sess = requests.Session()
        sess.headers.update({"Content-Type": "application/json"})
        # create publico cliente
        cli_payload = {
            "tipo": "cliente",
            "nombre": f"TEST_Iter9 AytoTest {UNIQ}",
            "nif": f"Q{UNIQ[:8].upper()}",
            "direccion": "Plaza Mayor 1",
            "codigo_postal": "28001",
            "ciudad": "Madrid",
            "es_publica": True,
            "dir3_oficina_contable": "L01280001",
            "dir3_organo_gestor": "L01280002",
            "dir3_unidad_tramitadora": "L01280003",
        }
        rc = sess.post(f"{API}/contactos", json=cli_payload)
        assert rc.status_code in (200, 201), rc.text
        cli = rc.json()

        # ensure empresa nif set in ajustes
        ra = sess.get(f"{API}/ajustes")
        aj = ra.json()
        emp = aj.get("empresa") or {}
        if not emp.get("nif"):
            emp["nif"] = "B00000000"
            emp["nombre"] = emp.get("nombre") or "Empresa Test"
            aj["empresa"] = emp
            sess.put(f"{API}/ajustes", json=aj)

        # create factura emitida directly linked to this cliente
        fpayload = {
            "cliente_id": cli["id"],
            "cliente_nombre": cli["nombre"],
            "cliente_nif": cli["nif"],
            "fecha": "2026-01-15",
            "lineas": [
                {"descripcion": "Consultoría", "cantidad": 2, "precio_unitario": 90.0, "tipo_iva": 21.0, "descuento": 0}
            ],
        }
        rf = sess.post(f"{API}/facturas-emitidas", json=fpayload)
        assert rf.status_code in (200, 201), rf.text
        fact = rf.json()
        return cli, fact

    def test_facturae_download(self, s, publico_cliente_and_factura):
        cli, fact = publico_cliente_and_factura
        r = s.get(f"{API}/facturas-emitidas/{fact['id']}/facturae")
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "xml" in ctype.lower(), f"content-type: {ctype}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and "filename" in cd.lower(), f"cd: {cd}"

        xml_text = r.text
        assert "<SchemaVersion>3.2.2</SchemaVersion>" in xml_text
        # both NIFs
        assert cli["nif"] in xml_text
        # AdministrativeCentres
        assert xml_text.count("<AdministrativeCentre>") == 3
        for role in ("01", "02", "03"):
            assert f"<RoleTypeCode>{role}</RoleTypeCode>" in xml_text
        # DIR3 codes present as CentreCode
        for code in (cli["dir3_oficina_contable"], cli["dir3_organo_gestor"], cli["dir3_unidad_tramitadora"]):
            assert f"<CentreCode>{code}</CentreCode>" in xml_text
        # InvoiceTotal ~ 217.80 (2*90=180 + 21% = 217.80)
        m = re.search(r"<InvoiceTotal>([\d.]+)</InvoiceTotal>", xml_text)
        assert m, "InvoiceTotal missing"
        assert abs(float(m.group(1)) - 217.80) < 0.02

        # well-formed XML
        try:
            ET.fromstring(xml_text)
        except ET.ParseError as e:
            pytest.fail(f"XML not well-formed: {e}")

    def test_facturae_nonpublic_no_centres(self, s):
        # a non-publico cliente factura should not have AdministrativeCentres
        cli_payload = {
            "tipo": "cliente",
            "nombre": f"TEST_Iter9 Priv {UNIQ}",
            "nif": f"R{UNIQ[:8].upper()}",
        }
        rc = s.post(f"{API}/contactos", json=cli_payload)
        cli = rc.json()
        fpayload = {
            "cliente_id": cli["id"],
            "cliente_nombre": cli["nombre"],
            "cliente_nif": cli["nif"],
            "fecha": "2026-01-15",
            "lineas": [{"descripcion": "X", "cantidad": 1, "precio": 10.0, "iva": 21.0, "descuento": 0}],
        }
        rf = s.post(f"{API}/facturas-emitidas", json=fpayload)
        fact = rf.json()
        r = s.get(f"{API}/facturas-emitidas/{fact['id']}/facturae")
        assert r.status_code == 200
        assert "<SchemaVersion>3.2.2</SchemaVersion>" in r.text
        assert "<AdministrativeCentre>" not in r.text
