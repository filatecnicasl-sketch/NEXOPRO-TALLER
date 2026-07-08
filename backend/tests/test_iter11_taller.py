"""Backend tests for TALLER module (Fase 1): Vehículos + Órdenes de trabajo."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://invoice-hub-861.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def contacto_id(client):
    # Create a contacto to use as cliente
    payload = {"nombre": "TEST_ClienteTaller", "tipo": "cliente", "email": "test_taller@example.com"}
    r = client.post(f"{API}/contactos", json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def created(client, contacto_id):
    state = {"contacto_id": contacto_id, "vehiculo_ids": [], "orden_ids": []}
    yield state
    # cleanup
    for oid in state["orden_ids"]:
        client.delete(f"{API}/taller/ordenes/{oid}")
    for vid in state["vehiculo_ids"]:
        client.delete(f"{API}/taller/vehiculos/{vid}")
    client.delete(f"{API}/contactos/{contacto_id}")


class TestVehiculos:
    def test_crear_vehiculo_matricula_uppercase_y_cliente(self, client, created):
        payload = {
            "matricula": "abc1234",
            "marca": "Seat",
            "modelo": "Ibiza",
            "cliente_id": created["contacto_id"],
            "tipo": "cliente",
        }
        r = client.post(f"{API}/taller/vehiculos", json=payload)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["matricula"] == "ABC1234"
        assert v["cliente_nombre"] == "TEST_ClienteTaller"
        assert v["id"]
        created["vehiculo_ids"].append(v["id"])

    def test_get_vehiculo(self, client, created):
        vid = created["vehiculo_ids"][0]
        r = client.get(f"{API}/taller/vehiculos/{vid}")
        assert r.status_code == 200
        assert r.json()["matricula"] == "ABC1234"

    def test_listar_vehiculos(self, client, created):
        r = client.get(f"{API}/taller/vehiculos")
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert created["vehiculo_ids"][0] in ids

    def test_actualizar_vehiculo(self, client, created):
        vid = created["vehiculo_ids"][0]
        payload = {"matricula": "xyz9999", "marca": "Seat", "modelo": "Leon", "cliente_id": created["contacto_id"], "tipo": "cliente"}
        r = client.put(f"{API}/taller/vehiculos/{vid}", json=payload)
        assert r.status_code == 200
        assert r.json()["matricula"] == "XYZ9999"
        assert r.json()["modelo"] == "Leon"

    def test_ficha_vehiculo(self, client, created):
        vid = created["vehiculo_ids"][0]
        r = client.get(f"{API}/taller/vehiculos/{vid}/ficha")
        assert r.status_code == 200
        data = r.json()
        assert "vehiculo" in data and "ordenes" in data
        assert data["vehiculo"]["id"] == vid
        assert isinstance(data["ordenes"], list)


class TestOrdenes:
    def test_crear_orden_autonumeracion_y_totales(self, client, created):
        vid = created["vehiculo_ids"][0]
        payload = {
            "vehiculo_id": vid,
            "tipos_trabajo": ["chapa", "pintura"],
            "descripcion": "TEST_Reparacion",
            "lineas": [
                {"descripcion": "Mano de obra", "cantidad": 3, "precio_unitario": 45, "tipo_iva": 21}
            ],
        }
        r = client.post(f"{API}/taller/ordenes", json=payload)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["numero"].startswith("OT-") and len(o["numero"]) == 9
        assert o["vehiculo_matricula"] == "XYZ9999"
        assert o["cliente_id"] == created["contacto_id"]
        assert o["cliente_nombre"] == "TEST_ClienteTaller"
        assert abs(o["base"] - 135.0) < 0.01
        assert abs(o["cuota_iva"] - 28.35) < 0.01
        assert abs(o["total"] - 163.35) < 0.01
        created["orden_ids"].append(o["id"])

    def test_autonumeracion_incremental(self, client, created):
        vid = created["vehiculo_ids"][0]
        r1 = client.post(f"{API}/taller/ordenes", json={"vehiculo_id": vid, "lineas": []})
        assert r1.status_code == 200
        n1 = int(r1.json()["numero"].split("-")[1])
        r2 = client.post(f"{API}/taller/ordenes", json={"vehiculo_id": vid, "lineas": []})
        assert r2.status_code == 200
        n2 = int(r2.json()["numero"].split("-")[1])
        assert n2 == n1 + 1
        created["orden_ids"].extend([r1.json()["id"], r2.json()["id"]])

    def test_get_y_listar_ordenes(self, client, created):
        oid = created["orden_ids"][0]
        r = client.get(f"{API}/taller/ordenes/{oid}")
        assert r.status_code == 200
        r2 = client.get(f"{API}/taller/ordenes", params={"vehiculo_id": created["vehiculo_ids"][0]})
        assert r2.status_code == 200
        assert any(o["id"] == oid for o in r2.json())

    def test_patch_estado_valido(self, client, created):
        oid = created["orden_ids"][0]
        r = client.patch(f"{API}/taller/ordenes/{oid}/estado", data={"estado": "en_curso"},
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 200, r.text
        assert r.json()["estado"] == "en_curso"

    def test_patch_estado_invalido(self, client, created):
        oid = created["orden_ids"][0]
        r = client.patch(f"{API}/taller/ordenes/{oid}/estado", data={"estado": "bogus"},
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert r.status_code == 400

    def test_actualizar_orden_preserva_numero(self, client, created):
        oid = created["orden_ids"][0]
        num_orig = client.get(f"{API}/taller/ordenes/{oid}").json()["numero"]
        payload = {"vehiculo_id": created["vehiculo_ids"][0], "descripcion": "TEST_updated", "lineas": []}
        r = client.put(f"{API}/taller/ordenes/{oid}", json=payload)
        assert r.status_code == 200
        assert r.json()["numero"] == num_orig
        assert r.json()["descripcion"] == "TEST_updated"

    def test_ficha_incluye_ordenes(self, client, created):
        vid = created["vehiculo_ids"][0]
        r = client.get(f"{API}/taller/vehiculos/{vid}/ficha")
        assert r.status_code == 200
        oids = [o["id"] for o in r.json()["ordenes"]]
        assert created["orden_ids"][0] in oids

    def test_eliminar_orden(self, client, created):
        oid = created["orden_ids"].pop()
        r = client.delete(f"{API}/taller/ordenes/{oid}")
        assert r.status_code == 200
        r2 = client.get(f"{API}/taller/ordenes/{oid}")
        assert r2.status_code == 404


class TestVehiculoDelete:
    def test_eliminar_vehiculo(self, client, created):
        # create + delete a throwaway vehiculo
        r = client.post(f"{API}/taller/vehiculos", json={"matricula": "del1111", "marca": "T"})
        vid = r.json()["id"]
        r2 = client.delete(f"{API}/taller/vehiculos/{vid}")
        assert r2.status_code == 200
        r3 = client.get(f"{API}/taller/vehiculos/{vid}")
        assert r3.status_code == 404
