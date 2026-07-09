import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

// Facturae 3.2.2 (descarga XML)
export const facturaeUrl = (id) => `${API}/facturas-emitidas/${id}/facturae`;

// Hoja de entrada de taller (PDF A4 horizontal generado en servidor)
export const hojaEntradaUrl = (id) => `${API}/taller/ordenes/${id}/hoja-entrada.pdf`;
// Parte de trabajo (PDF A4 generado en servidor)
export const parteTrabajoUrl = (id) => `${API}/taller/ordenes/${id}/parte-trabajo.pdf`;

// Descarga fiable de un PDF (funciona en todos los navegadores, sin ventanas emergentes)
export async function descargarPdf(url, filename) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("No se pudo generar el PDF");
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename || "documento.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

// Imprime un PDF directamente: abre el diálogo de imprimir del navegador sin descargar.
// Usa un iframe oculto con el PDF (fiable en Chrome de escritorio, sin ventanas emergentes).
// Si el navegador no lo permite, abre el PDF en una pestaña nueva como respaldo.
export async function imprimirPdf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("No se pudo generar el PDF");
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);

  const prev = document.getElementById("__print_frame__");
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_frame__";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  let done = false;
  const fallback = () => { try { window.open(objUrl, "_blank"); } catch (e) { /* noop */ } };

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        done = true;
      } catch (e) {
        fallback();
      }
    }, 400);
  };

  document.body.appendChild(iframe);
  iframe.src = objUrl;

  // Respaldo si el iframe no llega a cargar (algunos navegadores/config)
  setTimeout(() => { if (!done) fallback(); }, 4000);
  setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
}

