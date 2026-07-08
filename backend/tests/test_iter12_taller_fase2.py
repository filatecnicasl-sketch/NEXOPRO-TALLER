"""Backend tests: Módulo TALLER — Fase 2 (Peritajes, Compañías, Fotos, QR).

Nota: xdist loadscope agrupa por clase => todo va en una clase para compartir estado
en el mismo worker.
"""
import io
import os
import pytest
import requests
from PIL import Image


def _load_base():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not u:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        u = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return u.rstrip("/")


BASE_URL = _load_base()
API = f"{BASE_URL}/api"


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(200, 50, 50)).save(buf, format="PNG")
    return buf.getvalue()


class TestTallerFase2:
    """Suite completa Fase 2 en una única clase (loadscope-friendly)."""

    STATE = {}

    @classmethod
    def setup_class(cls):
        cls.s = requests.Session()
        cli = cls.s.post(f"{API}/contactos", json={"tipo": "cliente", "nombre": "TEST_ClientePer", "nif": "12345678Z"})
        assert cli.status_code in (200, 201), cli.text
        cls.STATE["cli_id"] = cli.json()["id"]
        v = cls.s.post(f"{API}/taller/vehiculos", json={"matricula": "TST-9999", "cliente_id": cls.STATE["cli_id"], "marca": "TEST"})
        assert v.status_code in (200, 201), v.text
        cls.STATE["veh"] = v.json()

    @classmethod
    def teardown_class(cls):
        try:
            if cls.STATE.get("per_id"):
                cls.s.delete(f"{API}/taller/peritajes/{cls.STATE['per_id']}")
            if cls.STATE.get("veh"):
                cls.s.delete(f"{API}/taller/vehiculos/{cls.STATE['veh']['id']}")
            if cls.STATE.get("cli_id"):
                cls.s.delete(f"{API}/contactos/{cls.STATE['cli_id']}")
            if cls.STATE.get("cid"):
                cls.s.delete(f"{API}/taller/companias/{cls.STATE['cid']}")
        except Exception:
            pass

    # ---- Compañías ---- #
    def test_01_crear_compania(self):
        r = self.s.post(f"{API}/taller/companias", json={"nombre": "TEST_Mapfre", "cif": "A123"})
        assert r.status_code in (200, 201), r.text
        c = r.json()
        assert c["nombre"] == "TEST_Mapfre"
        self.STATE["cid"] = c["id"]

    def test_02_listar_compania(self):
        r = self.s.get(f"{API}/taller/companias")
        assert r.status_code == 200
        assert any(x["id"] == self.STATE["cid"] for x in r.json())

    def test_03_actualizar_compania(self):
        r = self.s.put(f"{API}/taller/companias/{self.STATE['cid']}", json={"nombre": "TEST_MapfreEd", "cif": "A123"})
        assert r.status_code == 200
        assert r.json()["nombre"] == "TEST_MapfreEd"

    # ---- Peritajes ---- #
    def test_10_crear_peritaje(self):
        payload = {
            "vehiculo_id": self.STATE["veh"]["id"],
            "compania": "TEST_Mapfre",
            "siniestro": "SIN-1",
            "danios": [
                {"descripcion": "Puerta", "importe": 300},
                {"descripcion": "Retrovisor", "importe": 150},
            ],
        }
        r = self.s.post(f"{API}/taller/peritajes", json=payload)
        assert r.status_code in (200, 201), r.text
        p = r.json()
        assert p["numero"].startswith("PER-") and len(p["numero"]) == 10
        assert p["vehiculo_matricula"] == "TST-9999"
        assert p["cliente_nombre"] == "TEST_ClientePer"
        assert p["importe_total"] == 450
        assert p["estado"] == "pendiente"
        self.STATE["per_id"] = p["id"]

    def test_11_get_peritaje(self):
        r = self.s.get(f"{API}/taller/peritajes/{self.STATE['per_id']}")
        assert r.status_code == 200
        assert r.json()["id"] == self.STATE["per_id"]

    def test_12_listar_por_vehiculo(self):
        r = self.s.get(f"{API}/taller/peritajes", params={"vehiculo_id": self.STATE["veh"]["id"]})
        assert r.status_code == 200
        assert any(x["id"] == self.STATE["per_id"] for x in r.json())

    def test_13_estado_valido(self):
        r = self.s.patch(f"{API}/taller/peritajes/{self.STATE['per_id']}/estado", data={"estado": "aprobado"})
        assert r.status_code == 200
        assert r.json()["estado"] == "aprobado"

    def test_14_estado_invalido(self):
        r = self.s.patch(f"{API}/taller/peritajes/{self.STATE['per_id']}/estado", data={"estado": "kaboom"})
        assert r.status_code == 400

    def test_15_put_recalcula(self):
        r = self.s.put(f"{API}/taller/peritajes/{self.STATE['per_id']}", json={
            "vehiculo_id": self.STATE["veh"]["id"],
            "compania": "TEST_Mapfre",
            "siniestro": "SIN-1",
            "danios": [{"descripcion": "Puerta", "importe": 500}],
        })
        assert r.status_code == 200
        assert r.json()["importe_total"] == 500

    # ---- Fotos ---- #
    def test_20_subir_foto_incrementa(self):
        r = self.s.get(f"{API}/taller/peritajes/{self.STATE['per_id']}")
        antes = len(r.json().get("fotos", []))
        files = {"file": ("t.png", _png_bytes(), "image/png")}
        r = self.s.post(f"{API}/taller/peritajes/{self.STATE['per_id']}/fotos", files=files)
        assert r.status_code in (200, 201), r.text
        self.STATE["foto_path"] = r.json()["path"]
        r = self.s.get(f"{API}/taller/peritajes/{self.STATE['per_id']}")
        assert len(r.json().get("fotos", [])) == antes + 1

    def test_21_rechaza_tipo_no_imagen(self):
        files = {"file": ("t.txt", b"hola", "text/plain")}
        r = self.s.post(f"{API}/taller/peritajes/{self.STATE['per_id']}/fotos", files=files)
        assert r.status_code == 400

    def test_22_tipo_invalido(self):
        files = {"file": ("t.png", _png_bytes(), "image/png")}
        r = self.s.post(f"{API}/taller/xxx/{self.STATE['per_id']}/fotos", files=files)
        assert r.status_code == 404

    def test_23_get_media(self):
        r = self.s.get(f"{API}/taller/media/{self.STATE['foto_path']}")
        assert r.status_code == 200
        assert len(r.content) > 0

    def test_24_borrar_foto(self):
        r = self.s.delete(f"{API}/taller/peritajes/{self.STATE['per_id']}/fotos",
                          params={"path": self.STATE["foto_path"]})
        assert r.status_code == 200
        r = self.s.get(f"{API}/taller/peritajes/{self.STATE['per_id']}")
        assert all(f["path"] != self.STATE["foto_path"] for f in r.json().get("fotos", []))

    # ---- QR ---- #
    def test_30_crear_sesion(self):
        r = self.s.post(f"{API}/taller/foto-sesion",
                        json={"tipo": "peritajes", "entidad_id": self.STATE["per_id"]})
        assert r.status_code in (200, 201), r.text
        self.STATE["token"] = r.json()["token"]
        assert self.STATE["token"]

    def test_31_info_subida(self):
        r = self.s.get(f"{API}/taller/subida/{self.STATE['token']}")
        assert r.status_code == 200
        info = r.json()
        assert info["tipo"] == "peritajes"
        self.STATE["total_base"] = info["total"]

    def test_32_subir_por_token(self):
        files = {"file": ("qr.png", _png_bytes(), "image/png")}
        r = self.s.post(f"{API}/taller/subida/{self.STATE['token']}", files=files)
        assert r.status_code in (200, 201), r.text
        assert r.json()["total"] == self.STATE["total_base"] + 1

    def test_33_token_invalido_get(self):
        r = self.s.get(f"{API}/taller/subida/tok_no_existe")
        assert r.status_code == 404

    def test_34_token_invalido_post(self):
        files = {"file": ("qr.png", _png_bytes(), "image/png")}
        r = self.s.post(f"{API}/taller/subida/tok_no_existe", files=files)
        assert r.status_code == 404

    def test_35_sesion_tipo_invalido(self):
        r = self.s.post(f"{API}/taller/foto-sesion", json={"tipo": "xxx", "entidad_id": "abc"})
        assert r.status_code == 400

    # ---- Ficha vehículo ---- #
    def test_40_ficha_incluye_peritajes(self):
        r = self.s.get(f"{API}/taller/vehiculos/{self.STATE['veh']['id']}/ficha")
        assert r.status_code == 200
        j = r.json()
        assert "vehiculo" in j and "ordenes" in j and "peritajes" in j
        assert any(p["id"] == self.STATE["per_id"] for p in j["peritajes"])

    # ---- Eliminar compañía ---- #
    def test_90_eliminar_compania(self):
        r = self.s.delete(f"{API}/taller/companias/{self.STATE['cid']}")
        assert r.status_code == 200
        self.STATE.pop("cid", None)

    def test_91_eliminar_peritaje(self):
        r = self.s.delete(f"{API}/taller/peritajes/{self.STATE['per_id']}")
        assert r.status_code == 200
        r = self.s.get(f"{API}/taller/peritajes/{self.STATE['per_id']}")
        assert r.status_code == 404
        self.STATE.pop("per_id", None)
