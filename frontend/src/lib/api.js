import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

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
  return client.post("/extraccion/pdf", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// Ajustes (series de documentos + datos de empresa)
export const getAjustes = () => client.get("/ajustes").then((r) => r.data);
export const updateAjustes = (data) => client.put("/ajustes", data).then((r) => r.data);

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

// ---- Licencia (público, gate del cliente) ----
export const verificarLicencia = (key) => client.get(`/licencia/verificar/${key}`).then((r) => r.data);

export const eur = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));

export const eurCoste = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 5 }).format(Number(n || 0));
