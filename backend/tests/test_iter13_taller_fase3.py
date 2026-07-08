"""Backend tests: Módulo TALLER — Fase 3 (Citas + Préstamos de cortesía)."""
import io
import os
import pytest
import requests
from PIL import Image


def _load_base():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not u:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    u = line.split("=", 1)[1].strip()
                    break
    return u.rstrip("/")


BASE_URL = _load_base()
API = f"{BASE_URL}/api"


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(0, 128, 0)).save(buf, format="PNG")
    return buf.getvalue()


class TestTallerFase3:
    STATE = {}

    def test_00_seed_cliente_vehiculos(self):
        # Cliente
        r = requests.post(f"{API}/contactos", json={"nombre": "TEST_F3_Cliente", "tipo": "cliente"})
        assert r.status_code == 200, r.text
        self.STATE["cliente_id"] = r.json()["id"]

        # Vehículo del cliente (normal)
        r = requests.post(f"{API}/taller/vehiculos", json={
            "matricula": "TESTF3-01", "marca": "Seat", "modelo": "Ibiza",
            "cliente_id": self.STATE["cliente_id"], "tipo": "cliente"
        })
        assert r.status_code == 200, r.text
        self.STATE["vehiculo_id"] = r.json()["id"]
        assert r.json()["cliente_nombre"] == "TEST_F3_Cliente"

        # Vehículo de cortesía
        r = requests.post(f"{API}/taller/vehiculos", json={
            "matricula": "TESTF3-COR", "marca": "Fiat", "modelo": "Panda", "tipo": "cortesia"
        })
        assert r.status_code == 200, r.text
        self.STATE["vehiculo_cortesia_id"] = r.json()["id"]

    def test_10_crear_cita_hereda_cliente(self):
        r = requests.post(f"{API}/taller/citas", json={
            "vehiculo_id": self.STATE["vehiculo_id"],
            "fecha": "2026-02-15T10:00",
            "motivo": "Revisión anual",
            "tipo_trabajo": "revision",
        })
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["vehiculo_matricula"] == "TESTF3-01"
        assert c["cliente_id"] == self.STATE["cliente_id"]
        assert c["cliente_nombre"] == "TEST_F3_Cliente"
        assert c["estado"] == "pendiente"
        assert "id" in c
        self.STATE["cita_id"] = c["id"]

    def test_11_crear_segunda_cita(self):
        r = requests.post(f"{API}/taller/citas", json={
            "vehiculo_id": self.STATE["vehiculo_id"],
            "fecha": "2026-01-05T09:00",
            "motivo": "Chapa",
            "tipo_trabajo": "chapa",
        })
        assert r.status_code == 200
        self.STATE["cita2_id"] = r.json()["id"]

    def test_20_listar_citas_ordenadas(self):
        r = requests.get(f"{API}/taller/citas", params={"vehiculo_id": self.STATE["vehiculo_id"]})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        # Ordenadas por fecha ascendente
        fechas = [c["fecha"] for c in data]
        assert fechas == sorted(fechas)

    def test_21_filtro_desde_hasta(self):
        r = requests.get(f"{API}/taller/citas", params={
            "vehiculo_id": self.STATE["vehiculo_id"],
            "desde": "2026-02-01T00:00", "hasta": "2026-02-28T23:59"
        })
        assert r.status_code == 200
        data = r.json()
        assert all(c["fecha"].startswith("2026-02") for c in data)
        assert any(c["id"] == self.STATE["cita_id"] for c in data)

    def test_30_patch_estado_valido(self):
        r = requests.patch(f"{API}/taller/citas/{self.STATE['cita_id']}/estado",
                           data={"estado": "confirmada"})
        assert r.status_code == 200, r.text
        assert r.json()["estado"] == "confirmada"

    def test_31_patch_estado_invalido(self):
        r = requests.patch(f"{API}/taller/citas/{self.STATE['cita_id']}/estado",
                           data={"estado": "loquesea"})
        assert r.status_code == 400

    def test_32_put_cita(self):
        r = requests.put(f"{API}/taller/citas/{self.STATE['cita_id']}", json={
            "vehiculo_id": self.STATE["vehiculo_id"],
            "fecha": "2026-02-15T10:00",
            "motivo": "Revisión + ITV",
            "tipo_trabajo": "revision",
            "estado": "confirmada",
        })
        assert r.status_code == 200
        assert r.json()["motivo"] == "Revisión + ITV"

    def test_40_delete_cita(self):
        r = requests.delete(f"{API}/taller/citas/{self.STATE['cita2_id']}")
        assert r.status_code == 200

    # ---- Préstamos ----
    def test_50_crear_prestamo(self):
        r = requests.post(f"{API}/taller/prestamos", json={
            "vehiculo_id": self.STATE["vehiculo_cortesia_id"],
            "cliente_id": self.STATE["cliente_id"],
            "fecha_entrega": "2026-02-15",
            "fecha_devolucion_prevista": "2026-02-20",
            "km_entrega": 12000,
        })
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["vehiculo_matricula"] == "TESTF3-COR"
        assert p["cliente_nombre"] == "TEST_F3_Cliente"
        assert p["estado"] == "activo"
        assert p["contrato_path"] == ""
        self.STATE["prestamo_id"] = p["id"]

    def test_51_listar_filtro_estado(self):
        r = requests.get(f"{API}/taller/prestamos", params={"estado": "activo"})
        assert r.status_code == 200
        assert any(p["id"] == self.STATE["prestamo_id"] for p in r.json())

        r2 = requests.get(f"{API}/taller/prestamos", params={"estado": "devuelto"})
        assert r2.status_code == 200
        assert not any(p["id"] == self.STATE["prestamo_id"] for p in r2.json())

    def test_60_subir_contrato_pdf(self):
        pdf_bytes = b"%PDF-1.4\n%TEST\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        r = requests.post(
            f"{API}/taller/prestamos/{self.STATE['prestamo_id']}/contrato",
            files={"file": ("contrato.pdf", pdf_bytes, "application/pdf")}
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["contrato_path"]
        assert j["contrato_filename"] == "contrato.pdf"

        # Verificar persistencia
        r2 = requests.get(f"{API}/taller/prestamos")
        p = next(x for x in r2.json() if x["id"] == self.STATE["prestamo_id"])
        assert p["contrato_path"]

    def test_61_subir_contrato_imagen(self):
        r = requests.post(
            f"{API}/taller/prestamos/{self.STATE['prestamo_id']}/contrato",
            files={"file": ("c.png", _png_bytes(), "image/png")}
        )
        assert r.status_code == 200

    def test_62_subir_contrato_tipo_invalido(self):
        r = requests.post(
            f"{API}/taller/prestamos/{self.STATE['prestamo_id']}/contrato",
            files={"file": ("c.txt", b"hola", "text/plain")}
        )
        assert r.status_code == 400

    def test_63_subir_contrato_prestamo_inexistente(self):
        r = requests.post(
            f"{API}/taller/prestamos/id-fake-xyz/contrato",
            files={"file": ("c.pdf", b"%PDF-1.4\n", "application/pdf")}
        )
        assert r.status_code == 404

    def test_70_put_prestamo(self):
        r = requests.put(f"{API}/taller/prestamos/{self.STATE['prestamo_id']}", json={
            "vehiculo_id": self.STATE["vehiculo_cortesia_id"],
            "cliente_id": self.STATE["cliente_id"],
            "fecha_entrega": "2026-02-15",
            "fecha_devolucion_prevista": "2026-02-22",
            "fecha_devolucion_real": "2026-02-21",
            "km_entrega": 12000,
            "km_devolucion": 12450,
            "estado": "devuelto",
        })
        assert r.status_code == 200
        assert r.json()["estado"] == "devuelto"
        assert r.json()["km_devolucion"] == 12450

    def test_99_cleanup(self):
        requests.delete(f"{API}/taller/prestamos/{self.STATE['prestamo_id']}")
        requests.delete(f"{API}/taller/citas/{self.STATE['cita_id']}")
        requests.delete(f"{API}/taller/vehiculos/{self.STATE['vehiculo_id']}")
        requests.delete(f"{API}/taller/vehiculos/{self.STATE['vehiculo_cortesia_id']}")
        requests.delete(f"{API}/contactos/{self.STATE['cliente_id']}")
