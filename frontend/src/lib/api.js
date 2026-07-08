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
export const deleteFacturaRecibida = (id) => client.delete(`/facturas-recibidas/${id}`).then((r) => r.data);

// Extracción IA
export const extraerPdf = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post("/extraccion/pdf", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// Dashboard
export const getResumen = () => client.get("/dashboard/resumen").then((r) => r.data);

export const eur = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));
