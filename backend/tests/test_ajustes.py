"""Backend tests for Ajustes (settings) endpoints and series-driven document numbering."""
import os
import re
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


class TestAjustes:
    def test_get_ajustes_shape(self, s):
        r = s.get(f"{API}/ajustes")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "empresa" in d
        assert "series_venta" in d and isinstance(d["series_venta"], list)
        assert "series_compra" in d and isinstance(d["series_compra"], list)
        # sales series must include facturas / pedidos / albaranes counters
        for sv in d["series_venta"]:
            assert "nombre" in sv and "contadores" in sv
            for k in ("facturas", "pedidos", "albaranes"):
                assert k in sv["contadores"]
        for sc in d["series_compra"]:
            assert "nombre" in sc and "contadores" in sc
            for k in ("pedidos", "albaranes"):
                assert k in sc["contadores"]

    def test_put_ajustes_persists(self, s):
        current = s.get(f"{API}/ajustes").json()
        payload = {
            "empresa": {
                "nombre": "TEST_Empresa SL",
                "nif": "B99009900",
                "direccion": "Calle Test 1",
                "cp": "28001",
                "ciudad": "Madrid",
                "provincia": "Madrid",
                "pais": "ES",
                "email": "test@nexopro.com",
                "telefono": "600000000",
            },
            "series_venta": current["series_venta"],
            "series_compra": current["series_compra"],
        }
        r = s.put(f"{API}/ajustes", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["empresa"]["nombre"] == "TEST_Empresa SL"
        assert d["empresa"]["nif"] == "B99009900"
        # verify persistence
        d2 = s.get(f"{API}/ajustes").json()
        assert d2["empresa"]["nombre"] == "TEST_Empresa SL"

    def test_add_and_delete_serie(self, s):
        current = s.get(f"{API}/ajustes").json()
        sv = list(current["series_venta"])
        sv.append({
            "nombre": "TSTV",
            "por_defecto": False,
            "contadores": {"facturas": 100, "pedidos": 100, "albaranes": 100},
        })
        r = s.put(f"{API}/ajustes", json={
            "empresa": current["empresa"], "series_venta": sv,
            "series_compra": current["series_compra"],
        })
        assert r.status_code == 200
        saved = r.json()
        names = [x["nombre"] for x in saved["series_venta"]]
        assert "TSTV" in names
        tstv = next(x for x in saved["series_venta"] if x["nombre"] == "TSTV")
        assert tstv["contadores"]["facturas"] == 100

        # remove it
        sv2 = [x for x in saved["series_venta"] if x["nombre"] != "TSTV"]
        r = s.put(f"{API}/ajustes", json={
            "empresa": saved["empresa"], "series_venta": sv2,
            "series_compra": saved["series_compra"],
        })
        assert r.status_code == 200
        names = [x["nombre"] for x in r.json()["series_venta"]]
        assert "TSTV" not in names


class TestNumeracionPorSerie:
    def test_factura_usa_contador_serie(self, s):
        # ensure serie 'TSTF' with counter 500
        current = s.get(f"{API}/ajustes").json()
        sv = [x for x in current["series_venta"] if x["nombre"] != "TSTF"]
        sv.append({
            "nombre": "TSTF", "por_defecto": False,
            "contadores": {"facturas": 500, "pedidos": 500, "albaranes": 500},
        })
        s.put(f"{API}/ajustes", json={
            "empresa": current["empresa"], "series_venta": sv,
            "series_compra": current["series_compra"],
        })
        # create factura using serie TSTF
        r = s.post(f"{API}/facturas-emitidas", json={
            "serie": "TSTF",
            "cliente_nombre": "TEST_Cli_serie", "cliente_nif": "B77777777",
            "lineas": [{"descripcion": "S", "cantidad": 1, "precio_unitario": 10,
                        "descuento": 0, "tipo_iva": 21}],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        # numero_completo should embed the serie name and the counter value 500
        assert "500" in d["numero_completo"], d["numero_completo"]
        assert d["numero_completo"].startswith("TSTF")
        fac_id = d["id"]

        # verify counter incremented to 501
        after = s.get(f"{API}/ajustes").json()
        tstf = next(x for x in after["series_venta"] if x["nombre"] == "TSTF")
        assert tstf["contadores"]["facturas"] == 501

        # cleanup
        s.delete(f"{API}/facturas-emitidas/{fac_id}")
        # remove serie
        sv3 = [x for x in after["series_venta"] if x["nombre"] != "TSTF"]
        s.put(f"{API}/ajustes", json={
            "empresa": after["empresa"], "series_venta": sv3,
            "series_compra": after["series_compra"],
        })

    def test_pedido_venta_y_compra_serie(self, s):
        current = s.get(f"{API}/ajustes").json()
        # add sales serie TSTPV and purchase serie TSTPC
        sv = [x for x in current["series_venta"] if x["nombre"] != "TSTPV"]
        sv.append({"nombre": "TSTPV", "por_defecto": False,
                   "contadores": {"facturas": 1, "pedidos": 200, "albaranes": 1}})
        sc = [x for x in current["series_compra"] if x["nombre"] != "TSTPC"]
        sc.append({"nombre": "TSTPC", "por_defecto": False,
                   "contadores": {"pedidos": 300, "albaranes": 1}})
        s.put(f"{API}/ajustes", json={
            "empresa": current["empresa"], "series_venta": sv, "series_compra": sc,
        })

        # sales pedido
        r = s.post(f"{API}/pedidos", json={
            "tipo_operacion": "venta", "serie": "TSTPV",
            "contacto_nombre": "X", "contacto_nif": "",
            "lineas": [{"descripcion": "L", "cantidad": 1, "precio_unitario": 10,
                        "descuento": 0, "tipo_iva": 21}],
        })
        assert r.status_code == 200, r.text
        dv = r.json()
        assert "200" in dv["numero"] and "TSTPV" in dv["numero"], dv["numero"]

        # purchase pedido
        r = s.post(f"{API}/pedidos", json={
            "tipo_operacion": "compra", "serie": "TSTPC",
            "contacto_nombre": "Y", "contacto_nif": "",
            "lineas": [{"descripcion": "L", "cantidad": 1, "precio_unitario": 10,
                        "descuento": 0, "tipo_iva": 21}],
        })
        assert r.status_code == 200, r.text
        dc = r.json()
        assert "300" in dc["numero"] and "TSTPC" in dc["numero"], dc["numero"]

        # verify counters incremented
        after = s.get(f"{API}/ajustes").json()
        tstpv = next(x for x in after["series_venta"] if x["nombre"] == "TSTPV")
        tstpc = next(x for x in after["series_compra"] if x["nombre"] == "TSTPC")
        assert tstpv["contadores"]["pedidos"] == 201
        assert tstpc["contadores"]["pedidos"] == 301

        # cleanup
        s.delete(f"{API}/pedidos/{dv['id']}")
        s.delete(f"{API}/pedidos/{dc['id']}")
        sv2 = [x for x in after["series_venta"] if x["nombre"] != "TSTPV"]
        sc2 = [x for x in after["series_compra"] if x["nombre"] != "TSTPC"]
        s.put(f"{API}/ajustes", json={
            "empresa": after["empresa"], "series_venta": sv2, "series_compra": sc2,
        })
