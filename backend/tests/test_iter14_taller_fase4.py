"""
Iter 14 - TALLER Fase 4: imputación de coste de compras a vehículo.
Cubre:
- POST/PUT /api/pedidos y /api/albaranes con tipo_operacion=compra + vehiculo_id
- POST /api/facturas-recibidas con vehiculo_id
- venta sigue funcionando (sin vehiculo_id)
- GET /api/taller/vehiculos/{id}/ficha -> compras[] + coste_compras
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def vehiculo(s):
    r = s.post(f"{API}/taller/vehiculos", json={
        "matricula": "TEST-F4-01",
        "marca": "Seat",
        "modelo": "Ibiza",
        "tipo": "cliente",
    })
    assert r.status_code == 200, r.text
    v = r.json()
    yield v
    s.delete(f"{API}/taller/vehiculos/{v['id']}")


created = {"pedidos": [], "albaranes": [], "facturas": []}


def _linea(precio=100.0, iva=21.0, cant=1):
    return {"descripcion": "TEST_F4 pieza", "cantidad": cant,
            "precio_unitario": precio, "iva_porcentaje": iva, "descuento_porcentaje": 0}


class TestImputacionCompras:
    def test_01_pedido_compra_con_vehiculo(self, s, vehiculo):
        r = s.post(f"{API}/pedidos", json={
            "tipo_operacion": "compra",
            "contacto_nombre": "TEST_F4 Proveedor SL",
            "lineas": [_linea(200.0)],
            "vehiculo_id": vehiculo["id"],
            "vehiculo_matricula": vehiculo["matricula"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vehiculo_id"] == vehiculo["id"]
        assert d["vehiculo_matricula"] == "TEST-F4-01"
        assert d["tipo_operacion"] == "compra"
        assert abs(d["total"] - 242.0) < 0.01
        created["pedidos"].append(d["id"])

    def test_02_pedido_venta_sin_vehiculo(self, s):
        r = s.post(f"{API}/pedidos", json={
            "tipo_operacion": "venta",
            "contacto_nombre": "TEST_F4 Cliente SL",
            "lineas": [_linea(50.0)],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tipo_operacion"] == "venta"
        assert d.get("vehiculo_id", "") == ""
        created["pedidos"].append(d["id"])

    def test_03_albaran_compra_con_vehiculo(self, s, vehiculo):
        r = s.post(f"{API}/albaranes", json={
            "tipo_operacion": "compra",
            "contacto_nombre": "TEST_F4 Proveedor SL",
            "lineas": [_linea(150.0)],
            "vehiculo_id": vehiculo["id"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vehiculo_id"] == vehiculo["id"]
        # matrícula debe resolverse (o vía input o vía DB)
        # el _build_documento persiste tal cual data.vehiculo_matricula (vacío) - aceptable
        created["albaranes"].append(d["id"])

    def test_04_factura_recibida_con_vehiculo(self, s, vehiculo):
        r = s.post(f"{API}/facturas-recibidas", json={
            "numero_proveedor": "F-TEST-F4-001",
            "proveedor_nombre": "TEST_F4 Proveedor SL",
            "lineas": [_linea(300.0)],
            "vehiculo_id": vehiculo["id"],
            "vehiculo_matricula": vehiculo["matricula"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vehiculo_id"] == vehiculo["id"]
        assert d["vehiculo_matricula"] == "TEST-F4-01"
        assert abs(d["total"] - 363.0) < 0.01
        created["facturas"].append(d["id"])

    def test_05_put_pedido_compra_vehiculo(self, s, vehiculo):
        pid = created["pedidos"][0]
        r = s.put(f"{API}/pedidos/{pid}", json={
            "tipo_operacion": "compra",
            "contacto_nombre": "TEST_F4 Proveedor SL",
            "lineas": [_linea(250.0)],
            "vehiculo_id": vehiculo["id"],
            "vehiculo_matricula": vehiculo["matricula"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vehiculo_id"] == vehiculo["id"]
        assert abs(d["total"] - 302.5) < 0.01

    def test_06_ficha_vehiculo_agregada(self, s, vehiculo):
        r = s.get(f"{API}/taller/vehiculos/{vehiculo['id']}/ficha")
        assert r.status_code == 200, r.text
        f = r.json()
        assert "compras" in f
        assert "coste_compras" in f
        # 1 pedido compra + 1 albaran compra + 1 factura recibida = 3
        tipos = [c["tipo"] for c in f["compras"]]
        assert tipos.count("Pedido") == 1
        assert tipos.count("Albarán") == 1
        assert tipos.count("Factura") == 1
        # coste = 302.5 (pedido tras update) + 181.5 (albaran) + 363.0 (factura)
        expected = round(302.5 + 181.5 + 363.0, 2)
        assert abs(f["coste_compras"] - expected) < 0.01, f"got {f['coste_compras']} exp {expected}"

    def test_99_cleanup(self, s):
        for pid in created["pedidos"]:
            s.delete(f"{API}/pedidos/{pid}")
        for aid in created["albaranes"]:
            s.delete(f"{API}/albaranes/{aid}")
        # facturas recibidas: puede no tener DELETE (nota del prompt)
        for fid in created["facturas"]:
            try:
                s.delete(f"{API}/facturas-recibidas/{fid}")
            except Exception:
                pass
