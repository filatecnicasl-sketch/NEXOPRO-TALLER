"""Backend API tests for Spanish ERP - each class self-contained (loadscope-safe)."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _mk_cliente(s, nombre="TEST_Cli", nif="B11111111"):
    r = s.post(f"{API}/contactos", json={"tipo": "cliente", "nombre": nombre, "nif": nif})
    assert r.status_code == 200
    return r.json()


def _mk_proveedor(s, nombre="TEST_Prov", nif="B22222222"):
    r = s.post(f"{API}/contactos", json={"tipo": "proveedor", "nombre": nombre, "nif": nif})
    assert r.status_code == 200
    return r.json()


# -------------------- Contactos CRUD --------------------
class TestContactos:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200 and r.json().get("status") == "ok"

    def test_full_crud(self, s):
        c = _mk_cliente(s, "TEST_Cliente_CRUD", "B10101010")
        cid = c["id"]
        assert c["tipo"] == "cliente"
        # list filter
        lst = s.get(f"{API}/contactos?tipo=cliente").json()
        assert any(x["id"] == cid for x in lst) and all(x["tipo"] == "cliente" for x in lst)
        # get
        assert s.get(f"{API}/contactos/{cid}").status_code == 200
        # update
        r = s.put(f"{API}/contactos/{cid}", json={"tipo": "cliente", "nombre": "TEST_Cli_upd", "nif": "B10101010"})
        assert r.status_code == 200 and r.json()["nombre"] == "TEST_Cli_upd"
        assert s.get(f"{API}/contactos/{cid}").json()["nombre"] == "TEST_Cli_upd"
        # 404 unknown
        assert s.get(f"{API}/contactos/nope-xyz").status_code == 404
        # delete
        assert s.delete(f"{API}/contactos/{cid}").status_code == 200
        assert s.get(f"{API}/contactos/{cid}").status_code == 404


# -------------------- Pedidos --------------------
class TestPedidos:
    def test_pedidos_flow(self, s):
        cli = _mk_cliente(s, "TEST_Cli_Pedido", "B30303030")
        try:
            payload = {
                "tipo_operacion": "venta", "contacto_id": cli["id"],
                "contacto_nombre": cli["nombre"], "contacto_nif": cli["nif"],
                "lineas": [
                    {"descripcion": "P1", "cantidad": 2, "precio_unitario": 100, "descuento": 0, "tipo_iva": 21},
                    {"descripcion": "P2", "cantidad": 1, "precio_unitario": 50, "descuento": 10, "tipo_iva": 21},
                ],
            }
            r = s.post(f"{API}/pedidos", json=payload)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["base_total"] == 245.0
            assert d["iva_total"] == 51.45
            assert d["total"] == 296.45
            assert d["numero"].startswith("PED-")
            pid = d["id"]
            # update
            r = s.put(f"{API}/pedidos/{pid}", json={
                "tipo_operacion": "venta", "contacto_id": "", "contacto_nombre": "X", "contacto_nif": "",
                "lineas": [{"descripcion": "X", "cantidad": 1, "precio_unitario": 10, "descuento": 0, "tipo_iva": 21}],
            })
            assert r.status_code == 200 and r.json()["total"] == 12.1
            # list
            assert isinstance(s.get(f"{API}/pedidos").json(), list)
            # delete
            assert s.delete(f"{API}/pedidos/{pid}").status_code == 200
        finally:
            s.delete(f"{API}/contactos/{cli['id']}")


# -------------------- Albaranes --------------------
class TestAlbaranes:
    def test_albaran_flow(self, s):
        r = s.post(f"{API}/albaranes", json={
            "tipo_operacion": "venta", "contacto_id": "", "contacto_nombre": "T", "contacto_nif": "",
            "lineas": [{"descripcion": "A", "cantidad": 3, "precio_unitario": 10, "descuento": 0, "tipo_iva": 10}],
        })
        assert r.status_code == 200
        d = r.json()
        assert d["numero"].startswith("ALB-")
        assert d["base_total"] == 30.0 and d["iva_total"] == 3.0 and d["total"] == 33.0
        assert s.delete(f"{API}/albaranes/{d['id']}").status_code == 200


# -------------------- Facturas Emitidas / Verifactu --------------------
class TestFacturasEmitidas:
    def test_factura_emitida_flow(self, s):
        cli = _mk_cliente(s, "TEST_Cli_Fac", "B40404040")
        try:
            r = s.post(f"{API}/facturas-emitidas", json={
                "serie": "A",
                "cliente_id": cli["id"], "cliente_nombre": cli["nombre"], "cliente_nif": cli["nif"],
                "lineas": [{"descripcion": "Serv", "cantidad": 1, "precio_unitario": 1000, "descuento": 0, "tipo_iva": 21}],
            })
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["total"] == 1210.0
            assert d["numero_completo"].startswith("A")
            vf = d["verifactu"]
            assert len(vf["huella"]) == 64
            assert vf["qr_data"].startswith("https://")
            first_id = d["id"]
            first_huella = vf["huella"]

            # chained huella
            r2 = s.post(f"{API}/facturas-emitidas", json={
                "serie": "A", "cliente_nombre": "X", "cliente_nif": "B99999999",
                "lineas": [{"descripcion": "S", "cantidad": 1, "precio_unitario": 10, "descuento": 0, "tipo_iva": 21}],
            })
            assert r2.status_code == 200
            assert r2.json()["verifactu"]["huella_anterior"] == first_huella
            s.delete(f"{API}/facturas-emitidas/{r2.json()['id']}")

            # toggle estado
            r = s.patch(f"{API}/facturas-emitidas/{first_id}/estado", data={"estado": "cobrada"},
                        headers={"Content-Type": "application/x-www-form-urlencoded"})
            assert r.status_code == 200 and r.json()["estado"] == "cobrada"

            # get
            assert s.get(f"{API}/facturas-emitidas/{first_id}").status_code == 200
            # list
            assert isinstance(s.get(f"{API}/facturas-emitidas").json(), list)
            # delete
            assert s.delete(f"{API}/facturas-emitidas/{first_id}").status_code == 200
        finally:
            s.delete(f"{API}/contactos/{cli['id']}")


# -------------------- Facturas Recibidas --------------------
class TestFacturasRecibidas:
    def test_factura_recibida_flow(self, s):
        prov = _mk_proveedor(s, "TEST_Prov_R", "B50505050")
        try:
            r = s.post(f"{API}/facturas-recibidas", json={
                "numero_proveedor": "F-001", "proveedor_id": prov["id"],
                "proveedor_nombre": prov["nombre"], "proveedor_nif": prov["nif"],
                "lineas": [{"descripcion": "M", "cantidad": 2, "precio_unitario": 50, "descuento": 0, "tipo_iva": 21}],
            })
            assert r.status_code == 200
            d = r.json()
            assert d["total"] == 121.0 and d["estado"] == "pendiente"
            fid = d["id"]

            r = s.patch(f"{API}/facturas-recibidas/{fid}/estado", data={"estado": "pagada"},
                        headers={"Content-Type": "application/x-www-form-urlencoded"})
            assert r.status_code == 200 and r.json()["estado"] == "pagada"

            assert isinstance(s.get(f"{API}/facturas-recibidas").json(), list)
            assert s.delete(f"{API}/facturas-recibidas/{fid}").status_code == 200
        finally:
            s.delete(f"{API}/contactos/{prov['id']}")


# -------------------- Dashboard --------------------
class TestDashboard:
    def test_resumen_structure(self, s):
        # create minimal data
        cli = _mk_cliente(s, "TEST_Cli_Dash", "B60606060")
        try:
            fac = s.post(f"{API}/facturas-emitidas", json={
                "serie": "Z", "cliente_nombre": cli["nombre"], "cliente_nif": cli["nif"],
                "lineas": [{"descripcion": "X", "cantidad": 1, "precio_unitario": 500, "descuento": 0, "tipo_iva": 21}],
            }).json()
            r = s.get(f"{API}/dashboard/resumen")
            assert r.status_code == 200
            d = r.json()
            for k in ("clientes", "proveedores", "pedidos", "albaranes",
                      "total_facturado", "pendiente_cobro", "total_gastos", "pendiente_pago",
                      "grafico_facturacion", "ultimas_emitidas", "ultimas_recibidas"):
                assert k in d, f"missing {k}"
            assert d["total_facturado"] >= 605.0
            assert isinstance(d["grafico_facturacion"], list)
            s.delete(f"{API}/facturas-emitidas/{fac['id']}")
        finally:
            s.delete(f"{API}/contactos/{cli['id']}")


# -------------------- Extraccion PDF (expected budget-exceeded) --------------------
class TestExtraccion:
    def test_endpoint_exists(self, s):
        # send small dummy file - expect either 500 (budget) or 422/500 - just verify endpoint is registered (not 404/405)
        files = {"file": ("test.pdf", b"%PDF-1.4 dummy", "application/pdf")}
        r = requests.post(f"{API}/extraccion/pdf", files=files)
        assert r.status_code != 404 and r.status_code != 405, f"endpoint missing: {r.status_code}"
