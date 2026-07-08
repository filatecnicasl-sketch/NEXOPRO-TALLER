"""Iter 8 backend tests: conversion chain, purchase reconciliation, logo upload, pending albaranes."""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or \
    open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def serie_venta(s):
    aj = s.get(f"{API}/ajustes").json()
    return aj["series_venta"][0]["nombre"]


@pytest.fixture(scope="module")
def serie_compra(s):
    aj = s.get(f"{API}/ajustes").json()
    return aj["series_compra"][0]["nombre"]


LINEA = {"descripcion": "TEST Iter8 item", "cantidad": 2, "precio_unitario": 50, "tipo_iva": 21}


# ---- Conversion chain: presupuesto -> pedido -> albaran -> factura emitida (venta) ----
def test_conversion_chain_venta_full(s, serie_venta):
    # Create presupuesto
    r = s.post(f"{API}/presupuestos", json={
        "tipo_operacion": "venta", "serie": serie_venta,
        "contacto_nombre": "TEST_Iter8 Cliente Chain",
        "lineas": [LINEA],
    })
    assert r.status_code == 200, r.text
    presu = r.json()
    presu_id = presu["id"]
    assert presu["total"] == 121.0

    # Convert presupuesto -> pedido
    r = s.post(f"{API}/documentos/presupuestos/{presu_id}/convertir", json={"destino": "pedidos"})
    assert r.status_code == 200, r.text
    ped = r.json()
    assert ped["origen_tipo"] == "presupuestos"
    assert ped["origen_numero"] == presu["numero"]
    ped_id = ped["id"]

    # Convert pedido -> albaran
    r = s.post(f"{API}/documentos/pedidos/{ped_id}/convertir", json={"destino": "albaranes"})
    assert r.status_code == 200, r.text
    alb = r.json()
    alb_id = alb["id"]
    assert alb["origen_id"] == ped_id

    # Convert albaran -> factura (emitida)
    r = s.post(f"{API}/documentos/albaranes/{alb_id}/convertir", json={"destino": "factura"})
    assert r.status_code == 200, r.text
    fact = r.json()
    assert fact["tipo"] == "emitida"
    assert fact["total"] == 121.0
    assert "numero_completo" in fact

    # Verify albaran is now facturado
    alb_after = s.get(f"{API}/albaranes/{alb_id}").json()
    assert alb_after["estado"] == "facturado"
    assert alb_after.get("factura_id") == fact["id"]


def test_conversion_presu_to_albaran_direct(s, serie_venta):
    r = s.post(f"{API}/presupuestos", json={
        "tipo_operacion": "venta", "serie": serie_venta,
        "contacto_nombre": "TEST_Iter8 Cli Direct",
        "lineas": [LINEA],
    })
    presu_id = r.json()["id"]
    r = s.post(f"{API}/documentos/presupuestos/{presu_id}/convertir", json={"destino": "albaranes"})
    assert r.status_code == 200
    assert r.json()["origen_tipo"] == "presupuestos"


def test_conversion_double_prevented(s, serie_venta):
    r = s.post(f"{API}/presupuestos", json={
        "tipo_operacion": "venta", "serie": serie_venta,
        "contacto_nombre": "TEST_Iter8 Cli Double", "lineas": [LINEA],
    })
    pid = r.json()["id"]
    r1 = s.post(f"{API}/documentos/presupuestos/{pid}/convertir", json={"destino": "pedidos"})
    assert r1.status_code == 200
    r2 = s.post(f"{API}/documentos/presupuestos/{pid}/convertir", json={"destino": "pedidos"})
    assert r2.status_code == 400


# ---- Conversion: albaran compra -> factura recibida ----
def test_conversion_compra_albaran_to_factura_recibida(s, serie_compra):
    # Create a proveedor
    prov = s.post(f"{API}/contactos", json={"tipo": "proveedor", "nombre": "TEST_Iter8 Prov Chain"}).json()
    # Create albaran compra
    r = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "compra", "serie": serie_compra,
        "contacto_id": prov["id"], "contacto_nombre": prov["nombre"],
        "lineas": [LINEA],
    })
    assert r.status_code == 200
    alb_id = r.json()["id"]

    r = s.post(f"{API}/documentos/albaranes/{alb_id}/convertir", json={"destino": "factura"})
    assert r.status_code == 200, r.text
    fact = r.json()
    assert fact["tipo"] == "recibida"
    assert fact["origen"] == "albaran"
    assert alb_id in fact["albaranes_ids"]

    # Verify albaran now facturado
    alb_after = s.get(f"{API}/albaranes/{alb_id}").json()
    assert alb_after["estado"] == "facturado"

    # Verify factura recibida is listed
    lst = s.get(f"{API}/facturas-recibidas").json()
    assert any(f["id"] == fact["id"] for f in lst)