// Gestión documental (PDF original)
export const uploadArchivo = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post("/archivos/subir", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const archivoUrl = (path) => `${API}/archivos/${path}`;

// Contactos
export const getContactos = (tipo) => client.get("/contactos", { params: { tipo } }).then((r) => r.data);
export const createContacto = (data) => client.post("/contactos", data).then((r) => r.data);
export const updateContacto = (id, data) => client.put(`/contactos/${id}`, data).then((r) => r.data);
export const deleteContacto = (id) => client.delete(`/contactos/${id}`).then((r) => r.data);

// Artículos
export const getArticulos = () => client.get("/articulos").then((r) => r.data);
export const createArticulo = (data) => client.post("/articulos", data).then((r) => r.data);
export const updateArticulo = (id, data) => client.put(`/articulos/${id}`, data).then((r) => r.data);
export const deleteArticulo = (id) => client.delete(`/articulos/${id}`).then((r) => r.data);

// Documentos genéricos
export const getDocumentos = (entidad) => client.get(`/${entidad}`).then((r) => r.data);
export const createDocumento = (entidad, data) => client.post(`/${entidad}`, data).then((r) => r.data);
export const updateDocumento = (entidad, id, data) => client.put(`/${entidad}/${id}`, data).then((r) => r.data);
export const deleteDocumento = (entidad, id) => client.delete(`/${entidad}/${id}`).then((r) => r.data);
export const convertirDocumento = (entidad, id, destino) => client.post(`/documentos/${entidad}/${id}/convertir`, { destino }).then((r) => r.data);
export const getAlbaranesCompraPendientes = (params) => client.get("/albaranes-compra-pendientes", { params }).then((r) => r.data);

// Facturas emitidas
export const getFacturasEmitidas = () => client.get("/facturas-emitidas").then((r) => r.data);
export const getFacturaEmitida = (id) => client.get(`/facturas-emitidas/${id}`).then((r) => r.data);
export const createFacturaEmitida = (data) => client.post("/facturas-emitidas", data).then((r) => r.data);
export const estadoFacturaEmitida = (id, estado) => {
  const fd = new FormData();
  fd.append("estado", estado);
  return client.patch(`/facturas-emitidas/${id}/estado`, fd).then((r) => r.data);
};
export const rectificarFacturaEmitida = (id) => client.post(`/facturas-emitidas/${id}/rectificar`, {}).then((r) => r.data);
export const deleteFacturaEmitida = (id) => client.delete(`/facturas-emitidas/${id}`).then((r) => r.data);

// Facturas recibidas
export const getFacturasRecibidas = () => client.get("/facturas-recibidas").then((r) => r.data);
export const getFacturaRecibida = (id) => client.get(`/facturas-recibidas/${id}`).then((r) => r.data);
export const createFacturaRecibida = (data) => client.post("/facturas-recibidas", data).then((r) => r.data);
export const estadoFacturaRecibida = (id, estado) => {
  const fd = new FormData();
  fd.append("estado", estado);
  return client.patch(`/facturas-recibidas/${id}/estado`, fd).then((r) => r.data);
};
export const rectificarFacturaRecibida = (id) => client.post(`/facturas-recibidas/${id}/rectificar`, {}).then((r) => r.data);
export const deleteFacturaRecibida = (id) => client.delete(`/facturas-recibidas/${id}`).then((r) => r.data);

// Extracción IA
export const extraerPdf = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  const lic = localStorage.getItem("nexopro_license") || process.env.REACT_APP_LICENSE_KEY || "";
  fd.append("licencia", lic);
  return client.post("/extraccion/pdf", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// Ajustes (series de documentos + datos de empresa)
export const getAjustes = () => client.get("/ajustes").then((r) => r.data);
export const updateAjustes = (data) => client.put("/ajustes", data).then((r) => r.data);

// Taller — Vehículos
export const getVehiculos = (q) => client.get("/taller/vehiculos", { params: { q } }).then((r) => r.data);
export const getVehiculoFicha = (id) => client.get(`/taller/vehiculos/${id}/ficha`).then((r) => r.data);
export const createVehiculo = (data) => client.post("/taller/vehiculos", data).then((r) => r.data);
export const updateVehiculo = (id, data) => client.put(`/taller/vehiculos/${id}`, data).then((r) => r.data);
export const deleteVehiculo = (id) => client.delete(`/taller/vehiculos/${id}`).then((r) => r.data);

// Taller — Órdenes de trabajo
export const getOrdenes = (vehiculo_id) => client.get("/taller/ordenes", { params: { vehiculo_id } }).then((r) => r.data);
export const getOrden = (id) => client.get(`/taller/ordenes/${id}`).then((r) => r.data);
export const createOrden = (data) => client.post("/taller/ordenes", data).then((r) => r.data);
export const updateOrden = (id, data) => client.put(`/taller/ordenes/${id}`, data).then((r) => r.data);
export const estadoOrden = (id, estado) => {
  const fd = new FormData();
  fd.append("estado", estado);
  return client.patch(`/taller/ordenes/${id}/estado`, fd).then((r) => r.data);
};
export const deleteOrden = (id) => client.delete(`/taller/ordenes/${id}`).then((r) => r.data);

// Taller — Compañías de seguros
export const getCompanias = () => client.get("/taller/companias").then((r) => r.data);
export const createCompania = (data) => client.post("/taller/companias", data).then((r) => r.data);
export const updateCompania = (id, data) => client.put(`/taller/companias/${id}`, data).then((r) => r.data);
export const deleteCompania = (id) => client.delete(`/taller/companias/${id}`).then((r) => r.data);

// Taller — Peritajes
export const getPeritajes = (vehiculo_id) => client.get("/taller/peritajes", { params: { vehiculo_id } }).then((r) => r.data);
export const getPeritaje = (id) => client.get(`/taller/peritajes/${id}`).then((r) => r.data);
export const createPeritaje = (data) => client.post("/taller/peritajes", data).then((r) => r.data);
export const updatePeritaje = (id, data) => client.put(`/taller/peritajes/${id}`, data).then((r) => r.data);
export const estadoPeritaje = (id, estado) => {
  const fd = new FormData();
  fd.append("estado", estado);
  return client.patch(`/taller/peritajes/${id}/estado`, fd).then((r) => r.data);
};
export const deletePeritaje = (id) => client.delete(`/taller/peritajes/${id}`).then((r) => r.data);

// Taller — Fotos / adjuntos (subida directa + QR + galería)
export const mediaUrl = (path) => `${API}/taller/media/${path}`;
export const subirFoto = (tipo, id, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post(`/taller/${tipo}/${id}/fotos`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const borrarFoto = (tipo, id, path) => client.delete(`/taller/${tipo}/${id}/fotos`, { params: { path } }).then((r) => r.data);
export const crearFotoSesion = (tipo, entidad_id) => client.post("/taller/foto-sesion", { tipo, entidad_id }).then((r) => r.data);
export const infoSubida = (token) => client.get(`/taller/subida/${token}`).then((r) => r.data);
export const subirFotoToken = (token, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post(`/taller/subida/${token}`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const guardarFirmaOrden = (id, imagen) => client.post(`/taller/ordenes/${id}/firma`, { imagen }).then((r) => r.data);
export const borrarFirmaOrden = (id) => client.delete(`/taller/ordenes/${id}/firma`).then((r) => r.data);

// Taller — Citas
export const getCitas = (params) => client.get("/taller/citas", { params }).then((r) => r.data);
export const createCita = (data) => client.post("/taller/citas", data).then((r) => r.data);
export const updateCita = (id, data) => client.put(`/taller/citas/${id}`, data).then((r) => r.data);
export const estadoCita = (id, estado) => {
  const fd = new FormData();
  fd.append("estado", estado);
  return client.patch(`/taller/citas/${id}/estado`, fd).then((r) => r.data);
};
export const deleteCita = (id) => client.delete(`/taller/citas/${id}`).then((r) => r.data);
export const enviarRecordatorioCita = (id, canal) => {
  const fd = new FormData();
  if (canal) fd.append("canal", canal);
  fd.append("base_url", window.location.origin);
  return client.post(`/taller/citas/${id}/recordatorio`, fd).then((r) => r.data);
};
export const probarNotificacion = (canal, destino) =>
  client.post("/notificaciones/test", { canal, destino }).then((r) => r.data);
export const getCitaPublica = (token) => client.get(`/public/cita/${token}`).then((r) => r.data);
export const responderCita = (token, accion) => {
  const fd = new FormData();
  fd.append("accion", accion);
  return client.post(`/public/cita/${token}/responder`, fd).then((r) => r.data);
};

// Taller — Préstamos de cortesía
export const getPrestamos = (estado) => client.get("/taller/prestamos", { params: { estado } }).then((r) => r.data);
export const createPrestamo = (data) => client.post("/taller/prestamos", data).then((r) => r.data);
export const updatePrestamo = (id, data) => client.put(`/taller/prestamos/${id}`, data).then((r) => r.data);
export const deletePrestamo = (id) => client.delete(`/taller/prestamos/${id}`).then((r) => r.data);
export const subirContrato = (id, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post(`/taller/prestamos/${id}/contrato`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// Contactos — importación Excel
export const importarContactos = (tipo, file) => {
  const fd = new FormData();
  fd.append("tipo", tipo);
  fd.append("file", file);
  return client.post("/contactos/importar", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};
export const plantillaContactosUrl = () => `${API}/contactos/plantilla-excel`;

// Taller — Panel / resumen
export const getTallerResumen = () => client.get("/taller/resumen").then((r) => r.data);

// Dashboard
export const getResumen = () => client.get("/dashboard/resumen").then((r) => r.data);

// Consumo IA
export const getConsumoIA = () => client.get("/consumos-ia/resumen").then((r) => r.data);

// ---- Auth admin ----
const authHeader = () => {
  const t = localStorage.getItem("nexopro_admin_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
export const adminLogin = (email, password) =>
  client.post("/auth/login", { email, password }).then((r) => r.data);
export const adminMe = () => client.get("/auth/me", { headers: authHeader() }).then((r) => r.data);

// ---- Licencias (admin) ----
export const getLicencias = () => client.get("/admin/licencias", { headers: authHeader() }).then((r) => r.data);
export const createLicencia = (data) => client.post("/admin/licencias", data, { headers: authHeader() }).then((r) => r.data);
export const updateLicencia = (id, data) => client.put(`/admin/licencias/${id}`, data, { headers: authHeader() }).then((r) => r.data);
export const estadoLicencia = (id, estado) => {
  const fd = new FormData();
  fd.append("estado", estado);
  return client.patch(`/admin/licencias/${id}/estado`, fd, { headers: authHeader() }).then((r) => r.data);
};
export const registrarPago = (id) => client.post(`/admin/licencias/${id}/pago`, {}, { headers: authHeader() }).then((r) => r.data);
export const deleteLicencia = (id) => client.delete(`/admin/licencias/${id}`, { headers: authHeader() }).then((r) => r.data);
export const getAdminConsumoIA = () => client.get("/admin/consumos-ia", { headers: authHeader() }).then((r) => r.data);

// ---- Licencia (público, gate del cliente) ----
export const verificarLicencia = (key) => client.get(`/licencia/verificar/${key}`).then((r) => r.data);

export const eur = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));

export const eurCoste = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 5 }).format(Number(n || 0));
