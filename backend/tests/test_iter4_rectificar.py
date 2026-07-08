"""Iteration 4: unidad+cantidad, forma_pago, rectificar, serie en venta, delete removidos."""
import os, uuid, pytest, requests

with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"


@pytest.fixture
def s():
    return requests.Session()


# --- 1. Línea con cantidad + unidad + forma_pago en factura emitida ---
def test_factura_emitida_unidad_cantidad_forma_pago(s):
    payload = {
        "serie": "A",
        "cliente_nombre": f"TEST_FE_{uuid.uuid4().hex[:5]}",
        "cliente_nif": "B12345678",
        "forma_pago": "Tarjeta",
        "lineas": [{"descripcion": "Suelo", "cantidad": 3, "unidad": "m2",
                    "precio_unitario": 25, "tipo_iva": 21}],
    }
    r = s.post(f"{API}/facturas-emitidas", json=payload); assert r.status_code == 200, r.text
    f = r.json()
    assert f["forma_pago"] == "Tarjeta"
    l = f["lineas"][0]
    assert l["cantidad"] == 3 and l["unidad"] == "m2"
    # totals: 3*25=75, IVA 21%=15.75, total=90.75
    assert abs(f["base_total"] - 75) < 0.01
    assert abs(f["iva_total"] - 15.75) < 0.01
    assert abs(f["total"] - 90.75) < 0.01
    # GET
    g = s.get(f"{API}/facturas-emitidas/{f['id']}").json()
    assert g["lineas"][0]["unidad"] == "m2" and g["lineas"][0]["cantidad"] == 3
    assert g["forma_pago"] == "Tarjeta"
    return f["id"], g.get("cliente_id")


# --- 2. Rectificar factura emitida ---
def test_rectificar_factura_emitida(s):
    # crear original
    r = s.post(f"{API}/facturas-emitidas", json={
        "serie": "A", "cliente_nombre": f"TEST_R_{uuid.uuid4().hex[:5]}",
        "cliente_nif": "B99999999", "forma_pago": "Transferencia",
        "lineas": [{"descripcion": "X", "cantidad": 1, "unidad": "ud",
                    "precio_unitario": 100, "tipo_iva": 21}],
    })
    assert r.status_code == 200
    orig = r.json()
    # rectificar
    rr = s.post(f"{API}/facturas-emitidas/{orig['id']}/rectificar")
    assert rr.status_code == 200, rr.text
    rect = rr.json()
    assert rect["tipo_factura"] == "rectificativa"
    assert rect["rectifica_a"] == orig["numero_completo"]
    assert rect["total"] < 0, f"total esperado negativo, got {rect['total']}"
    # rectificar de nuevo la rectificativa debe fallar
    r2 = s.post(f"{API}/facturas-emitidas/{rect['id']}/rectificar")
    assert r2.status_code == 400
    # original marcada como rectificada
    g = s.get(f"{API}/facturas-emitidas/{orig['id']}").json()
    assert g["estado"] == "rectificada" or g.get("rectificada") is True or g["tipo_factura"] == "rectificada", g


# --- 3. DELETE eliminado en facturas-emitidas y recibidas ---
def test_delete_facturas_removidos(s):
    # crear una y probar DELETE
    r = s.post(f"{API}/facturas-emitidas", json={
        "serie": "A", "cliente_nombre": f"TEST_D_{uuid.uuid4().hex[:5]}",
        "cliente_nif": "B00000001", "forma_pago": "Efectivo",
        "lineas": [{"descripcion": "Y", "cantidad": 1, "unidad": "ud",
                    "precio_unitario": 10, "tipo_iva": 21}],
    })
    fid = r.json()["id"]
    d = s.delete(f"{API}/facturas-emitidas/{fid}")
    assert d.status_code in (404, 405), f"DELETE debe 404/405 (got {d.status_code})"

    r2 = s.post(f"{API}/facturas-recibidas", json={
        "proveedor_nombre": f"TEST_P_{uuid.uuid4().hex[:5]}",
        "proveedor_nif": "B22222222", "forma_pago": "Transferencia",
        "numero_proveedor": f"F-{uuid.uuid4().hex[:4]}",
        "lineas": [{"descripcion": "Z", "cantidad": 1, "unidad": "ud",
                    "precio_unitario": 20, "tipo_iva": 21}],
    })
    assert r2.status_code == 200, r2.text
    fid2 = r2.json()["id"]
    d2 = s.delete(f"{API}/facturas-recibidas/{fid2}")
    assert d2.status_code in (404, 405)


# --- 4. Rectificar factura recibida ---
def test_rectificar_factura_recibida(s):
    r = s.post(f"{API}/facturas-recibidas", json={
        "proveedor_nombre": f"TEST_PR_{uuid.uuid4().hex[:5]}",
        "proveedor_nif": "B33333333", "forma_pago": "Transferencia",
        "numero_proveedor": f"F-{uuid.uuid4().hex[:4]}",
        "lineas": [{"descripcion": "Q", "cantidad": 2, "unidad": "kg",
                    "precio_unitario": 50, "tipo_iva": 21}],
    })
    assert r.status_code == 200
    orig = r.json()
    assert orig["lineas"][0]["unidad"] == "kg"
    assert orig["forma_pago"] == "Transferencia"
    rr = s.post(f"{API}/facturas-recibidas/{orig['id']}/rectificar")
    assert rr.status_code == 200, rr.text
    rect = rr.json()
    assert rect["tipo_factura"] == "rectificativa"
    assert rect["total"] < 0


# --- 5. Serie en albarán de venta ---
def test_albaran_venta_serie(s):
    r = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "venta",
        "serie": "B",
        "contacto_nombre": f"TEST_S_{uuid.uuid4().hex[:5]}",
        "lineas": [{"descripcion": "L", "cantidad": 1, "unidad": "ud",
                    "precio_unitario": 10, "tipo_iva": 21}],
    })
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["numero"].startswith("B-"), f"numero debe empezar por B-: {d['numero']}"
    # regression: compra sigue ALB-
    r2 = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "compra",
        "contacto_nombre": f"TEST_SC_{uuid.uuid4().hex[:5]}",
        "lineas": [{"descripcion": "L", "cantidad": 1, "unidad": "ud",
                    "precio_unitario": 10, "tipo_iva": 21}],
    })
    assert r2.status_code == 200
    assert r2.json()["numero"].startswith("ALB-")


# --- 6. Licencia sigue activa ---
def test_licencia_activa(s):
    r = s.get(f"{API}/licencia/verificar/NEXO-DEMO-0001")
    assert r.status_code == 200
    assert r.json()["estado"] == "activa"
