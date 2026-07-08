from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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
    notas: str = ""


class LineaItem(BaseModel):
    codigo_proveedor: str = ""
    descripcion: str = ""
    cantidad: float = 1
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
    pdf_base64: str = ""
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
    referencia: str = ""
    nombre: str
    descripcion: str = ""
    precio: float = 0
    tipo_iva: float = 21
    unidad: str = "ud"
    codigo_proveedor: str = ""
    codigo_propio: str = ""
    codigo_barras: str = ""
    notas: str = ""


@api_router.post("/articulos")
async def crear_articulo(data: ArticuloInput):
    d = data.model_dump()
    doc = {"id": new_id(), **d, "nombre_lower": d["nombre"].strip().lower(),
           "origenes": [], "auto": False, "created_at": now_iso()}
    await db.articulos.insert_one(dict(doc))
    return clean(doc)


@api_router.get("/articulos")
async def listar_articulos():
    return await db.articulos.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.put("/articulos/{articulo_id}")
async def actualizar_articulo(articulo_id: str, data: ArticuloInput):
    d = data.model_dump()
    d["nombre_lower"] = d["nombre"].strip().lower()
    res = await db.articulos.update_one({"id": articulo_id}, {"$set": d})
    if res.matched_count == 0:
        raise HTTPException(404, "Artículo no encontrado")
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
                "id": new_id(), "referencia": "", "nombre": nombre,
                "nombre_lower": nombre.lower(), "descripcion": "",
                "precio": l.get("precio_unitario", 0), "tipo_iva": l.get("tipo_iva", 21),
                "unidad": "ud", "codigo_proveedor": cod_prov, "codigo_propio": "",
                "codigo_barras": "", "notas": "", "origenes": [entry], "auto": True,
                "created_at": now_iso(),
            }
            await db.articulos.insert_one(dict(art))



# ---------------------------------------------------------------------------
# DOCUMENTOS genéricos (Pedidos / Albaranes)
# ---------------------------------------------------------------------------
async def _next_numero(coleccion: str, prefijo: str) -> str:
    year = datetime.now().year
    count = await db[coleccion].count_documents({}) + 1
    return f"{prefijo}-{year}-{count:04d}"


def _build_documento(data: DocumentoInput, numero: str):
    lineas, base, iva, total = calcular_lineas([l.model_dump() for l in data.lineas])
    return {
        "id": new_id(),
        "numero": numero,
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
        numero = await _next_numero(coleccion, prefijo)
        doc = _build_documento(data, numero)
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


@api_router.post("/facturas-emitidas")
async def crear_factura_emitida(data: FacturaEmitidaInput):
    year = datetime.now().year
    count = await db.facturas_emitidas.count_documents({"serie": data.serie}) + 1
    numero = f"{count:04d}"
    numero_completo = f"{data.serie}{year}-{numero}"
    lineas, base, iva, total = calcular_lineas([l.model_dump() for l in data.lineas])
    verifactu = await _generar_verifactu(data.serie, numero_completo, data.fecha_expedicion, data.cliente_nif or "B00000000", total)
    doc = {
        "id": new_id(),
        "serie": data.serie,
        "numero": numero,
        "numero_completo": numero_completo,
        "cliente_id": data.cliente_id,
        "cliente_nombre": data.cliente_nombre,
        "cliente_nif": data.cliente_nif,
        "fecha_expedicion": data.fecha_expedicion,
        "lineas": lineas,
        "base_total": base,
        "iva_total": iva,
        "total": total,
        "estado": data.estado,
        "verifactu": verifactu,
        "notas": data.notas,
        "created_at": now_iso(),
    }
    await db.facturas_emitidas.insert_one(dict(doc))
    return clean(doc)


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


@api_router.delete("/facturas-emitidas/{doc_id}")
async def eliminar_factura_emitida(doc_id: str):
    await db.facturas_emitidas.delete_one({"id": doc_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# FACTURAS RECIBIDAS
# ---------------------------------------------------------------------------
@api_router.post("/facturas-recibidas")
async def crear_factura_recibida(data: FacturaRecibidaInput):
    lineas, base, iva, total = calcular_lineas([l.model_dump() for l in data.lineas])
    doc = {
        "id": new_id(),
        "numero_proveedor": data.numero_proveedor,
        "proveedor_id": data.proveedor_id,
        "proveedor_nombre": data.proveedor_nombre,
        "proveedor_nif": data.proveedor_nif,
        "fecha": data.fecha,
        "lineas": lineas,
        "base_total": base,
        "iva_total": iva,
        "total": total,
        "estado": data.estado,
        "origen": data.origen,
        "pdf_base64": data.pdf_base64,
        "notas": data.notas,
        "created_at": now_iso(),
    }
    await db.facturas_recibidas.insert_one(dict(doc))
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


@api_router.delete("/facturas-recibidas/{doc_id}")
async def eliminar_factura_recibida(doc_id: str):
    await db.facturas_recibidas.delete_one({"id": doc_id})
    return {"ok": True}


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
async def extraer_pdf(file: UploadFile = File(...)):
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
        respuesta = await chat.send_message(UserMessage(text=EXTRACCION_PROMPT, file_contents=[pdf_file]))
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
        return {"ok": True, "datos": datos}
    except json.JSONDecodeError:
        raise HTTPException(422, "No se pudo interpretar la respuesta de la IA")
    except Exception as e:
        logger.exception("Error en extracción PDF")
        raise HTTPException(500, f"Error al procesar el PDF: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
