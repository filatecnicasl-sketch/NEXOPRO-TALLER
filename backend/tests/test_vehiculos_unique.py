"""Tests for vehicle uniqueness by matricula + propietarios history + ficha keys."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-hub-861.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def cliente_ids(session):
    """Create two test clients to test propietario history."""
    ids = []
    for nombre in ["TEST_CliA_" + uuid.uuid4().hex[:6], "TEST_CliB_" + uuid.uuid4().hex[:6]]:
        r = session.post(f"{API}/contactos", json={"nombre": nombre, "tipo": "cliente"})
        assert r.status_code in (200, 201), r.text
        ids.append(r.json()["id"])
    yield ids
    for cid in ids:
        session.delete(f"{API}/contactos/{cid}")


@pytest.fixture(scope="module")
def created_vehiculos():
    """Track created vehicles to clean up at end."""
    ids = []
    yield ids
    s = requests.Session()
    for vid in ids:
        s.delete(f"{API}/taller/vehiculos/{vid}")


def _matricula():
    return "TST" + uuid.uuid4().hex[:4].upper()


def test_crear_vehiculo_unico(session, cliente_ids, created_vehiculos):
    mat = _matricula()
    r = session.post(f"{API}/taller/vehiculos", json={
        "matricula": mat, "marca": "Test", "modelo": "M1",
        "cliente_id": cliente_ids[0], "tipo": "cliente"
    })
    assert r.status_code == 200, r.text
    v = r.json()
    created_vehiculos.append(v["id"])
    assert v["matricula"] == mat.upper()
    assert isinstance(v.get("propietarios"), list)
    assert len(v["propietarios"]) == 1
    assert v["propietarios"][0]["cliente_id"] == cliente_ids[0]
    assert v["propietarios"][0]["hasta"] is None


def test_crear_vehiculo_duplicado_devuelve_409(session, created_vehiculos):
    mat = _matricula()
    r1 = session.post(f"{API}/taller/vehiculos", json={"matricula": mat, "marca": "X"})
    assert r1.status_code == 200
    created_vehiculos.append(r1.json()["id"])
    r2 = session.post(f"{API}/taller/vehiculos", json={"matricula": mat, "marca": "Y"})
    assert r2.status_code == 409, r2.text
    detail = r2.json().get("detail", "")
    assert "Ya existe un vehículo con la matrícula" in detail
    assert mat.upper() in detail


def test_editar_vehiculo_cambio_propietario_no_duplica(session, cliente_ids, created_vehiculos):
    mat = _matricula()
    r = session.post(f"{API}/taller/vehiculos", json={
        "matricula": mat, "marca": "V", "cliente_id": cliente_ids[0]
    })
    assert r.status_code == 200
    v = r.json()
    vid = v["id"]
    created_vehiculos.append(vid)

    # Update: change cliente
    r2 = session.put(f"{API}/taller/vehiculos/{vid}", json={
        "matricula": mat, "marca": "V", "cliente_id": cliente_ids[1]
    })
    assert r2.status_code == 200, r2.text
    upd = r2.json()
    assert upd["id"] == vid  # same id, no duplicate
    props = upd.get("propietarios") or []
    assert len(props) == 2
    assert props[0]["cliente_id"] == cliente_ids[0]
    assert props[0]["hasta"] is not None
    assert props[1]["cliente_id"] == cliente_ids[1]
    assert props[1]["hasta"] is None

    # No duplicate row in listing
    lst = session.get(f"{API}/taller/vehiculos", params={"q": mat}).json()
    mats = [x for x in lst if x.get("matricula") == mat.upper()]
    assert len(mats) == 1


def test_editar_sin_cambiar_matricula_no_da_duplicado(session, created_vehiculos):
    mat = _matricula()
    r = session.post(f"{API}/taller/vehiculos", json={"matricula": mat, "marca": "A"})
    assert r.status_code == 200
    vid = r.json()["id"]
    created_vehiculos.append(vid)
    r2 = session.put(f"{API}/taller/vehiculos/{vid}", json={"matricula": mat, "marca": "AA"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["marca"] == "AA"


def test_editar_a_matricula_de_otro_devuelve_409(session, created_vehiculos):
    m1, m2 = _matricula(), _matricula()
    r1 = session.post(f"{API}/taller/vehiculos", json={"matricula": m1})
    r2 = session.post(f"{API}/taller/vehiculos", json={"matricula": m2})
    assert r1.status_code == 200 and r2.status_code == 200
    id1, id2 = r1.json()["id"], r2.json()["id"]
    created_vehiculos.extend([id1, id2])
    r3 = session.put(f"{API}/taller/vehiculos/{id2}", json={"matricula": m1})
    assert r3.status_code == 409


def test_ficha_devuelve_todas_las_claves(session, created_vehiculos):
    mat = _matricula()
    r = session.post(f"{API}/taller/vehiculos", json={"matricula": mat})
    vid = r.json()["id"]
    created_vehiculos.append(vid)
    r2 = session.get(f"{API}/taller/vehiculos/{vid}/ficha")
    assert r2.status_code == 200
    d = r2.json()
    for k in ["vehiculo", "propietarios", "materiales", "facturas", "ordenes",
              "peritajes", "presupuestos", "compras", "coste_compras"]:
        assert k in d, f"Missing key {k} in ficha"
    assert isinstance(d["propietarios"], list)
    assert isinstance(d["materiales"], list)
    assert isinstance(d["facturas"], list)
