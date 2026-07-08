"""Iteration 3: nuevos cambios (referencia auto, código proveedor/barras, auto-create cliente)."""
import os, uuid, pytest, requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"


@pytest.fixture
def s():
    return requests.Session()


# ---------- Artículos: referencia automática ----------
def test_articulo_referencia_auto(s):
    nombre = f"TEST_Art_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/articulos", json={"nombre": nombre, "codigo_proveedor": "CP-XYZ", "codigo_barras": "8412345678901"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["nombre"] == nombre
    assert d.get("referencia", "").startswith("ART-"), f"referencia={d.get('referencia')}"
    assert len(d["referencia"]) == 10  # ART-000123
    assert d["codigo_proveedor"] == "CP-XYZ"
    assert d["codigo_barras"] == "8412345678901"
    # GET
    lst = s.get(f"{API}/articulos").json()
    found = next((x for x in lst if x["id"] == d["id"]), None)
    assert found and found["referencia"] == d["referencia"]
    # cleanup
    s.delete(f"{API}/articulos/{d['id']}")


def test_articulo_referencia_ignora_input(s):
    """Aunque se envíe referencia en el payload, el backend debe generar la suya."""
    r = s.post(f"{API}/articulos", json={"nombre": f"TEST_Art_{uuid.uuid4().hex[:6]}", "referencia": "HACK-001"})
    assert r.status_code == 200
    d = r.json()
    assert d["referencia"] != "HACK-001"
    assert d["referencia"].startswith("ART-")
    s.delete(f"{API}/articulos/{d['id']}")


# ---------- Factura emitida: auto-create cliente ----------
def test_factura_emitida_autocrea_cliente(s):
    nombre_cli = f"TEST_Cli_{uuid.uuid4().hex[:6]}"
    nif = f"B{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "serie": "A",
        "cliente_id": "",
        "cliente_nombre": nombre_cli,
        "cliente_nif": nif,
        "lineas": [{"descripcion": "Servicio test", "cantidad": 1, "precio_unitario": 100, "tipo_iva": 21}],
    }
    r = s.post(f"{API}/facturas-emitidas", json=payload)
    assert r.status_code == 200, r.text
    f = r.json()
    assert f["cliente_nombre"] == nombre_cli
    assert f["cliente_id"], "cliente_id debe estar asignado tras autocreación"
    # verificar en /contactos
    clientes = s.get(f"{API}/contactos?tipo=cliente").json()
    cli = next((c for c in clientes if c["id"] == f["cliente_id"]), None)
    assert cli, "cliente no encontrado en /contactos"
    assert cli["nombre"] == nombre_cli
    assert cli["nif"] == nif
    # cleanup
    s.delete(f"{API}/facturas-emitidas/{f['id']}")
    s.delete(f"{API}/contactos/{cli['id']}")


# ---------- Pedidos venta: auto-create cliente ----------
@pytest.mark.parametrize("entidad", ["pedidos", "albaranes"])
def test_documento_venta_autocrea_cliente(s, entidad):
    nombre = f"TEST_CliDoc_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/{entidad}", json={
        "tipo_operacion": "venta",
        "contacto_id": "",
        "contacto_nombre": nombre,
        "contacto_nif": "",
        "lineas": [{"codigo_proveedor": "CPX1", "descripcion": "Item", "cantidad": 2, "precio_unitario": 50, "tipo_iva": 21}],
    })
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["contacto_id"], f"{entidad}: contacto_id debe autocrear"
    assert d["lineas"][0]["codigo_proveedor"] == "CPX1"
    # cleanup
    s.delete(f"{API}/{entidad}/{d['id']}")
    s.delete(f"{API}/contactos/{d['contacto_id']}")


# ---------- Cliente: campos bancarios y entrega ----------
def test_cliente_iban_entrega(s):
    payload = {
        "tipo": "cliente",
        "nombre": f"TEST_Bank_{uuid.uuid4().hex[:6]}",
        "iban": "ES9121000418450200051332",
        "banco": "CaixaBank",
        "swift": "CAIXESBB",
        "direccion_entrega": "C/ Envío 1",
        "ciudad_entrega": "Madrid",
        "cp_entrega": "28001",
    }
    r = s.post(f"{API}/contactos", json=payload)
    assert r.status_code == 200
    c = r.json()
    for k in ["iban", "banco", "swift", "direccion_entrega", "ciudad_entrega", "cp_entrega"]:
        assert c[k] == payload[k], f"{k} no persistido"
    # GET
    g = s.get(f"{API}/contactos/{c['id']}").json()
    assert g["iban"] == payload["iban"]
    s.delete(f"{API}/contactos/{c['id']}")


# ---------- Licencia sigue activa ----------
def test_licencia_activa(s):
    r = s.get(f"{API}/licencia/verificar/NEXO-DEMO-0001")
    assert r.status_code == 200
    d = r.json()
    assert d["valida"] is True and d["estado"] == "activa"
