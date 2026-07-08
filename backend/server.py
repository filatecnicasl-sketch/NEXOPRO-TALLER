from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
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
    albaranes_ids: List[str] = []
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
        "albaranes_ids": data.albaranes_ids,
        "conciliacion": conciliacion,
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