# ---- Pending purchase albaranes endpoint ----
def test_albaranes_compra_pendientes(s, serie_compra):
    prov = s.post(f"{API}/contactos", json={"tipo": "proveedor", "nombre": "TEST_Iter8 Prov Pending"}).json()
    # Create 2 albaranes for this proveedor
    a1 = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "compra", "serie": serie_compra,
        "contacto_id": prov["id"], "contacto_nombre": prov["nombre"],
        "lineas": [LINEA],
    }).json()
    a2 = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "compra", "serie": serie_compra,
        "contacto_id": prov["id"], "contacto_nombre": prov["nombre"],
        "lineas": [LINEA],
    }).json()

    r = s.get(f"{API}/albaranes-compra-pendientes", params={"proveedor_id": prov["id"]})
    assert r.status_code == 200
    pend = r.json()
    ids = [a["id"] for a in pend]
    assert a1["id"] in ids and a2["id"] in ids
    return prov, a1, a2


# ---- Purchase reconciliation via facturas-recibidas ----
def test_purchase_reconciliation_coincide(s, serie_compra):
    prov = s.post(f"{API}/contactos", json={"tipo": "proveedor", "nombre": "TEST_Iter8 Prov Recon"}).json()
    a1 = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "compra", "serie": serie_compra,
        "contacto_id": prov["id"], "contacto_nombre": prov["nombre"],
        "lineas": [LINEA],  # total 121.0
    }).json()

    # Create factura recibida matching total 121.0
    r = s.post(f"{API}/facturas-recibidas", json={
        "proveedor_id": prov["id"], "proveedor_nombre": prov["nombre"],
        "lineas": [LINEA],
        "albaranes_ids": [a1["id"]],
    })
    assert r.status_code == 200, r.text
    fac = r.json()
    assert fac["conciliacion"] is not None
    assert fac["conciliacion"]["coincide"] is True
    assert fac["conciliacion"]["suma_albaranes"] == 121.0

    # Albaran now facturado
    alb_after = s.get(f"{API}/albaranes/{a1['id']}").json()
    assert alb_after["estado"] == "facturado"


def test_purchase_reconciliation_no_coincide(s, serie_compra):
    prov = s.post(f"{API}/contactos", json={"tipo": "proveedor", "nombre": "TEST_Iter8 Prov NoCoin"}).json()
    a1 = s.post(f"{API}/albaranes", json={
        "tipo_operacion": "compra", "serie": serie_compra,
        "contacto_id": prov["id"], "contacto_nombre": prov["nombre"],
        "lineas": [LINEA],  # 121
    }).json()
    # Different line total
    r = s.post(f"{API}/facturas-recibidas", json={
        "proveedor_id": prov["id"], "proveedor_nombre": prov["nombre"],
        "lineas": [{"descripcion": "diff", "cantidad": 1, "precio_unitario": 50, "tipo_iva": 21}],
        "albaranes_ids": [a1["id"]],
    })
    assert r.status_code == 200
    fac = r.json()
    assert fac["conciliacion"]["coincide"] is False


# ---- Logo upload via /ajustes ----
def test_logo_persist_ajustes(s):
    # 1x1 transparent PNG
    png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    data_url = f"data:image/png;base64,{png_b64}"
    cfg = s.get(f"{API}/ajustes").json()
    empresa = cfg.get("empresa", {})
    empresa["logo"] = data_url
    r = s.put(f"{API}/ajustes", json={
        "empresa": empresa,
        "series_venta": cfg["series_venta"],
        "series_compra": cfg["series_compra"],
    })
    assert r.status_code == 200
    # Reload and verify
    cfg2 = s.get(f"{API}/ajustes").json()
    assert cfg2["empresa"]["logo"] == data_url


# ---- Direct factura emitida still works (WARNING is UI-side) ----
def test_direct_factura_emitida(s, serie_venta):
    r = s.post(f"{API}/facturas-emitidas", json={
        "serie": serie_venta, "cliente_nombre": "TEST_Iter8 Cli Direct Fact",
        "lineas": [LINEA],
    })
    assert r.status_code == 200
    f = r.json()
    assert f["total"] == 121.0
    assert "verifactu" in f
