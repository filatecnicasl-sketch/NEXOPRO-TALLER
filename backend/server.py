from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import re
import os
import json
import hashlib
import logging
import tempfile
import secrets
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, date, timedelta
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALGORITHM = "HS256"

# --- Almacenamiento de objetos (PDFs originales de documentos) ---
import requests as _requests
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "nexopro"
_storage_key = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = _requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def storage_put(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = _requests.put(f"{STORAGE_URL}/objects/{path}",
                         headers={"X-Storage-Key": key, "Content-Type": content_type},
                         data=data, timeout=120)
    if resp.status_code == 403:
        globals()['_storage_key'] = None
        key = init_storage()
        resp = _requests.put(f"{STORAGE_URL}/objects/{path}",
                             headers={"X-Storage-Key": key, "Content-Type": content_type},
                             data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def storage_get(path: str):
    key = init_storage()
    resp = _requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 403:
        globals()['_storage_key'] = None
        key = init_storage()
        resp = _requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def _guardar_pdf(contenido: bytes, filename: str) -> dict:
    """Sube un PDF a object storage y devuelve {pdf_path, pdf_filename}."""
    path = f"{APP_NAME}/pdfs/{new_id()}.pdf"
    res = storage_put(path, contenido, "application/pdf")
    return {"pdf_path": res["path"], "pdf_filename": filename or "documento.pdf"}

# Coste aproximado Gemini 2.5 Flash (USD por token) para estimar el gasto de IA
PRECIO_INPUT_TOKEN = 0.30 / 1_000_000
PRECIO_OUTPUT_TOKEN = 2.50 / 1_000_000
USD_EUR = 0.92

app = FastAPI(title="ERP Base - Clientes, Proveedores y Facturación")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def clean(doc: dict) -> dict:
    doc.pop('_id', None)
    return doc


async def _next_seq(name: str) -> int:
    """Contador atómico en Mongo (seguro ante concurrencia)."""
    doc = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return doc["seq"]


# ---------------------------------------------------------------------------
# AUTENTICACIÓN (Admin JWT) + LICENCIAS
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user or user.get("role") != "admin":
            raise HTTPException(401, "No autorizado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


class LoginInput(BaseModel):
    email: str
    password: str


@api_router.post("/auth/login")
async def auth_login(data: LoginInput):
    user = await db.users.find_one({"email": data.email.lower().strip()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Credenciales incorrectas")
    token = create_access_token(user["id"], user["email"])
    return {"token": token, "user": {"email": user["email"], "name": user.get("name", ""), "role": user["role"]}}


@api_router.get("/auth/me")
async def auth_me(admin: dict = Depends(get_current_admin)):
    return admin


# ---- Licencias ----
class LicenciaInput(BaseModel):
    empresa: str
    email: str = ""
    telefono: str = ""
    precio_mensual: float = 29
    notas: str = ""


def _gen_license_key() -> str:
    return "NEXO-" + secrets.token_hex(4).upper() + "-" + secrets.token_hex(2).upper()


@api_router.post("/admin/licencias")
async def crear_licencia(data: LicenciaInput, admin: dict = Depends(get_current_admin)):
    doc = {
        "id": new_id(),
        "license_key": _gen_license_key(),
        "empresa": data.empresa,
        "email": data.email,
        "telefono": data.telefono,
        "precio_mensual": data.precio_mensual,
        "estado": "activa",
        "ultimo_pago": None,
        "proximo_pago": None,
        "notas": data.notas,
        "created_at": now_iso(),
    }
    await db.licencias.insert_one(dict(doc))
    return clean(doc)


@api_router.get("/admin/licencias")
async def listar_licencias(admin: dict = Depends(get_current_admin)):
    return await db.licencias.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.put("/admin/licencias/{lic_id}")
async def actualizar_licencia(lic_id: str, data: LicenciaInput, admin: dict = Depends(get_current_admin)):
    res = await db.licencias.update_one({"id": lic_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Licencia no encontrada")
    return await db.licencias.find_one({"id": lic_id}, {"_id": 0})


@api_router.patch("/admin/licencias/{lic_id}/estado")
async def cambiar_estado_licencia(lic_id: str, estado: str = Form(...), admin: dict = Depends(get_current_admin)):
    if estado not in ("activa", "suspendida"):
        raise HTTPException(400, "Estado no válido")
    res = await db.licencias.update_one({"id": lic_id}, {"$set": {"estado": estado}})
    if res.matched_count == 0:
        raise HTTPException(404, "Licencia no encontrada")
    return await db.licencias.find_one({"id": lic_id}, {"_id": 0})


@api_router.post("/admin/licencias/{lic_id}/pago")
async def registrar_pago(lic_id: str, admin: dict = Depends(get_current_admin)):
    hoy = date.today()
    prox = (hoy.replace(day=1) + timedelta(days=32)).replace(day=1)
    res = await db.licencias.update_one({"id": lic_id}, {"$set": {
        "ultimo_pago": hoy.isoformat(), "proximo_pago": prox.isoformat(), "estado": "activa",
    }})
    if res.matched_count == 0:
        raise HTTPException(404, "Licencia no encontrada")
    return await db.licencias.find_one({"id": lic_id}, {"_id": 0})


@api_router.delete("/admin/licencias/{lic_id}")
async def eliminar_licencia(lic_id: str, admin: dict = Depends(get_current_admin)):
    await db.licencias.delete_one({"id": lic_id})
    return {"ok": True}


@api_router.get("/licencia/verificar/{license_key}")
async def verificar_licencia(license_key: str):
    """Endpoint público usado por la app cliente para saber si está activa."""
    lic = await db.licencias.find_one({"license_key": license_key}, {"_id": 0})
    if not lic:
        return {"valida": False, "estado": "no_encontrada", "mensaje": "Licencia no válida."}
    activa = lic["estado"] == "activa"
    return {
        "valida": activa,
        "estado": lic["estado"],
        "empresa": lic["empresa"],
        "mensaje": "Licencia activa." if activa else "Aplicación desactivada. Contacte con su proveedor.",
    }



# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Contacto(BaseModel):
    id: str = Field(default_factory=new_id)
    tipo: Literal['cliente', 'proveedor']
    nombre: str
    nif: str = ""
    email: str = ""
    telefono: str = ""
    direccion: str = ""
    ciudad: str = ""
    codigo_postal: str = ""
    pais: str = "España"
    iban: str = ""
    banco: str = ""
    swift: str = ""
    direccion_entrega: str = ""
    ciudad_entrega: str = ""
    cp_entrega: str = ""
    es_publica: bool = False
    dir3_oficina_contable: str = ""
    dir3_organo_gestor: str = ""
    dir3_unidad_tramitadora: str = ""
    notas: str = ""
    created_at: str = Field(default_factory=now_iso)


class ContactoInput(BaseModel):
    tipo: Literal['cliente', 'proveedor']
    nombre: str
    nif: str = ""
    email: str = ""
    telefono: str = ""
    direccion: str = ""
    ciudad: str = ""
    codigo_postal: str = ""
    pais: str = "España"
    iban: str = ""
    banco: str = ""
    swift: str = ""
    direccion_entrega: str = ""
    ciudad_entrega: str = ""
    cp_entrega: str = ""
    es_publica: bool = False
    dir3_oficina_contable: str = ""
    dir3_organo_gestor: str = ""
    dir3_unidad_tramitadora: str = ""
    notas: str = ""


class LineaItem(BaseModel):
    codigo_proveedor: str = ""
    descripcion: str = ""
    cantidad: float = 1
    unidad: str = "ud"
    precio_unitario: float = 0
    descuento: float = 0        # porcentaje
    tipo_iva: float = 21        # porcentaje
    base: float = 0
    cuota_iva: float = 0
    total: float = 0


def calcular_lineas(lineas: List[dict]):
    resultado = []
    base_total = 0.0
    iva_total = 0.0
    for l in lineas:
        cantidad = float(l.get('cantidad', 0) or 0)
        precio = float(l.get('precio_unitario', 0) or 0)
        descuento = float(l.get('descuento', 0) or 0)
        tipo_iva = float(l.get('tipo_iva', 0) or 0)
        base = round(cantidad * precio * (1 - descuento / 100), 2)
        cuota = round(base * tipo_iva / 100, 2)
        total = round(base + cuota, 2)
        base_total += base
        iva_total += cuota
        resultado.append({
            'codigo_proveedor': l.get('codigo_proveedor', ''),
            'descripcion': l.get('descripcion', ''),
            'cantidad': cantidad,
            'unidad': l.get('unidad', 'ud'),
            'precio_unitario': precio,
            'descuento': descuento,
            'tipo_iva': tipo_iva,
            'base': base,
            'cuota_iva': cuota,
            'total': total,
        })
    base_total = round(base_total, 2)
    iva_total = round(iva_total, 2)
    return resultado, base_total, iva_total, round(base_total + iva_total, 2)


# ---- Documento (Pedidos / Albaranes) ----
class DocumentoInput(BaseModel):
    tipo_operacion: Literal['venta', 'compra'] = 'venta'
    serie: str = ""
    contacto_id: str = ""
    contacto_nombre: str = ""
    contacto_nif: str = ""
    fecha: str = Field(default_factory=lambda: date.today().isoformat())
    estado: str = "borrador"
    lineas: List[LineaItem] = []
    pdf_path: str = ""
    pdf_filename: str = ""
    vehiculo_id: str = ""
    vehiculo_matricula: str = ""
    notas: str = ""


# ---- Facturas Emitidas ----
class FacturaEmitidaInput(BaseModel):
    serie: str = "A"
    cliente_id: str = ""
    cliente_nombre: str = ""
    cliente_nif: str = ""
    fecha_expedicion: str = Field(default_factory=lambda: date.today().isoformat())
    lineas: List[LineaItem] = []
    estado: str = "emitida"
    forma_pago: str = "Transferencia"
    notas: str = ""


# ---- Facturas Recibidas ----
class FacturaRecibidaInput(BaseModel):
    numero_proveedor: str = ""
    proveedor_id: str = ""
    proveedor_nombre: str = ""
    proveedor_nif: str = ""
    fecha: str = Field(default_factory=lambda: date.today().isoformat())
    lineas: List[LineaItem] = []
    estado: str = "pendiente"
    origen: str = "manual"
    forma_pago: str = "Transferencia"
    pdf_base64: str = ""
    pdf_path: str = ""
    pdf_filename: str = ""
    albaranes_ids: List[str] = []
    vehiculo_id: str = ""
    vehiculo_matricula: str = ""
    notas: str = ""


# ---------------------------------------------------------------------------
# CONTACTOS  (Clientes / Proveedores)
# ---------------------------------------------------------------------------
@api_router.post("/contactos")
async def crear_contacto(data: ContactoInput):
    contacto = Contacto(**data.model_dump())
    await db.contactos.insert_one(contacto.model_dump())
    return contacto.model_dump()


@api_router.get("/contactos")
async def listar_contactos(tipo: Optional[str] = None):
    q = {}
    if tipo:
        q['tipo'] = tipo
    docs = await db.contactos.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api_router.get("/contactos/{contacto_id}")
async def obtener_contacto(contacto_id: str):
    doc = await db.contactos.find_one({"id": contacto_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Contacto no encontrado")
    return doc


@api_router.put("/contactos/{contacto_id}")
async def actualizar_contacto(contacto_id: str, data: ContactoInput):
    res = await db.contactos.update_one({"id": contacto_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Contacto no encontrado")
    return await db.contactos.find_one({"id": contacto_id}, {"_id": 0})


@api_router.delete("/contactos/{contacto_id}")
async def eliminar_contacto(contacto_id: str):
    await db.contactos.delete_one({"id": contacto_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# ARTÍCULOS / PRODUCTOS
# ---------------------------------------------------------------------------
class ArticuloInput(BaseModel):
    nombre: str
    descripcion: str = ""
    precio: float = 0
    tipo_iva: float = 21
    unidad: str = "ud"
    codigo_proveedor: str = ""
    codigo_barras: str = ""
    notas: str = ""


async def _next_articulo_ref() -> str:
    n = await _next_seq("articulo_ref")
    return f"ART-{n:06d}"


@api_router.post("/articulos")
async def crear_articulo(data: ArticuloInput):
    d = data.model_dump()
    d["referencia"] = await _next_articulo_ref()
    doc = {"id": new_id(), **d, "nombre_lower": d["nombre"].strip().lower(),
           "origenes": [], "auto": False, "created_at": now_iso()}
    await db.articulos.insert_one(dict(doc))
    return clean(doc)


@api_router.get("/articulos")
async def listar_articulos():
    return await db.articulos.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.put("/articulos/{articulo_id}")
async def actualizar_articulo(articulo_id: str, data: ArticuloInput):
    existing = await db.articulos.find_one({"id": articulo_id})
    if not existing:
        raise HTTPException(404, "Artículo no encontrado")
    d = data.model_dump()
    d["nombre_lower"] = d["nombre"].strip().lower()
    d["referencia"] = existing.get("referencia", "")  # la referencia es automática, no editable
    await db.articulos.update_one({"id": articulo_id}, {"$set": d})
    return await db.articulos.find_one({"id": articulo_id}, {"_id": 0})


@api_router.delete("/articulos/{articulo_id}")
async def eliminar_articulo(articulo_id: str):
    await db.articulos.delete_one({"id": articulo_id})
    return {"ok": True}


async def registrar_articulos_entrada(lineas: list, origen: dict):
    """Da de alta (o actualiza) los artículos que aparecen en un documento de entrada,
    guardando en cada artículo a qué documento(s) corresponde."""
    for l in lineas:
        nombre = (l.get("descripcion") or "").strip()
        if not nombre:
            continue
        entry = {
            "tipo": origen["tipo"],
            "documento_numero": origen["numero"],
            "documento_id": origen["id"],
            "fecha": origen.get("fecha", ""),
            "proveedor": origen.get("proveedor", ""),
            "precio": l.get("precio_unitario", 0),
            "cantidad": l.get("cantidad", 0),
            "codigo_proveedor": l.get("codigo_proveedor", ""),
        }
        cod_prov = l.get("codigo_proveedor", "")
        existing = await db.articulos.find_one({"nombre_lower": nombre.lower()})
        if existing:
            origenes = existing.get("origenes", [])
            if not any(o.get("documento_id") == origen["id"] for o in origenes):
                origenes.append(entry)
            update = {
                "origenes": origenes,
                "precio": l.get("precio_unitario", existing.get("precio", 0)),
                "tipo_iva": l.get("tipo_iva", existing.get("tipo_iva", 21)),
            }
            if cod_prov and not existing.get("codigo_proveedor"):
                update["codigo_proveedor"] = cod_prov
            await db.articulos.update_one({"id": existing["id"]}, {"$set": update})
        else:
            art = {
                "id": new_id(), "referencia": await _next_articulo_ref(), "nombre": nombre,
                "nombre_lower": nombre.lower(), "descripcion": "",
                "precio": l.get("precio_unitario", 0), "tipo_iva": l.get("tipo_iva", 21),
                "unidad": "ud", "codigo_proveedor": cod_prov,
                "codigo_barras": "", "notas": "", "origenes": [entry], "auto": True,
                "created_at": now_iso(),
            }
            await db.articulos.insert_one(dict(art))


async def ensure_cliente(nombre: str, nif: str = "") -> Optional[dict]:
    """Busca un cliente por NIF o nombre; si no existe, lo da de alta automáticamente."""
    nombre = (nombre or "").strip()
    if not nombre:
        return None
    query = {"tipo": "cliente"}
    existing = None
    if nif:
        existing = await db.contactos.find_one({"tipo": "cliente", "nif": nif})
    if not existing:
        existing = await db.contactos.find_one({
            "tipo": "cliente",
            "nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"},
        })
    if existing:
        return existing
    nuevo = Contacto(tipo="cliente", nombre=nombre, nif=nif, notas="Alta automática desde documento de venta")
    doc = nuevo.model_dump()
    await db.contactos.insert_one(dict(doc))
    return doc


async def ensure_proveedor(nombre: str, nif: str = "") -> Optional[dict]:
    """Busca un proveedor por NIF o nombre; si no existe, lo da de alta automáticamente."""
    nombre = (nombre or "").strip()
    if not nombre:
        return None
    existing = None
    if nif:
        existing = await db.contactos.find_one({"tipo": "proveedor", "nif": nif})
    if not existing:
        existing = await db.contactos.find_one({
            "tipo": "proveedor",
            "nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"},
        })
    if existing:
        return existing
    nuevo = Contacto(tipo="proveedor", nombre=nombre, nif=nif, notas="Alta automática desde documento de compra")
    doc = nuevo.model_dump()
    await db.contactos.insert_one(dict(doc))
    return doc


# ---------------------------------------------------------------------------
# AJUSTES (Series de documentos, contadores y datos de empresa)
# ---------------------------------------------------------------------------
DEFAULT_EMPRESA = {
    "nombre": "", "nif": "", "direccion": "", "codigo_postal": "",
    "ciudad": "", "telefono": "", "email": "", "iban": "", "logo": "",
}


async def _get_ajustes() -> dict:
    cfg = await db.ajustes.find_one({"_id": "config"})
    if not cfg:
        count_a = await db.facturas_emitidas.count_documents({"serie": "A"})
        cfg = {
            "_id": "config",
            "empresa": dict(DEFAULT_EMPRESA),
            "series_venta": [{"id": new_id(), "nombre": "A", "por_defecto": True,
                              "contadores": {"presupuestos": 1, "facturas": count_a + 1, "pedidos": 1, "albaranes": 1}}],
            "series_compra": [{"id": new_id(), "nombre": "C", "por_defecto": True,
                               "contadores": {"pedidos": 1, "albaranes": 1}}],
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.ajustes.insert_one(dict(cfg))
    return cfg


async def _siguiente_contador(ambito: str, tipo_doc: str, serie: str):
    """Próximo número de la serie; incrementa el contador. None si la serie no existe."""
    await _get_ajustes()
    key = "series_venta" if ambito == "venta" else "series_compra"
    res = await db.ajustes.find_one_and_update(
        {"_id": "config", f"{key}.nombre": serie},
        {"$inc": {f"{key}.$.contadores.{tipo_doc}": 1}},
        return_document=ReturnDocument.BEFORE,
    )
    if not res:
        return None
    for s in res.get(key, []):
        if s.get("nombre") == serie:
            return int((s.get("contadores") or {}).get(tipo_doc, 1) or 1)
    return None


class AjustesInput(BaseModel):
    empresa: dict = {}
    series_venta: List[dict] = []
    series_compra: List[dict] = []


def _norm_series(series: list, tipos: list) -> list:
    out, vistos = [], set()
    for s in series:
        nombre = (s.get("nombre") or "").strip().upper()
        if not nombre or nombre in vistos:
            continue
        vistos.add(nombre)
        cont = s.get("contadores") or {}
        out.append({
            "id": s.get("id") or new_id(),
            "nombre": nombre,
            "por_defecto": bool(s.get("por_defecto")),
            "contadores": {t: max(1, int(cont.get(t, 1) or 1)) for t in tipos},
        })
    if out and not any(s["por_defecto"] for s in out):
        out[0]["por_defecto"] = True
    return out


@api_router.get("/ajustes")
async def obtener_ajustes():
    return clean(dict(await _get_ajustes()))


@api_router.put("/ajustes")
async def guardar_ajustes(data: AjustesInput):
    await _get_ajustes()
    empresa = {**DEFAULT_EMPRESA, **(data.empresa or {})}
    sv = _norm_series(data.series_venta, ["presupuestos", "facturas", "pedidos", "albaranes"])
    sc = _norm_series(data.series_compra, ["pedidos", "albaranes"])
    if not sv:
        sv = [{"id": new_id(), "nombre": "A", "por_defecto": True,
               "contadores": {"presupuestos": 1, "facturas": 1, "pedidos": 1, "albaranes": 1}}]
    if not sc:
        sc = [{"id": new_id(), "nombre": "C", "por_defecto": True,
               "contadores": {"pedidos": 1, "albaranes": 1}}]
    await db.ajustes.update_one({"_id": "config"}, {"$set": {
        "empresa": empresa, "series_venta": sv, "series_compra": sc, "updated_at": now_iso(),
    }}, upsert=True)
    return clean(dict(await _get_ajustes()))


# ---------------------------------------------------------------------------
# DOCUMENTOS genéricos (Pedidos / Albaranes)
# ---------------------------------------------------------------------------
async def _numero_documento(ambito: str, tipo_doc: str, prefijo: str, serie: str = "") -> str:
    year = datetime.now().year
    if serie:
        n = await _siguiente_contador(ambito, tipo_doc, serie)
        if n is not None:
            return f"{serie}-{year}-{n:04d}"
    n = await _next_seq(f"num_{tipo_doc}")
    return f"{prefijo}-{year}-{n:04d}"


def _build_documento(data: DocumentoInput, numero: str):
    lineas, base, iva, total = calcular_lineas([l.model_dump() for l in data.lineas])
    return {
        "id": new_id(),
        "numero": numero,
        "serie": data.serie,
        "tipo_operacion": data.tipo_operacion,
        "contacto_id": data.contacto_id,
        "contacto_nombre": data.contacto_nombre,
        "contacto_nif": data.contacto_nif,
        "fecha": data.fecha,
        "estado": data.estado,
        "lineas": lineas,
        "base_total": base,
        "iva_total": iva,
        "total": total,
        "pdf_path": data.pdf_path,
        "pdf_filename": data.pdf_filename,
        "vehiculo_id": data.vehiculo_id,
        "vehiculo_matricula": data.vehiculo_matricula,
        "notas": data.notas,
        "created_at": now_iso(),
    }


def _make_documento_routes(entidad: str, coleccion: str, prefijo: str, registrar_entrada=False):
    @api_router.post(f"/{entidad}")
    async def crear(data: DocumentoInput):
        serie = (data.serie or "").strip().upper()
        numero = await _numero_documento(data.tipo_operacion, coleccion, prefijo, serie)
        doc = _build_documento(data, numero)
        if doc["tipo_operacion"] == "venta" and doc["contacto_nombre"] and not doc["contacto_id"]:
            cli = await ensure_cliente(doc["contacto_nombre"], doc.get("contacto_nif", ""))
            if cli:
                doc["contacto_id"] = cli["id"]
                doc["contacto_nif"] = doc["contacto_nif"] or cli.get("nif", "")
        elif doc["tipo_operacion"] == "compra" and doc["contacto_nombre"] and not doc["contacto_id"]:
            prov = await ensure_proveedor(doc["contacto_nombre"], doc.get("contacto_nif", ""))
            if prov:
                doc["contacto_id"] = prov["id"]
                doc["contacto_nif"] = doc["contacto_nif"] or prov.get("nif", "")
        await db[coleccion].insert_one(dict(doc))
        if registrar_entrada and doc["tipo_operacion"] == "compra":
            await registrar_articulos_entrada(doc["lineas"], {
                "tipo": entidad, "numero": doc["numero"], "id": doc["id"],
                "fecha": doc["fecha"], "proveedor": doc["contacto_nombre"],
            })
        return clean(doc)

    @api_router.get(f"/{entidad}")
    async def listar(tipo_operacion: Optional[str] = None):
        q = {}
        if tipo_operacion:
            q['tipo_operacion'] = tipo_operacion
        return await db[coleccion].find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)

    @api_router.get(f"/{entidad}/{{doc_id}}")
    async def obtener(doc_id: str):
        doc = await db[coleccion].find_one({"id": doc_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "No encontrado")
        return doc

    @api_router.put(f"/{entidad}/{{doc_id}}")
    async def actualizar(doc_id: str, data: DocumentoInput):
        existing = await db[coleccion].find_one({"id": doc_id})
        if not existing:
            raise HTTPException(404, "No encontrado")
        doc = _build_documento(data, existing['numero'])
        doc['id'] = doc_id
        doc['created_at'] = existing.get('created_at', now_iso())
        await db[coleccion].update_one({"id": doc_id}, {"$set": clean(dict(doc))})
        return doc

    @api_router.delete(f"/{entidad}/{{doc_id}}")
    async def eliminar(doc_id: str):
        await db[coleccion].delete_one({"id": doc_id})
        return {"ok": True}


_make_documento_routes("presupuestos", "presupuestos", "PRE")
_make_documento_routes("pedidos", "pedidos", "PED")
_make_documento_routes("albaranes", "albaranes", "ALB", registrar_entrada=True)


# ---------------------------------------------------------------------------
# FACTURAS EMITIDAS  (con Verifactu)
# ---------------------------------------------------------------------------
async def _generar_verifactu(serie: str, numero: str, fecha: str, nif: str, total: float):
    """Genera la huella encadenada y los datos del QR (compatible Verifactu)."""
    ultima = await db.facturas_emitidas.find_one(
        {"verifactu.huella": {"$exists": True}},
        {"_id": 0, "verifactu": 1},
        sort=[("created_at", -1)],
    )
    huella_anterior = ultima["verifactu"]["huella"] if ultima else ""
    cadena = f"{huella_anterior}|{serie}{numero}|{fecha}|{nif}|{total:.2f}"
    huella = hashlib.sha256(cadena.encode()).hexdigest().upper()
    qr_data = (
        "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?"
        f"nif={nif}&numserie={serie}{numero}&fecha={fecha}&importe={total:.2f}"
    )
    return {
        "huella": huella,
        "huella_anterior": huella_anterior,
        "qr_data": qr_data,
        "estado": "registrada",
        "timestamp": now_iso(),
    }


async def _emitir_factura(serie, cliente_id, cliente_nombre, cliente_nif, fecha, lineas, base, iva, total,
                          estado, forma_pago, notas, tipo_factura="ordinaria", rectifica_a=""):
    year = datetime.now().year
    n = await _siguiente_contador("venta", "facturas", serie)
    if n is None:
        n = await db.facturas_emitidas.count_documents({"serie": serie}) + 1
    numero = f"{n:04d}"
    numero_completo = f"{serie}{year}-{numero}"
    verifactu = await _generar_verifactu(serie, numero_completo, fecha, cliente_nif or "B00000000", total)
    doc = {
        "id": new_id(),
        "serie": serie,
        "numero": numero,
        "numero_completo": numero_completo,
        "tipo_factura": tipo_factura,
        "rectifica_a": rectifica_a,
        "cliente_id": cliente_id,
        "cliente_nombre": cliente_nombre,
        "cliente_nif": cliente_nif,
        "fecha_expedicion": fecha,
        "lineas": lineas,
        "base_total": base,
        "iva_total": iva,
        "total": total,
        "estado": estado,
        "forma_pago": forma_pago,
        "verifactu": verifactu,
        "notas": notas,
        "created_at": now_iso(),
    }
    await db.facturas_emitidas.insert_one(dict(doc))
    return clean(doc)


@api_router.post("/facturas-emitidas")
async def crear_factura_emitida(data: FacturaEmitidaInput):
    cliente_id = data.cliente_id
    cliente_nif = data.cliente_nif
    if data.cliente_nombre and not cliente_id:
        cli = await ensure_cliente(data.cliente_nombre, data.cliente_nif)
        if cli:
            cliente_id = cli["id"]
            cliente_nif = cliente_nif or cli.get("nif", "")
    lineas, base, iva, total = calcular_lineas([l.model_dump() for l in data.lineas])
    return await _emitir_factura(data.serie, cliente_id, data.cliente_nombre, cliente_nif,
                                 data.fecha_expedicion, lineas, base, iva, total,
                                 data.estado, data.forma_pago, data.notas)


@api_router.get("/facturas-emitidas")
async def listar_facturas_emitidas():
    return await db.facturas_emitidas.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.get("/facturas-emitidas/{doc_id}")
async def obtener_factura_emitida(doc_id: str):
    doc = await db.facturas_emitidas.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "No encontrada")
    return doc


# ---------------------------------------------------------------------------
# FACTURAE 3.2.2 (factura electrónica para Administraciones Públicas / FACe)
# ---------------------------------------------------------------------------
def _xe(v) -> str:
    return (str(v if v is not None else "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _person_type(nif: str) -> str:
    c = (nif or "").strip().upper()[:1]
    return "J" if c in "ABCDEFGHJNPQRSUVW" else "F"


def _fmt(n, dec=2) -> str:
    return f"{float(n or 0):.{dec}f}"


def _facturae_domicilio(direccion, cp, ciudad):
    return (
        "<AddressInSpain>"
        f"<Address>{_xe(direccion or 'N/A')}</Address>"
        f"<PostCode>{_xe((cp or '00000').strip()[:5].zfill(5))}</PostCode>"
        f"<Town>{_xe(ciudad or 'N/A')}</Town>"
        f"<Province>{_xe(ciudad or 'N/A')}</Province>"
        "<CountryCode>ESP</CountryCode>"
        "</AddressInSpain>"
    )


def _facturae_parte(nif, nombre, direccion, cp, ciudad, centros_xml=""):
    ptype = _person_type(nif)
    entidad = (
        f"<LegalEntity><CorporateName>{_xe(nombre)}</CorporateName>{_facturae_domicilio(direccion, cp, ciudad)}</LegalEntity>"
        if ptype == "J" else
        f"<Individual><Name>{_xe(nombre)}</Name><FirstSurname>{_xe(nombre)}</FirstSurname>{_facturae_domicilio(direccion, cp, ciudad)}</Individual>"
    )
    return (
        "<TaxIdentification>"
        f"<PersonTypeCode>{ptype}</PersonTypeCode>"
        "<ResidenceTypeCode>R</ResidenceTypeCode>"
        f"<TaxIdentificationNumber>{_xe((nif or '').strip().upper())}</TaxIdentificationNumber>"
        "</TaxIdentification>"
        f"{centros_xml}{entidad}"
    )


def _facturae_centros(cliente):
    """AdministrativeCentres con los DIR3 (01 Oficina Contable, 02 Órgano Gestor, 03 Unidad Tramitadora)."""
    mapa = [
        ("01", cliente.get("dir3_oficina_contable", ""), "Oficina contable"),
        ("02", cliente.get("dir3_organo_gestor", ""), "Órgano gestor"),
        ("03", cliente.get("dir3_unidad_tramitadora", ""), "Unidad tramitadora"),
    ]
    centros = ""
    for role, code, nombre in mapa:
        if not code:
            continue
        centros += (
            "<AdministrativeCentre>"
            f"<CentreCode>{_xe(code.strip())}</CentreCode>"
            f"<RoleTypeCode>{role}</RoleTypeCode>"
            f"<Name>{_xe(nombre)}</Name>"
            f"{_facturae_domicilio(cliente.get('direccion'), cliente.get('codigo_postal'), cliente.get('ciudad'))}"
            f"<CentreDescription>{_xe(nombre)}</CentreDescription>"
            "</AdministrativeCentre>"
        )
    return f"<AdministrativeCentres>{centros}</AdministrativeCentres>" if centros else ""


def _facturae_xml(f: dict, empresa: dict, cliente: dict) -> str:
    lineas, base_total, iva_total, total = calcular_lineas(f.get("lineas", []))

    grupos = {}
    for l in lineas:
        g = grupos.setdefault(float(l.get("tipo_iva", 0)), {"base": 0.0, "cuota": 0.0})
        g["base"] += l.get("base", 0)
        g["cuota"] += l.get("cuota_iva", 0)
    taxes = "".join(
        "<Tax><TaxTypeCode>01</TaxTypeCode>"
        f"<TaxRate>{_fmt(rate)}</TaxRate>"
        f"<TaxableBase><TotalAmount>{_fmt(v['base'])}</TotalAmount></TaxableBase>"
        f"<TaxAmount><TotalAmount>{_fmt(v['cuota'])}</TotalAmount></TaxAmount></Tax>"
        for rate, v in sorted(grupos.items(), reverse=True)
    )

    items = ""
    for l in lineas:
        cant = float(l.get("cantidad", 0) or 0)
        precio = float(l.get("precio_unitario", 0) or 0)
        dto = float(l.get("descuento", 0) or 0)
        total_cost = round(cant * precio, 2)
        base = l.get("base", 0)
        descuento_xml = ""
        if dto:
            descuento_xml = (
                "<DiscountsAndRebates><Discount>"
                f"<DiscountReason>Descuento</DiscountReason>"
                f"<DiscountRate>{_fmt(dto)}</DiscountRate>"
                f"<DiscountAmount>{_fmt(round(total_cost - base, 2))}</DiscountAmount>"
                "</Discount></DiscountsAndRebates>"
            )
        items += (
            "<InvoiceLine>"
            f"<ItemDescription>{_xe(l.get('descripcion', ''))}</ItemDescription>"
            f"<Quantity>{_fmt(cant, 6)}</Quantity>"
            "<UnitOfMeasure>01</UnitOfMeasure>"
            f"<UnitPriceWithoutTax>{_fmt(precio, 6)}</UnitPriceWithoutTax>"
            f"<TotalCost>{_fmt(total_cost)}</TotalCost>"
            f"{descuento_xml}"
            f"<GrossAmount>{_fmt(base)}</GrossAmount>"
            "<TaxesOutputs><Tax><TaxTypeCode>01</TaxTypeCode>"
            f"<TaxRate>{_fmt(l.get('tipo_iva', 0))}</TaxRate>"
            f"<TaxableBase><TotalAmount>{_fmt(base)}</TotalAmount></TaxableBase>"
            f"<TaxAmount><TotalAmount>{_fmt(l.get('cuota_iva', 0))}</TotalAmount></TaxAmount>"
            "</Tax></TaxesOutputs>"
            "</InvoiceLine>"
        )

    seller = _facturae_parte(empresa.get("nif"), empresa.get("nombre") or "Emisor",
                             empresa.get("direccion"), empresa.get("codigo_postal"), empresa.get("ciudad"))
    buyer = _facturae_parte(cliente.get("nif") or f.get("cliente_nif"), cliente.get("nombre") or f.get("cliente_nombre") or "Cliente",
                            cliente.get("direccion"), cliente.get("codigo_postal"), cliente.get("ciudad"),
                            centros_xml=_facturae_centros(cliente))

    ns = "http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml"
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<fe:Facturae xmlns:fe="{ns}">'
        "<FileHeader>"
        "<SchemaVersion>3.2.2</SchemaVersion>"
        "<Modality>I</Modality>"
        "<InvoiceIssuerType>EM</InvoiceIssuerType>"
        "<Batch>"
        f"<BatchIdentifier>{_xe(f.get('numero_completo', ''))}</BatchIdentifier>"
        "<InvoicesCount>1</InvoicesCount>"
        f"<TotalInvoicesAmount><TotalAmount>{_fmt(total)}</TotalAmount></TotalInvoicesAmount>"
        f"<TotalOutstandingAmount><TotalAmount>{_fmt(total)}</TotalAmount></TotalOutstandingAmount>"
        f"<TotalExecutableAmount><TotalAmount>{_fmt(total)}</TotalAmount></TotalExecutableAmount>"
        "<InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>"
        "</Batch>"
        "</FileHeader>"
        f"<Parties><SellerParty>{seller}</SellerParty><BuyerParty>{buyer}</BuyerParty></Parties>"
        "<Invoices><Invoice>"
        "<InvoiceHeader>"
        f"<InvoiceNumber>{_xe(f.get('numero_completo', ''))}</InvoiceNumber>"
        f"<InvoiceSeriesCode>{_xe(f.get('serie', ''))}</InvoiceSeriesCode>"
        "<InvoiceDocumentType>FC</InvoiceDocumentType>"
        f"<InvoiceClass>{'OR' if f.get('tipo_factura') == 'rectificativa' else 'OO'}</InvoiceClass>"
        "</InvoiceHeader>"
        "<InvoiceIssueData>"
        f"<IssueDate>{_xe(f.get('fecha_expedicion', date.today().isoformat()))}</IssueDate>"
        "<InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>"
        "<TaxCurrencyCode>EUR</TaxCurrencyCode>"
        "<LanguageName>es</LanguageName>"
        "</InvoiceIssueData>"
        f"<TaxesOutputs>{taxes}</TaxesOutputs>"
        "<InvoiceTotals>"
        f"<TotalGrossAmount>{_fmt(base_total)}</TotalGrossAmount>"
        f"<TotalGrossAmountBeforeTaxes>{_fmt(base_total)}</TotalGrossAmountBeforeTaxes>"
        f"<TotalTaxOutputs>{_fmt(iva_total)}</TotalTaxOutputs>"
        "<TotalTaxesWithheld>0.00</TotalTaxesWithheld>"
        f"<InvoiceTotal>{_fmt(total)}</InvoiceTotal>"
        f"<TotalOutstandingAmount>{_fmt(total)}</TotalOutstandingAmount>"
        f"<TotalExecutableAmount>{_fmt(total)}</TotalExecutableAmount>"
        "</InvoiceTotals>"
        f"<Items>{items}</Items>"
        "</Invoice></Invoices>"
        "</fe:Facturae>"
    )


@api_router.get("/facturas-emitidas/{doc_id}/facturae")
async def facturae_factura_emitida(doc_id: str):
    f = await db.facturas_emitidas.find_one({"id": doc_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "No encontrada")
    cfg = await _get_ajustes()
    empresa = cfg.get("empresa", {})
    cliente = {}
    if f.get("cliente_id"):
        cliente = await db.contactos.find_one({"id": f["cliente_id"]}, {"_id": 0}) or {}
    if not cliente and f.get("cliente_nif"):
        cliente = await db.contactos.find_one({"tipo": "cliente", "nif": f["cliente_nif"]}, {"_id": 0}) or {}
    if not cliente:
        cliente = {"nombre": f.get("cliente_nombre", ""), "nif": f.get("cliente_nif", "")}
    xml = _facturae_xml(f, empresa, cliente)
    filename = f"facturae_{(f.get('numero_completo') or doc_id).replace(' ', '_')}.xml"
    return Response(content=xml, media_type="application/xml",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@api_router.patch("/facturas-emitidas/{doc_id}/estado")
async def cambiar_estado_factura_emitida(doc_id: str, estado: str = Form(...)):
    res = await db.facturas_emitidas.update_one({"id": doc_id}, {"$set": {"estado": estado}})
    if res.matched_count == 0:
        raise HTTPException(404, "No encontrada")
    return await db.facturas_emitidas.find_one({"id": doc_id}, {"_id": 0})


@api_router.post("/facturas-emitidas/{doc_id}/rectificar")
async def rectificar_factura_emitida(doc_id: str):
    """Verifactu: las facturas no se eliminan; se emite una factura rectificativa (abono)."""
    orig = await db.facturas_emitidas.find_one({"id": doc_id}, {"_id": 0})
    if not orig:
        raise HTTPException(404, "No encontrada")
    if orig.get("tipo_factura") == "rectificativa":
        raise HTTPException(400, "Una factura rectificativa no se puede rectificar")
    lineas_neg = [{**l, "cantidad": -abs(float(l.get("cantidad", 0)))} for l in orig["lineas"]]
    lineas, base, iva, total = calcular_lineas(lineas_neg)
    nueva = await _emitir_factura(
        orig["serie"], orig.get("cliente_id", ""), orig["cliente_nombre"], orig.get("cliente_nif", ""),
        date.today().isoformat(), lineas, base, iva, total, "emitida",
        orig.get("forma_pago", "Transferencia"), f"Rectificativa (abono) de {orig['numero_completo']}",
        tipo_factura="rectificativa", rectifica_a=orig["numero_completo"],
    )
    await db.facturas_emitidas.update_one({"id": doc_id}, {"$set": {"estado": "rectificada"}})
    return nueva


# ---------------------------------------------------------------------------
# FACTURAS RECIBIDAS
# ---------------------------------------------------------------------------
@api_router.get("/albaranes-compra-pendientes")
async def albaranes_compra_pendientes(proveedor_id: str = "", proveedor_nombre: str = ""):
    """Albaranes de compra aún no facturados (para conciliar con una factura recibida)."""
    q = {"tipo_operacion": "compra", "estado": {"$ne": "facturado"}}
    if proveedor_id:
        q["contacto_id"] = proveedor_id
    elif proveedor_nombre:
        q["contacto_nombre"] = {"$regex": f"^{re.escape(proveedor_nombre)}$", "$options": "i"}
    return await db.albaranes.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/facturas-recibidas")
async def crear_factura_recibida(data: FacturaRecibidaInput):
    lineas, base, iva, total = calcular_lineas([l.model_dump() for l in data.lineas])
    conciliacion = None
    if data.albaranes_ids:
        albs = await db.albaranes.find({"id": {"$in": data.albaranes_ids}}, {"_id": 0}).to_list(500)
        suma = round(sum(a.get("total", 0) for a in albs), 2)
        conciliacion = {
            "albaranes": [{"id": a["id"], "numero": a.get("numero", ""), "total": a.get("total", 0)} for a in albs],
            "suma_albaranes": suma,
            "coincide": abs(suma - total) < 0.01,
        }
    prov_id = data.proveedor_id
    prov_nif = data.proveedor_nif
    if data.proveedor_nombre and not prov_id:
        prov = await ensure_proveedor(data.proveedor_nombre, data.proveedor_nif)
        if prov:
            prov_id = prov["id"]
            prov_nif = prov_nif or prov.get("nif", "")
    doc = {
        "id": new_id(),
        "numero_proveedor": data.numero_proveedor,
        "tipo_factura": "ordinaria",
        "rectifica_a": "",
        "proveedor_id": prov_id,
        "proveedor_nombre": data.proveedor_nombre,
        "proveedor_nif": prov_nif,
        "fecha": data.fecha,
        "lineas": lineas,
        "base_total": base,
        "iva_total": iva,
        "total": total,
        "estado": data.estado,
        "origen": data.origen,
        "forma_pago": data.forma_pago,
        "pdf_base64": data.pdf_base64,
        "pdf_path": data.pdf_path,
        "pdf_filename": data.pdf_filename,
        "albaranes_ids": data.albaranes_ids,
        "conciliacion": conciliacion,
        "vehiculo_id": data.vehiculo_id,
        "vehiculo_matricula": data.vehiculo_matricula,
        "notas": data.notas,
        "created_at": now_iso(),
    }
    await db.facturas_recibidas.insert_one(dict(doc))
    if data.albaranes_ids:
        await db.albaranes.update_many({"id": {"$in": data.albaranes_ids}}, {"$set": {
            "estado": "facturado", "factura_id": doc["id"],
        }})
    await registrar_articulos_entrada(doc["lineas"], {
        "tipo": "factura_recibida", "numero": doc["numero_proveedor"] or doc["id"][:8],
        "id": doc["id"], "fecha": doc["fecha"], "proveedor": doc["proveedor_nombre"],
    })
    return clean(doc)


@api_router.get("/facturas-recibidas")
async def listar_facturas_recibidas():
    docs = await db.facturas_recibidas.find({}, {"_id": 0, "pdf_base64": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api_router.get("/facturas-recibidas/{doc_id}")
async def obtener_factura_recibida(doc_id: str):
    doc = await db.facturas_recibidas.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "No encontrada")
    return doc


@api_router.patch("/facturas-recibidas/{doc_id}/estado")
async def cambiar_estado_factura_recibida(doc_id: str, estado: str = Form(...)):
    res = await db.facturas_recibidas.update_one({"id": doc_id}, {"$set": {"estado": estado}})
    if res.matched_count == 0:
        raise HTTPException(404, "No encontrada")
    return await db.facturas_recibidas.find_one({"id": doc_id}, {"_id": 0, "pdf_base64": 0})


@api_router.post("/facturas-recibidas/{doc_id}/rectificar")
async def rectificar_factura_recibida(doc_id: str):
    """Verifactu: no se elimina; se registra una rectificativa (abono) que referencia la original."""
    orig = await db.facturas_recibidas.find_one({"id": doc_id}, {"_id": 0})
    if not orig:
        raise HTTPException(404, "No encontrada")
    if orig.get("tipo_factura") == "rectificativa":
        raise HTTPException(400, "Una factura rectificativa no se puede rectificar")
    lineas_neg = [{**l, "cantidad": -abs(float(l.get("cantidad", 0)))} for l in orig["lineas"]]
    lineas, base, iva, total = calcular_lineas(lineas_neg)
    doc = {
        "id": new_id(),
        "numero_proveedor": f"RECT-{orig.get('numero_proveedor', '')}",
        "tipo_factura": "rectificativa",
        "rectifica_a": orig.get("numero_proveedor", "") or orig["id"][:8],
        "proveedor_id": orig.get("proveedor_id", ""),
        "proveedor_nombre": orig["proveedor_nombre"],
        "proveedor_nif": orig.get("proveedor_nif", ""),
        "fecha": date.today().isoformat(),
        "lineas": lineas,
        "base_total": base,
        "iva_total": iva,
        "total": total,
        "estado": "pendiente",
        "origen": "rectificativa",
        "forma_pago": orig.get("forma_pago", "Transferencia"),
        "pdf_base64": "",
        "notas": f"Rectificativa (abono) de {orig.get('numero_proveedor', '')}",
        "created_at": now_iso(),
    }
    await db.facturas_recibidas.insert_one(dict(doc))
    await db.facturas_recibidas.update_one({"id": doc_id}, {"$set": {"estado": "rectificada"}})
    return clean(doc)


# ---------------------------------------------------------------------------
# CONVERSIÓN entre documentos (presupuesto → pedido/albarán → factura)
# ---------------------------------------------------------------------------
_PREFIJOS = {"presupuestos": "PRE", "pedidos": "PED", "albaranes": "ALB"}
_TRANSICIONES = {
    "presupuestos": ["pedidos", "albaranes"],
    "pedidos": ["albaranes"],
    "albaranes": ["factura"],
}


class ConvertirInput(BaseModel):
    destino: str  # "pedidos" | "albaranes" | "factura"


@api_router.post("/documentos/{entidad}/{doc_id}/convertir")
async def convertir_documento(entidad: str, doc_id: str, data: ConvertirInput):
    if entidad not in _TRANSICIONES:
        raise HTTPException(400, "Origen no válido")
    if data.destino not in _TRANSICIONES[entidad]:
        raise HTTPException(400, f"No se puede convertir {entidad} a {data.destino}")
    src = await db[entidad].find_one({"id": doc_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Documento no encontrado")
    if src.get("convertido_a") == data.destino or src.get("estado") == "facturado":
        raise HTTPException(400, "Este documento ya se ha convertido")
    op = src.get("tipo_operacion", "venta")
    lineas, base, iva, total = calcular_lineas(src.get("lineas", []))
    serie = src.get("serie", "")

    if data.destino in ("pedidos", "albaranes"):
        numero = await _numero_documento(op, data.destino, _PREFIJOS[data.destino], serie)
        nuevo = {
            "id": new_id(), "numero": numero, "serie": serie, "tipo_operacion": op,
            "contacto_id": src.get("contacto_id", ""), "contacto_nombre": src.get("contacto_nombre", ""),
            "contacto_nif": src.get("contacto_nif", ""), "fecha": date.today().isoformat(),
            "estado": "confirmado", "lineas": lineas, "base_total": base, "iva_total": iva, "total": total,
            "notas": f"Generado desde {entidad[:-1]} {src.get('numero', '')}",
            "origen_tipo": entidad, "origen_id": doc_id, "origen_numero": src.get("numero", ""),
            "created_at": now_iso(),
        }
        await db[data.destino].insert_one(dict(nuevo))
        if data.destino == "albaranes" and op == "compra":
            await registrar_articulos_entrada(lineas, {
                "tipo": "albaranes", "numero": numero, "id": nuevo["id"],
                "fecha": nuevo["fecha"], "proveedor": nuevo["contacto_nombre"],
            })
        await db[entidad].update_one({"id": doc_id}, {"$set": {
            "convertido_a": data.destino, "convertido_ref": numero, "estado": "confirmado",
        }})
        return clean(nuevo)

    # destino == "factura"
    if op == "venta":
        cfg = await _get_ajustes()
        sv = cfg.get("series_venta", [])
        if not any(s["nombre"] == serie for s in sv):
            serie = (next((s for s in sv if s.get("por_defecto")), sv[0])["nombre"] if sv else "A")
        fact = await _emitir_factura(
            serie, src.get("contacto_id", ""), src.get("contacto_nombre", ""), src.get("contacto_nif", ""),
            date.today().isoformat(), lineas, base, iva, total, "emitida", "Transferencia",
            f"Generada desde albarán {src.get('numero', '')}",
        )
        await db[entidad].update_one({"id": doc_id}, {"$set": {
            "estado": "facturado", "factura_id": fact["id"], "factura_numero": fact["numero_completo"],
        }})
        return {"tipo": "emitida", **fact}

    # compra → factura recibida
    prov_id = src.get("contacto_id", "")
    if src.get("contacto_nombre") and not prov_id:
        prov = await ensure_proveedor(src.get("contacto_nombre", ""), src.get("contacto_nif", ""))
        if prov:
            prov_id = prov["id"]
    doc = {
        "id": new_id(), "numero_proveedor": "", "tipo_factura": "ordinaria", "rectifica_a": "",
        "proveedor_id": prov_id, "proveedor_nombre": src.get("contacto_nombre", ""),
        "proveedor_nif": src.get("contacto_nif", ""), "fecha": date.today().isoformat(),
        "lineas": lineas, "base_total": base, "iva_total": iva, "total": total,
        "estado": "pendiente", "origen": "albaran", "forma_pago": "Transferencia", "pdf_base64": "",
        "albaranes_ref": [src.get("numero", "")], "albaranes_ids": [doc_id],
        "notas": f"Generada desde albarán {src.get('numero', '')}", "created_at": now_iso(),
    }
    await db.facturas_recibidas.insert_one(dict(doc))
    await db[entidad].update_one({"id": doc_id}, {"$set": {
        "estado": "facturado", "factura_id": doc["id"], "factura_numero": doc["numero_proveedor"] or doc["id"][:8],
    }})
    return {"tipo": "recibida", **clean(doc)}


# ---------------------------------------------------------------------------
# EXTRACCIÓN IA de PDF
# ---------------------------------------------------------------------------
EXTRACCION_PROMPT = """Eres un experto en contabilidad española. Analiza el documento PDF adjunto \
(que puede ser una factura, un albarán o un pedido de un proveedor) y extrae los datos en formato JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional ni markdown, con esta estructura:
{
  "tipo_documento": "factura | albaran | pedido",
  "proveedor": {"nombre": "", "nif": "", "direccion": "", "email": "", "telefono": ""},
  "numero": "número del documento",
  "fecha": "YYYY-MM-DD",
  "lineas": [
    {"descripcion": "", "cantidad": 0, "precio_unitario": 0, "descuento": 0, "tipo_iva": 21}
  ],
  "base_total": 0,
  "iva_total": 0,
  "total": 0,
  "moneda": "EUR"
}

Reglas:
- El NIF/CIF español tiene formato como B12345678 o 12345678Z.
- precio_unitario es el precio sin IVA por unidad.
- tipo_iva es el porcentaje de IVA (21, 10, 4 o 0).
- Si un campo no aparece, usa "" para textos y 0 para números.
- Usa punto decimal, nunca coma."""


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip().rstrip("`").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


@api_router.post("/archivos/subir")
async def subir_archivo(file: UploadFile = File(...)):
    contenido = await file.read()
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se admiten archivos PDF")
    if len(contenido) > 15 * 1024 * 1024:
        raise HTTPException(400, "El PDF no debe superar 15 MB")
    try:
        return await _guardar_pdf(contenido, file.filename)
    except Exception as e:
        logger.exception("Error subiendo PDF")
        raise HTTPException(500, f"No se pudo guardar el archivo: {e}")


@api_router.get("/archivos/{path:path}")
async def obtener_archivo(path: str):
    try:
        data, _ = storage_get(path)
    except Exception:
        raise HTTPException(404, "Archivo no encontrado")
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{path.split("/")[-1]}"'})


@api_router.post("/extraccion/pdf")
async def extraer_pdf(file: UploadFile = File(...), licencia: str = Form("")):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "Falta EMERGENT_LLM_KEY")
    contenido = await file.read()
    suffix = ".pdf" if (file.filename or "").lower().endswith(".pdf") else ""
    tmp_path = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contenido)
            tmp_path = tmp.name
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"extraccion-{new_id()}",
            system_message="Eres un asistente experto en extraer datos estructurados de documentos comerciales.",
        ).with_model("gemini", "gemini-2.5-flash")
        pdf_file = FileContentWithMimeType(file_path=tmp_path, mime_type="application/pdf")
        resp = await chat.send_message_with_tools(UserMessage(text=EXTRACCION_PROMPT, file_contents=[pdf_file]))
        respuesta = resp.content or ""
        datos = _parse_json(respuesta if isinstance(respuesta, str) else str(respuesta))
        # normaliza líneas
        lineas_raw = datos.get("lineas", []) or []
        lineas, base, iva, total = calcular_lineas(lineas_raw)
        datos["lineas"] = lineas
        datos["base_total"] = base
        datos["iva_total"] = iva
        datos["total"] = total if not datos.get("total") else datos.get("total")
        # intenta emparejar proveedor por NIF
        nif = (datos.get("proveedor") or {}).get("nif", "")
        if nif:
            match = await db.contactos.find_one({"tipo": "proveedor", "nif": nif}, {"_id": 0})
            if match:
                datos["proveedor_existente"] = match
        # guarda el PDF original para vista previa / gestión documental
        try:
            datos.update(await _guardar_pdf(contenido, file.filename))
        except Exception:
            logger.warning("No se pudo guardar el PDF original en object storage")
        # registro de consumo de IA (tokens + coste estimado)
        u = resp.usage
        input_tokens = getattr(u, "input_tokens", 0) or 0
        output_tokens = getattr(u, "output_tokens", 0) or 0
        total_tokens = getattr(u, "total_tokens", input_tokens + output_tokens) or (input_tokens + output_tokens)
        coste_eur = round((input_tokens * PRECIO_INPUT_TOKEN + output_tokens * PRECIO_OUTPUT_TOKEN) * USD_EUR, 5)
        consumo = {
            "id": new_id(),
            "tipo": "extraccion_pdf",
            "license_key": licencia or "",
            "archivo": file.filename or "documento.pdf",
            "modelo": "gemini-2.5-flash",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "coste_eur": coste_eur,
            "created_at": now_iso(),
        }
        await db.consumos_ia.insert_one(dict(consumo))
        return {"ok": True, "datos": datos, "consumo": clean(consumo)}
    except json.JSONDecodeError:
        raise HTTPException(422, "No se pudo interpretar la respuesta de la IA")
    except Exception as e:
        logger.exception("Error en extracción PDF")
        raise HTTPException(500, f"Error al procesar el PDF: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@api_router.get("/consumos-ia/resumen")
async def consumos_ia_resumen():
    docs = await db.consumos_ia.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    total_tokens = sum(d.get("total_tokens", 0) for d in docs)
    coste_total = round(sum(d.get("coste_eur", 0) for d in docs), 4)
    return {
        "num_lecturas": len(docs),
        "total_tokens": total_tokens,
        "coste_total_eur": coste_total,
        "ultimas": docs[:10],
    }


@api_router.get("/admin/consumos-ia")
async def admin_consumos_ia(admin: dict = Depends(get_current_admin)):
    """Consumo de IA agregado por cliente/licencia (panel central)."""
    docs = await db.consumos_ia.find({}, {"_id": 0}).sort("created_at", -1).to_list(20000)
    licencias = await db.licencias.find({}, {"_id": 0, "license_key": 1, "empresa": 1}).to_list(5000)
    empresa_por_clave = {l["license_key"]: l.get("empresa", "") for l in licencias}
    por_cliente = {}
    for d in docs:
        key = d.get("license_key") or "__sin_licencia__"
        agg = por_cliente.setdefault(key, {"license_key": d.get("license_key") or "",
                                           "empresa": empresa_por_clave.get(d.get("license_key"), "Sin identificar"),
                                           "num_lecturas": 0, "total_tokens": 0, "coste_total_eur": 0.0})
        agg["num_lecturas"] += 1
        agg["total_tokens"] += d.get("total_tokens", 0)
        agg["coste_total_eur"] += d.get("coste_eur", 0)
    clientes = sorted(por_cliente.values(), key=lambda x: x["coste_total_eur"], reverse=True)
    for c in clientes:
        c["coste_total_eur"] = round(c["coste_total_eur"], 4)
    return {
        "num_lecturas": len(docs),
        "total_tokens": sum(d.get("total_tokens", 0) for d in docs),
        "coste_total_eur": round(sum(d.get("coste_eur", 0) for d in docs), 4),
        "clientes": clientes,
    }


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------
@api_router.get("/dashboard/resumen")
async def dashboard_resumen():
    clientes = await db.contactos.count_documents({"tipo": "cliente"})
    proveedores = await db.contactos.count_documents({"tipo": "proveedor"})
    pedidos = await db.pedidos.count_documents({})
    albaranes = await db.albaranes.count_documents({})
    articulos = await db.articulos.count_documents({})

    emitidas = await db.facturas_emitidas.find({}, {"_id": 0}).to_list(5000)
    recibidas = await db.facturas_recibidas.find({}, {"_id": 0, "pdf_base64": 0}).to_list(5000)

    total_facturado = round(sum(f.get("total", 0) for f in emitidas), 2)
    pendiente_cobro = round(sum(f.get("total", 0) for f in emitidas if f.get("estado") != "cobrada"), 2)
    total_gastos = round(sum(f.get("total", 0) for f in recibidas), 2)
    pendiente_pago = round(sum(f.get("total", 0) for f in recibidas if f.get("estado") != "pagada"), 2)

    # facturación mensual (últimos 6 meses)
    meses = {}
    for f in emitidas:
        mes = (f.get("fecha_expedicion") or "")[:7]
        if mes:
            meses[mes] = meses.get(mes, 0) + f.get("total", 0)
    grafico = [{"mes": k, "total": round(v, 2)} for k, v in sorted(meses.items())][-6:]

    ultimas_emitidas = sorted(emitidas, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    ultimas_recibidas = sorted(recibidas, key=lambda x: x.get("created_at", ""), reverse=True)[:5]

    return {
        "clientes": clientes,
        "proveedores": proveedores,
        "pedidos": pedidos,
        "albaranes": albaranes,
        "articulos": articulos,
        "num_facturas_emitidas": len(emitidas),
        "num_facturas_recibidas": len(recibidas),
        "total_facturado": total_facturado,
        "pendiente_cobro": pendiente_cobro,
        "total_gastos": total_gastos,
        "pendiente_pago": pendiente_pago,
        "grafico_facturacion": grafico,
        "ultimas_emitidas": ultimas_emitidas,
        "ultimas_recibidas": ultimas_recibidas,
    }

# ---------------------------------------------------------------------------
# MÓDULO TALLER (chapa, pintura y mecánica) — Fase 1: Vehículos + Órdenes
# ---------------------------------------------------------------------------
class VehiculoInput(BaseModel):
    matricula: str = ""
    marca: str = ""
    modelo: str = ""
    bastidor: str = ""
    color: str = ""
    kilometros: Optional[int] = None
    combustible: str = ""
    anio: Optional[int] = None
    cliente_id: str = ""
    cliente_nombre: str = ""
    tipo: Literal['cliente', 'cortesia'] = 'cliente'
    notas: str = ""


class Vehiculo(VehiculoInput):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)


async def _normaliza_vehiculo(d: dict) -> dict:
    if d.get("matricula"):
        d["matricula"] = d["matricula"].upper().strip()
    if d.get("cliente_id"):
        cli = await db.contactos.find_one({"id": d["cliente_id"]}, {"_id": 0})
        if cli:
            d["cliente_nombre"] = cli.get("nombre", "")
    return d


@api_router.post("/taller/vehiculos")
async def crear_vehiculo(data: VehiculoInput):
    d = await _normaliza_vehiculo(data.model_dump())
    v = Vehiculo(**d)
    await db.vehiculos.insert_one(v.model_dump())
    return v.model_dump()


@api_router.get("/taller/vehiculos")
async def listar_vehiculos(q: Optional[str] = None):
    docs = await db.vehiculos.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    if q:
        ql = q.lower()
        docs = [d for d in docs if ql in " ".join([
            d.get("matricula", ""), d.get("marca", ""), d.get("modelo", ""),
            d.get("bastidor", ""), d.get("cliente_nombre", "")]).lower()]
    return docs


@api_router.get("/taller/vehiculos/{vid}")
async def obtener_vehiculo(vid: str):
    doc = await db.vehiculos.find_one({"id": vid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Vehículo no encontrado")
    return doc


@api_router.get("/taller/vehiculos/{vid}/ficha")
async def ficha_vehiculo(vid: str):
    v = await db.vehiculos.find_one({"id": vid}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vehículo no encontrado")
    ordenes = await db.ordenes_trabajo.find({"vehiculo_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    peritajes = await db.peritajes.find({"vehiculo_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    presupuestos = await db.presupuestos.find({"vehiculo_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    prestamos = await db.prestamos.find({"vehiculo_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    citas = await db.citas.find({"vehiculo_id": vid}, {"_id": 0}).sort("fecha", -1).to_list(500)
    compras = []
    for col, etiqueta in [("pedidos", "Pedido"), ("albaranes", "Albarán"), ("facturas_recibidas", "Factura")]:
        docs = await db[col].find({"vehiculo_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(500)
        for d in docs:
            compras.append({
                "tipo": etiqueta,
                "id": d.get("id"),
                "numero": d.get("numero") or d.get("numero_proveedor") or "",
                "fecha": d.get("fecha", ""),
                "proveedor": d.get("contacto_nombre") or d.get("proveedor_nombre") or "",
                "total": d.get("total", 0),
            })
    coste_compras = round(sum(c["total"] for c in compras), 2)
    return {"vehiculo": v, "ordenes": ordenes, "peritajes": peritajes, "presupuestos": presupuestos,
            "prestamos": prestamos, "citas": citas, "compras": compras, "coste_compras": coste_compras}


@api_router.put("/taller/vehiculos/{vid}")
async def actualizar_vehiculo(vid: str, data: VehiculoInput):
    d = await _normaliza_vehiculo(data.model_dump())
    res = await db.vehiculos.update_one({"id": vid}, {"$set": d})
    if res.matched_count == 0:
        raise HTTPException(404, "Vehículo no encontrado")
    return await db.vehiculos.find_one({"id": vid}, {"_id": 0})


@api_router.delete("/taller/vehiculos/{vid}")
async def eliminar_vehiculo(vid: str):
    await db.vehiculos.delete_one({"id": vid})
    return {"ok": True}


# ---- Órdenes de trabajo ----
ESTADOS_OT = ['recepcion', 'en_curso', 'finalizado', 'entregado']


class OrdenTrabajoInput(BaseModel):
    vehiculo_id: str = ""
    vehiculo_matricula: str = ""
    cliente_id: str = ""
    cliente_nombre: str = ""
    tipos_trabajo: List[str] = []   # chapa / pintura / mecanica
    descripcion: str = ""
    estado: Literal['recepcion', 'en_curso', 'finalizado', 'entregado'] = 'recepcion'
    fecha_entrada: str = ""
    fecha_entrega_estimada: str = ""
    lineas: List[LineaItem] = []
    notas: str = ""


class OrdenTrabajo(OrdenTrabajoInput):
    id: str = Field(default_factory=new_id)
    numero: str = ""
    base: float = 0
    cuota_iva: float = 0
    total: float = 0
    created_at: str = Field(default_factory=now_iso)


async def _rellena_orden(d: dict) -> dict:
    if d.get("vehiculo_id"):
        v = await db.vehiculos.find_one({"id": d["vehiculo_id"]}, {"_id": 0})
        if v:
            d["vehiculo_matricula"] = v.get("matricula", "")
            if not d.get("cliente_id"):
                d["cliente_id"] = v.get("cliente_id", "")
                d["cliente_nombre"] = v.get("cliente_nombre", "")
    if d.get("cliente_id") and not d.get("cliente_nombre"):
        cli = await db.contactos.find_one({"id": d["cliente_id"]}, {"_id": 0})
        if cli:
            d["cliente_nombre"] = cli.get("nombre", "")
    lineas, base, iva, total = calcular_lineas(d.get("lineas", []))
    d["lineas"] = lineas
    d["base"], d["cuota_iva"], d["total"] = base, iva, total
    return d


@api_router.post("/taller/ordenes")
async def crear_orden(data: OrdenTrabajoInput):
    d = await _rellena_orden(data.model_dump())
    n = await _next_seq("orden_trabajo")
    d["numero"] = f"OT-{n:06d}"
    o = OrdenTrabajo(**d)
    await db.ordenes_trabajo.insert_one(o.model_dump())
    return o.model_dump()


@api_router.get("/taller/ordenes")
async def listar_ordenes(vehiculo_id: Optional[str] = None):
    q = {}
    if vehiculo_id:
        q["vehiculo_id"] = vehiculo_id
    return await db.ordenes_trabajo.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.get("/taller/ordenes/{oid}")
async def obtener_orden(oid: str):
    doc = await db.ordenes_trabajo.find_one({"id": oid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Orden no encontrada")
    return doc


@api_router.put("/taller/ordenes/{oid}")
async def actualizar_orden(oid: str, data: OrdenTrabajoInput):
    existing = await db.ordenes_trabajo.find_one({"id": oid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Orden no encontrada")
    d = await _rellena_orden(data.model_dump())
    d["numero"] = existing.get("numero", "")
    await db.ordenes_trabajo.update_one({"id": oid}, {"$set": d})
    return await db.ordenes_trabajo.find_one({"id": oid}, {"_id": 0})


@api_router.patch("/taller/ordenes/{oid}/estado")
async def estado_orden(oid: str, estado: str = Form(...)):
    if estado not in ESTADOS_OT:
        raise HTTPException(400, "Estado inválido")
    res = await db.ordenes_trabajo.update_one({"id": oid}, {"$set": {"estado": estado}})
    if res.matched_count == 0:
        raise HTTPException(404, "Orden no encontrada")
    return await db.ordenes_trabajo.find_one({"id": oid}, {"_id": 0})


@api_router.delete("/taller/ordenes/{oid}")
async def eliminar_orden(oid: str):
    await db.ordenes_trabajo.delete_one({"id": oid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# TALLER — FASE 2: Peritajes, Compañías de seguros, Fotos (subida + QR)
# ---------------------------------------------------------------------------
_TALLER_COLS = {"peritajes": "peritajes", "vehiculos": "vehiculos", "ordenes": "ordenes_trabajo"}


async def _guardar_media(contenido: bytes, filename: str, content_type: str) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else "bin"
    path = f"{APP_NAME}/media/{new_id()}.{ext}"
    res = storage_put(path, contenido, content_type or "application/octet-stream")
    return {"path": res.get("path", path), "filename": filename or "archivo", "content_type": content_type or ""}


async def _append_foto(col: str, eid: str, file: UploadFile) -> dict:
    contenido = await file.read()
    ct = file.content_type or ""
    if not (ct.startswith("image/") or ct == "application/pdf"):
        raise HTTPException(400, "Solo se admiten imágenes o PDF")
    if len(contenido) > 15 * 1024 * 1024:
        raise HTTPException(400, "El archivo no debe superar 15 MB")
    media = await _guardar_media(contenido, file.filename, ct)
    foto = {"path": media["path"], "filename": media["filename"], "content_type": ct, "created_at": now_iso()}
    res = await db[col].update_one({"id": eid}, {"$push": {"fotos": foto}})
    if res.matched_count == 0:
        raise HTTPException(404, "Registro no encontrado")
    return foto


@api_router.get("/taller/media/{path:path}")
async def obtener_media(path: str):
    try:
        data, ct = storage_get(path)
    except Exception:
        raise HTTPException(404, "Archivo no encontrado")
    return Response(content=data, media_type=ct or "application/octet-stream",
                    headers={"Content-Disposition": f'inline; filename="{path.split("/")[-1]}"'})


@api_router.post("/taller/{tipo}/{eid}/fotos")
async def subir_foto(tipo: str, eid: str, file: UploadFile = File(...)):
    col = _TALLER_COLS.get(tipo)
    if not col:
        raise HTTPException(404, "Tipo no válido")
    return await _append_foto(col, eid, file)


@api_router.delete("/taller/{tipo}/{eid}/fotos")
async def borrar_foto(tipo: str, eid: str, path: str):
    col = _TALLER_COLS.get(tipo)
    if not col:
        raise HTTPException(404, "Tipo no válido")
    await db[col].update_one({"id": eid}, {"$pull": {"fotos": {"path": path}}})
    return {"ok": True}


# ---- Sesiones de subida por QR (públicas) ----
class FotoSesionInput(BaseModel):
    tipo: str
    entidad_id: str


@api_router.post("/taller/foto-sesion")
async def crear_foto_sesion(data: FotoSesionInput):
    if data.tipo not in _TALLER_COLS:
        raise HTTPException(400, "Tipo no válido")
    token = uuid.uuid4().hex[:10]
    await db.foto_sesiones.insert_one({
        "token": token, "tipo": data.tipo, "entidad_id": data.entidad_id, "created_at": now_iso(),
    })
    return {"token": token}


@api_router.get("/taller/subida/{token}")
async def info_subida(token: str):
    s = await db.foto_sesiones.find_one({"token": token}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Enlace de subida no válido o caducado")
    col = _TALLER_COLS[s["tipo"]]
    ent = await db[col].find_one({"id": s["entidad_id"]}, {"_id": 0})
    label = ""
    if ent:
        label = ent.get("matricula") or ent.get("vehiculo_matricula") or ent.get("numero") or ""
    total = len(ent.get("fotos", [])) if ent else 0
    return {"tipo": s["tipo"], "label": label, "total": total}


@api_router.post("/taller/subida/{token}")
async def subir_foto_token(token: str, file: UploadFile = File(...)):
    s = await db.foto_sesiones.find_one({"token": token})
    if not s:
        raise HTTPException(404, "Enlace de subida no válido o caducado")
    col = _TALLER_COLS[s["tipo"]]
    foto = await _append_foto(col, s["entidad_id"], file)
    ent = await db[col].find_one({"id": s["entidad_id"]}, {"_id": 0})
    return {"ok": True, "total": len(ent.get("fotos", [])) if ent else 0, "foto": foto}


# ---- Compañías de seguros ----
class CompaniaInput(BaseModel):
    nombre: str
    cif: str = ""
    telefono: str = ""
    email: str = ""


class Compania(CompaniaInput):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)


@api_router.post("/taller/companias")
async def crear_compania(data: CompaniaInput):
    c = Compania(**data.model_dump())
    await db.companias.insert_one(c.model_dump())
    return c.model_dump()


@api_router.get("/taller/companias")
async def listar_companias():
    return await db.companias.find({}, {"_id": 0}).sort("nombre", 1).to_list(1000)


@api_router.put("/taller/companias/{cid}")
async def actualizar_compania(cid: str, data: CompaniaInput):
    res = await db.companias.update_one({"id": cid}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Compañía no encontrada")
    return await db.companias.find_one({"id": cid}, {"_id": 0})


@api_router.delete("/taller/companias/{cid}")
async def eliminar_compania(cid: str):
    await db.companias.delete_one({"id": cid})
    return {"ok": True}


# ---- Peritajes ----
ESTADOS_PERITAJE = ['pendiente', 'valorado', 'aprobado', 'rechazado']


class DanioItem(BaseModel):
    descripcion: str = ""
    importe: float = 0


class PeritajeInput(BaseModel):
    vehiculo_id: str = ""
    vehiculo_matricula: str = ""
    cliente_id: str = ""
    cliente_nombre: str = ""
    compania: str = ""
    poliza: str = ""
    siniestro: str = ""
    descripcion: str = ""
    danios: List[DanioItem] = []
    estado: Literal['pendiente', 'valorado', 'aprobado', 'rechazado'] = 'pendiente'
    fecha: str = ""


class Peritaje(PeritajeInput):
    id: str = Field(default_factory=new_id)
    numero: str = ""
    importe_total: float = 0
    fotos: List[dict] = []
    created_at: str = Field(default_factory=now_iso)


async def _rellena_peritaje(d: dict) -> dict:
    if d.get("vehiculo_id"):
        v = await db.vehiculos.find_one({"id": d["vehiculo_id"]}, {"_id": 0})
        if v:
            d["vehiculo_matricula"] = v.get("matricula", "")
            if not d.get("cliente_id"):
                d["cliente_id"] = v.get("cliente_id", "")
                d["cliente_nombre"] = v.get("cliente_nombre", "")
    if d.get("cliente_id") and not d.get("cliente_nombre"):
        cli = await db.contactos.find_one({"id": d["cliente_id"]}, {"_id": 0})
        if cli:
            d["cliente_nombre"] = cli.get("nombre", "")
    d["importe_total"] = round(sum(float(x.get("importe", 0) or 0) for x in d.get("danios", [])), 2)
    return d


@api_router.post("/taller/peritajes")
async def crear_peritaje(data: PeritajeInput):
    d = await _rellena_peritaje(data.model_dump())
    n = await _next_seq("peritaje")
    d["numero"] = f"PER-{n:06d}"
    p = Peritaje(**d)
    await db.peritajes.insert_one(p.model_dump())
    return p.model_dump()


@api_router.get("/taller/peritajes")
async def listar_peritajes(vehiculo_id: Optional[str] = None):
    q = {}
    if vehiculo_id:
        q["vehiculo_id"] = vehiculo_id
    return await db.peritajes.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.get("/taller/peritajes/{pid}")
async def obtener_peritaje(pid: str):
    doc = await db.peritajes.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Peritaje no encontrado")
    return doc


@api_router.put("/taller/peritajes/{pid}")
async def actualizar_peritaje(pid: str, data: PeritajeInput):
    existing = await db.peritajes.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Peritaje no encontrado")
    d = await _rellena_peritaje(data.model_dump())
    d["numero"] = existing.get("numero", "")
    await db.peritajes.update_one({"id": pid}, {"$set": d})
    return await db.peritajes.find_one({"id": pid}, {"_id": 0})


@api_router.patch("/taller/peritajes/{pid}/estado")
async def estado_peritaje(pid: str, estado: str = Form(...)):
    if estado not in ESTADOS_PERITAJE:
        raise HTTPException(400, "Estado inválido")
    res = await db.peritajes.update_one({"id": pid}, {"$set": {"estado": estado}})
    if res.matched_count == 0:
        raise HTTPException(404, "Peritaje no encontrado")
    return await db.peritajes.find_one({"id": pid}, {"_id": 0})


@api_router.delete("/taller/peritajes/{pid}")
async def eliminar_peritaje(pid: str):
    await db.peritajes.delete_one({"id": pid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# TALLER — FASE 3: Citas + Vehículos de cortesía (préstamos)
# ---------------------------------------------------------------------------
ESTADOS_CITA = ['pendiente', 'confirmada', 'realizada', 'cancelada']


class CitaInput(BaseModel):
    vehiculo_id: str = ""
    vehiculo_matricula: str = ""
    cliente_id: str = ""
    cliente_nombre: str = ""
    fecha: str = ""          # ISO datetime-local (YYYY-MM-DDTHH:MM)
    duracion_min: int = 60
    motivo: str = ""
    tipo_trabajo: str = ""   # chapa / pintura / mecanica / revision
    estado: Literal['pendiente', 'confirmada', 'realizada', 'cancelada'] = 'pendiente'
    notas: str = ""


class Cita(CitaInput):
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)


async def _rellena_cita(d: dict) -> dict:
    if d.get("vehiculo_id"):
        v = await db.vehiculos.find_one({"id": d["vehiculo_id"]}, {"_id": 0})
        if v:
            d["vehiculo_matricula"] = v.get("matricula", "")
            if not d.get("cliente_id"):
                d["cliente_id"] = v.get("cliente_id", "")
                d["cliente_nombre"] = v.get("cliente_nombre", "")
    if d.get("cliente_id") and not d.get("cliente_nombre"):
        cli = await db.contactos.find_one({"id": d["cliente_id"]}, {"_id": 0})
        if cli:
            d["cliente_nombre"] = cli.get("nombre", "")
    return d


@api_router.post("/taller/citas")
async def crear_cita(data: CitaInput):
    d = await _rellena_cita(data.model_dump())
    c = Cita(**d)
    await db.citas.insert_one(c.model_dump())
    return c.model_dump()


@api_router.get("/taller/citas")
async def listar_citas(vehiculo_id: Optional[str] = None, desde: Optional[str] = None, hasta: Optional[str] = None):
    q = {}
    if vehiculo_id:
        q["vehiculo_id"] = vehiculo_id
    if desde or hasta:
        rng = {}
        if desde:
            rng["$gte"] = desde
        if hasta:
            rng["$lte"] = hasta
        q["fecha"] = rng
    return await db.citas.find(q, {"_id": 0}).sort("fecha", 1).to_list(3000)


@api_router.put("/taller/citas/{cid}")
async def actualizar_cita(cid: str, data: CitaInput):
    d = await _rellena_cita(data.model_dump())
    res = await db.citas.update_one({"id": cid}, {"$set": d})
    if res.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return await db.citas.find_one({"id": cid}, {"_id": 0})


@api_router.patch("/taller/citas/{cid}/estado")
async def estado_cita(cid: str, estado: str = Form(...)):
    if estado not in ESTADOS_CITA:
        raise HTTPException(400, "Estado inválido")
    res = await db.citas.update_one({"id": cid}, {"$set": {"estado": estado}})
    if res.matched_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return await db.citas.find_one({"id": cid}, {"_id": 0})


@api_router.delete("/taller/citas/{cid}")
async def eliminar_cita(cid: str):
    await db.citas.delete_one({"id": cid})
    return {"ok": True}


# ---- Vehículos de cortesía: préstamos ----
class PrestamoInput(BaseModel):
    vehiculo_id: str = ""            # vehículo de cortesía (tipo=cortesia)
    vehiculo_matricula: str = ""
    cliente_id: str = ""
    cliente_nombre: str = ""
    vehiculo_cliente_id: str = ""    # vehículo del cliente que está en reparación (opcional)
    fecha_entrega: str = ""
    fecha_devolucion_prevista: str = ""
    fecha_devolucion_real: str = ""
    km_entrega: Optional[int] = None
    km_devolucion: Optional[int] = None
    estado: Literal['activo', 'devuelto'] = 'activo'
    notas: str = ""


class Prestamo(PrestamoInput):
    id: str = Field(default_factory=new_id)
    contrato_path: str = ""
    contrato_filename: str = ""
    created_at: str = Field(default_factory=now_iso)


@api_router.post("/taller/prestamos")
async def crear_prestamo(data: PrestamoInput):
    d = data.model_dump()
    if d.get("vehiculo_id"):
        v = await db.vehiculos.find_one({"id": d["vehiculo_id"]}, {"_id": 0})
        if v:
            d["vehiculo_matricula"] = v.get("matricula", "")
    if d.get("cliente_id") and not d.get("cliente_nombre"):
        cli = await db.contactos.find_one({"id": d["cliente_id"]}, {"_id": 0})
        if cli:
            d["cliente_nombre"] = cli.get("nombre", "")
    p = Prestamo(**d)
    await db.prestamos.insert_one(p.model_dump())
    return p.model_dump()


@api_router.get("/taller/prestamos")
async def listar_prestamos(estado: Optional[str] = None):
    q = {}
    if estado:
        q["estado"] = estado
    return await db.prestamos.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.put("/taller/prestamos/{pid}")
async def actualizar_prestamo(pid: str, data: PrestamoInput):
    existing = await db.prestamos.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Préstamo no encontrado")
    d = data.model_dump()
    if d.get("vehiculo_id"):
        v = await db.vehiculos.find_one({"id": d["vehiculo_id"]}, {"_id": 0})
        if v:
            d["vehiculo_matricula"] = v.get("matricula", "")
    if d.get("cliente_id") and not d.get("cliente_nombre"):
        cli = await db.contactos.find_one({"id": d["cliente_id"]}, {"_id": 0})
        if cli:
            d["cliente_nombre"] = cli.get("nombre", "")
    await db.prestamos.update_one({"id": pid}, {"$set": d})
    return await db.prestamos.find_one({"id": pid}, {"_id": 0})


@api_router.post("/taller/prestamos/{pid}/contrato")
async def subir_contrato(pid: str, file: UploadFile = File(...)):
    contenido = await file.read()
    ct = file.content_type or ""
    if not (ct.startswith("image/") or ct == "application/pdf"):
        raise HTTPException(400, "El contrato debe ser una imagen o PDF")
    if len(contenido) > 15 * 1024 * 1024:
        raise HTTPException(400, "El archivo no debe superar 15 MB")
    media = await _guardar_media(contenido, file.filename, ct)
    res = await db.prestamos.update_one({"id": pid}, {"$set": {
        "contrato_path": media["path"], "contrato_filename": media["filename"]}})
    if res.matched_count == 0:
        raise HTTPException(404, "Préstamo no encontrado")
    return {"contrato_path": media["path"], "contrato_filename": media["filename"]}


@api_router.delete("/taller/prestamos/{pid}")
async def eliminar_prestamo(pid: str):
    await db.prestamos.delete_one({"id": pid})
    return {"ok": True}


@api_router.get("/taller/resumen")
async def taller_resumen():
    hoy = date.today().isoformat()
    ordenes = await db.ordenes_trabajo.find({}, {"_id": 0}).to_list(5000)
    por_estado = {e: 0 for e in ESTADOS_OT}
    for o in ordenes:
        est = o.get("estado", "recepcion")
        por_estado[est] = por_estado.get(est, 0) + 1
    abiertas = len([o for o in ordenes if o.get("estado") in ("recepcion", "en_curso")])
    citas_hoy = await db.citas.find(
        {"fecha": {"$gte": hoy + "T00:00", "$lte": hoy + "T23:59"}}, {"_id": 0}
    ).sort("fecha", 1).to_list(200)
    proximas = await db.citas.find(
        {"fecha": {"$gt": hoy + "T23:59"}}, {"_id": 0}
    ).sort("fecha", 1).to_list(6)
    peritajes_pend = await db.peritajes.count_documents({"estado": {"$in": ["pendiente", "valorado"]}})
    cortesias = await db.prestamos.find({"estado": "activo"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    total_vehiculos = await db.vehiculos.count_documents({})
    ultimas = sorted(ordenes, key=lambda x: x.get("created_at", ""), reverse=True)[:6]
    return {
        "total_vehiculos": total_vehiculos,
        "ordenes_por_estado": por_estado,
        "ordenes_abiertas": abiertas,
        "citas_hoy": citas_hoy,
        "proximas_citas": proximas,
        "peritajes_pendientes": peritajes_pend,
        "cortesias_activas": cortesias,
        "ultimas_ordenes": ultimas,
    }










@api_router.get("/")
async def root():
    return {"message": "ERP Base API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_seed():
    # Índices
    try:
        await db.users.create_index("email", unique=True)
        await db.licencias.create_index("license_key", unique=True)
    except Exception as e:
        logger.warning(f"Index warning: {e}")
    # Admin idempotente
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@nexopro.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234!")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Administrador", "role": "admin", "created_at": now_iso(),
        })
        logger.info("Admin creado")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    # Licencia demo idempotente
    demo_key = os.environ.get("DEMO_LICENSE_KEY", "NEXO-DEMO-0001")
    if not await db.licencias.find_one({"license_key": demo_key}):
        await db.licencias.insert_one({
            "id": new_id(), "license_key": demo_key, "empresa": "Empresa Demo SL",
            "email": "demo@empresa.es", "telefono": "", "precio_mensual": 29,
            "estado": "activa", "ultimo_pago": None, "proximo_pago": None,
            "notas": "Licencia de demostración", "created_at": now_iso(),
        })


    # Contador de referencias de artículo (evita colisión con los existentes)
    if not await db.counters.find_one({"_id": "articulo_ref"}):
        existentes = await db.articulos.count_documents({})
        await db.counters.insert_one({"_id": "articulo_ref", "seq": existentes})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
