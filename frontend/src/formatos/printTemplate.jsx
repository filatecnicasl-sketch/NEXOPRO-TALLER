import { createRoot } from "react-dom/client";
import { PrintSheet } from "@/formatos/PrintSheet";
import { getAjustes, getFormatos } from "@/lib/api";

// Renderiza una plantilla del editor rellena con datos y abre el diálogo de imprimir.
export function printTemplateWithData(template, formData = {}, signatures = {}) {
  const prev = document.getElementById("__fmt_print_host__");
  if (prev) prev.remove();
  const host = document.createElement("div");
  host.id = "__fmt_print_host__";
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<PrintSheet template={template} formData={formData} signatures={signatures} />);

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    try { root.unmount(); } catch (e) { /* noop */ }
    try { host.remove(); } catch (e) { /* noop */ }
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => { try { window.print(); } catch (e) { /* noop */ } }, 350);
  setTimeout(cleanup, 120000);
}

// Devuelve la plantilla configurada para la "Hoja de entrada", o la de "Recepción de Vehículo",
// o null si no hay ninguna disponible.
export async function getPlantillaHojaEntrada() {
  try {
    const [ajustes, formatos] = await Promise.all([getAjustes(), getFormatos()]);
    const id = ajustes?.formato_hoja_entrada;
    let tpl = id ? formatos.find((f) => f.id === id) : null;
    if (!tpl) tpl = formatos.find((f) => f.name === "Recepción de Vehículo");
    return tpl || null;
  } catch (e) {
    return null;
  }
}

function fmtFecha(f) {
  if (!f) return "";
  try { return new Date(f).toLocaleDateString("es-ES"); } catch (e) { return ""; }
}

// Mapea los datos reales de una orden a las claves de campo de la plantilla "Recepción de Vehículo".
export function mapOrdenToFormData(orden = {}, vehiculo = {}, cliente = {}, empresa = {}) {
  const dir = [empresa.direccion, [empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  return {
    "taller.nombre": empresa.nombre || "",
    "taller.cif": empresa.nif || "",
    "taller.direccion": dir,
    "taller.mail": empresa.email || "",
    "taller.telefono": empresa.telefono || "",
    "resguardo.numero": orden.numero || "",
    "cliente.titular": cliente.nombre || orden.cliente_nombre || "",
    "cliente.cifTitular": cliente.nif || cliente.cif || "",
    "cliente.solicitante": cliente.nombre || orden.cliente_nombre || "",
    "cliente.cifSolicitante": cliente.nif || cliente.cif || "",
    "cliente.direccion": cliente.direccion || "",
    "cliente.telefono": cliente.telefono || "",
    "cliente.mail": cliente.email || "",
    "vehiculo.fecha": fmtFecha(orden.fecha_entrada || orden.created_at),
    "vehiculo.matricula": vehiculo.matricula || orden.vehiculo_matricula || "",
    "vehiculo.marca": vehiculo.marca || "",
    "vehiculo.km": vehiculo.kilometros != null ? String(vehiculo.kilometros) : "",
    "vehiculo.modelo": vehiculo.modelo || "",
    "vehiculo.observaciones": orden.descripcion || "",
    "entrega.fechaPrevista": fmtFecha(orden.fecha_entrega_estimada),
  };
}
