"""Backend tests for iteration 7:
- Presupuestos CRUD + numeración desde series de venta
- Admin: GET /api/admin/consumos-ia
- Facturas recibidas / documents purchase series still work
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invoice-hub-861.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@nexopro.com"
ADMIN_PASSWORD = "Admin1234!"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def series_venta(s):
    r = s.get(f"{API}/ajustes")
    assert r.status_code == 200
    return r.json().get("series_venta") or []


# ---- Presupuestos ------------------------------------------------------
class TestPresupuestos:
    def test_list_presupuestos_endpoint_exists(self, s):
        r = s.get(f"{API}/presupuestos")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_presupuesto_uses_sales_series_counter(self, s, series_venta):
        assert series_venta, "No hay series de venta configuradas"
        serie_default = next((x for x in series_venta if x.get("por_defecto")), series_venta[0])
        serie_name = serie_default["nombre"]
        prev_counter = int(serie_default.get("contadores", {}).get("presupuestos", 1))

        payload = {
            "tipo_operacion": "venta",
            "serie": serie_name,
            "contacto_id": "",
            "contacto_nombre": "TEST_Presu_Cliente",
            "contacto_nif": "B00000000",
            "fecha": "2026-01-15",
            "estado": "borrador",
            "lineas": [{"descripcion": "Servicio test", "cantidad": 2, "precio_unitario": 100,
                        "descuento": 0, "tipo_iva": 21}],
            "notas": "TEST",
        }
        r = s.post(f"{API}/presupuestos", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert "id" in data
        assert data["tipo_operacion"] == "venta"
        # numero format: '<serie>-YYYY-NNNN' or '<serie> YYYY-NNNN' - check counter appears
        num = data["numero"]
        assert serie_name.split()[0] in num or serie_name in num, f"serie {serie_name} not in {num}"
        assert f"{prev_counter:04d}" in num, f"counter {prev_counter:04d} not in {num}"

        # GET single
        pid = data["id"]
        g = s.get(f"{API}/presupuestos/{pid}")
        assert g.status_code == 200
        assert g.json()["contacto_nombre"] == "TEST_Presu_Cliente"

        # counter incremented in ajustes
        ajustes = s.get(f"{API}/ajustes").json()
        sv = ajustes["series_venta"]
        target = next(x for x in sv if x["nombre"] == serie_name)
        assert int(target["contadores"]["presupuestos"]) == prev_counter + 1

        # Filter by tipo_operacion=venta returns it
        lst = s.get(f"{API}/presupuestos?tipo_operacion=venta").json()
        assert any(d["id"] == pid for d in lst)

        # Cleanup
        d = s.delete(f"{API}/presupuestos/{pid}")
        assert d.status_code == 200


# ---- Purchase series still work for pedidos/albaranes de compra --------
class TestPurchaseDocs:
    def test_create_pedido_compra_uses_purchase_series(self, s):
        aj = s.get(f"{API}/ajustes").json()
        sc = aj.get("series_compra") or []
        assert sc, "No hay series de compra"
        serie_name = (next((x for x in sc if x.get("por_defecto")), sc[0]))["nombre"]

        payload = {
            "tipo_operacion": "compra",
            "serie": serie_name,
            "contacto_id": "",
            "contacto_nombre": "TEST_Prov_Ped",
            "contacto_nif": "B99999999",
            "fecha": "2026-01-15",
            "estado": "borrador",
            "lineas": [{"descripcion": "X", "cantidad": 1, "precio_unitario": 50,
                        "descuento": 0, "tipo_iva": 21}],
            "notas": "TEST",
        }
        r = s.post(f"{API}/pedidos", json=payload)
        assert r.status_code in (200, 201), r.text
        num = r.json()["numero"]
        assert serie_name.split()[0] in num or serie_name in num
        s.delete(f"{API}/pedidos/{r.json()['id']}")


# ---- Admin consumo IA --------------------------------------------------
class TestAdminConsumoIA:
    def test_requires_auth(self, s):
        # no auth header
        r = requests.get(f"{API}/admin/consumos-ia")
        assert r.status_code in (401, 403), r.status_code

    def test_returns_aggregate_shape(self, s, admin_headers):
        r = s.get(f"{API}/admin/consumos-ia", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(["num_lecturas", "total_tokens", "coste_total_eur", "clientes"]).issubset(d.keys())
        assert isinstance(d["clientes"], list)
        assert isinstance(d["num_lecturas"], int)
        for c in d["clientes"]:
            assert {"license_key", "empresa", "num_lecturas", "total_tokens", "coste_total_eur"}.issubset(c.keys())

    def test_licencias_crud_still_works(self, s, admin_headers):
        r = s.get(f"{API}/admin/licencias", headers=admin_headers)
        assert r.status_code == 200
        # create
        c = s.post(f"{API}/admin/licencias", headers=admin_headers,
                   json={"empresa": "TEST_LicX", "email": "x@t.co", "precio_mensual": 10})
        assert c.status_code in (200, 201)
        lic_id = c.json()["id"]
        # suspender
        hdrs = {k: v for k, v in admin_headers.items()}
        u = requests.patch(f"{API}/admin/licencias/{lic_id}/estado", headers=hdrs,
                           data={"estado": "suspendida"})
        assert u.status_code == 200
        assert u.json()["estado"] == "suspendida"
        # pago -> activa
        p = s.post(f"{API}/admin/licencias/{lic_id}/pago", headers=admin_headers)
        assert p.status_code == 200
        assert p.json()["estado"] == "activa"
        # delete
        d = s.delete(f"{API}/admin/licencias/{lic_id}", headers=admin_headers)
        assert d.status_code == 200


# ---- Facturas recibidas widget removal is UI-only; endpoint still there
class TestFacturasRecibidas:
    def test_list_ok(self, s):
        r = s.get(f"{API}/facturas-recibidas")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
