// Informes de taller: parte de trabajo (orden) e informe de peritaje con reportaje fotográfico.
import { mediaUrl } from "@/lib/api";

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));
const ACCENT = "#4338ca";

function empresaHeader(empresa = {}) {
  const logo = empresa.logo
    ? `<img src="${esc(empresa.logo)}" alt="logo" style="max-height:60px;max-width:190px;object-fit:contain" />`
    : `<div style="font-size:20px;font-weight:800;letter-spacing:-.02em">${esc(empresa.nombre || "Taller")}</div>`;
  const dir = [empresa.direccion, [empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return `<div style="display:flex;flex-direction:column;gap:4px">${logo}
    <div style="font-size:11px;color:#52525b;line-height:1.5">
      ${empresa.nombre ? `<div style="font-weight:600;color:#18181b">${esc(empresa.nombre)}</div>` : ""}
      ${empresa.nif ? `<div>NIF: ${esc(empresa.nif)}</div>` : ""}
      ${dir ? `<div>${esc(dir)}</div>` : ""}
      ${empresa.telefono ? `<div>Tel: ${esc(empresa.telefono)}</div>` : ""}
    </div></div>`;
}

function shell(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box;font-family:'IBM Plex Sans',-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    body{margin:0;padding:32px;color:#18181b;background:#fff}
    table{width:100%;border-collapse:collapse}
    .accent{color:${ACCENT}}
    @page{margin:14mm}
    @media print{body{padding:0}.noprint{display:none}}
  </style></head><body>${body}
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
  </body></html>`;
}

function open(html) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { alert("Permite las ventanas emergentes para imprimir."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function cabecera(empresa, titulo, ref, fecha) {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${ACCENT};padding-bottom:16px;margin-bottom:22px">
    ${empresaHeader(empresa)}
    <div style="text-align:right">
      <div style="font-size:24px;font-weight:800;letter-spacing:-.02em">${esc(titulo)}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#3f3f46;margin-top:4px">${esc(ref || "—")}</div>
      <div style="font-size:12px;color:#71717a;margin-top:2px">${esc(fecha || new Date().toLocaleDateString("es-ES"))}</div>
    </div></div>`;
}

function bloque(titulo, filas) {
  const items = filas.filter(([, v]) => v).map(([k, v]) =>
    `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#a1a1aa">${esc(k)}</div><div style="font-weight:600;font-size:13px">${esc(v)}</div></div>`).join("");
  return `<div style="margin-bottom:20px"><div style="font-size:11px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${esc(titulo)}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;padding:14px">${items}</div></div>`;
}

function galeria(fotos = []) {
  const imgs = fotos.filter((f) => !(f.content_type || "").includes("pdf"));
  if (imgs.length === 0) return "";
  const cells = imgs.map((f) =>
    `<div style="border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;height:150px"><img src="${esc(mediaUrl(f.path))}" style="width:100%;height:100%;object-fit:cover" /></div>`).join("");
  return `<div style="margin-top:24px"><div style="font-size:11px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Reportaje fotográfico (${imgs.length})</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${cells}</div></div>`;
}

const TIPOS = { chapa: "Chapa", pintura: "Pintura", mecanica: "Mecánica" };

export function imprimirParteOrden({ empresa = {}, orden = {}, vehiculo = {} }) {
  const filas = (orden.lineas || []).map((l) => {
    const b = Number(l.cantidad || 0) * Number(l.precio_unitario || 0) * (1 - Number(l.descuento || 0) / 100);
    const tot = l.total != null ? l.total : b * (1 + Number(l.tipo_iva || 0) / 100);
    return `<tr>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4">${esc(l.descripcion)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right">${esc(l.cantidad)} ${esc(l.unidad || "ud")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right">${money(l.precio_unitario)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right;font-weight:600">${money(tot)}</td></tr>`;
  }).join("");
  const trabajos = (orden.tipos_trabajo || []).map((t) => TIPOS[t] || t).join(", ");
  const body = `${cabecera(empresa, "Parte de trabajo", orden.numero, orden.fecha_entrada)}
    ${bloque("Vehículo", [["Matrícula", orden.vehiculo_matricula || vehiculo.matricula], ["Marca / Modelo", [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ")], ["Kilómetros", vehiculo.kilometros != null ? vehiculo.kilometros + " km" : ""], ["Cliente", orden.cliente_nombre], ["Tipo de trabajo", trabajos], ["Estado", orden.estado]])}
    ${orden.descripcion ? `<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Descripción</div><div style="font-size:13px;color:#3f3f46">${esc(orden.descripcion)}</div></div>` : ""}
    <table><thead><tr style="background:#f4f4f5">
      <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#71717a">Concepto</th>
      <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#71717a">Cant.</th>
      <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#71717a">Precio</th>
      <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#71717a">Total</th>
    </tr></thead><tbody>${filas || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#a1a1aa">Sin líneas</td></tr>`}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><table style="width:260px">
      <tr><td style="padding:4px 8px;color:#71717a">Base</td><td style="padding:4px 8px;text-align:right">${money(orden.base)}</td></tr>
      <tr><td style="padding:4px 8px;color:#71717a">IVA</td><td style="padding:4px 8px;text-align:right">${money(orden.cuota_iva)}</td></tr>
      <tr style="border-top:2px solid ${ACCENT}"><td style="padding:8px;font-weight:800">TOTAL</td><td style="padding:8px;text-align:right;font-weight:800" class="accent">${money(orden.total)}</td></tr>
    </table></div>
    ${galeria(orden.fotos)}
    <div style="margin-top:40px;display:flex;justify-content:space-between;gap:40px">
      <div style="flex:1;border-top:1px solid #d4d4d8;padding-top:6px;font-size:11px;color:#71717a">Firma del taller</div>
      <div style="flex:1;border-top:1px solid #d4d4d8;padding-top:6px;font-size:11px;color:#71717a">Firma del cliente (conforme)</div>
    </div>`;
  open(shell(`Parte ${orden.numero || ""}`, body));
}

export function imprimirInformePeritaje({ empresa = {}, peritaje = {}, vehiculo = {} }) {
  const filas = (peritaje.danios || []).map((d) =>
    `<tr><td style="padding:7px 8px;border-bottom:1px solid #f1f1f4">${esc(d.descripcion)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right;font-weight:600">${money(d.importe)}</td></tr>`).join("");
  const body = `${cabecera(empresa, "Informe de peritaje", peritaje.numero, peritaje.fecha)}
    ${bloque("Vehículo y siniestro", [["Matrícula", peritaje.vehiculo_matricula || vehiculo.matricula], ["Marca / Modelo", [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ")], ["Cliente", peritaje.cliente_nombre], ["Compañía", peritaje.compania], ["Nº póliza", peritaje.poliza], ["Nº siniestro", peritaje.siniestro], ["Estado", peritaje.estado]])}
    ${peritaje.descripcion ? `<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Descripción de los daños</div><div style="font-size:13px;color:#3f3f46">${esc(peritaje.descripcion)}</div></div>` : ""}
    <table><thead><tr style="background:#f4f4f5">
      <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:#71717a">Concepto</th>
      <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:#71717a">Importe</th>
    </tr></thead><tbody>${filas || `<tr><td colspan="2" style="padding:16px;text-align:center;color:#a1a1aa">Sin daños valorados</td></tr>`}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><table style="width:260px">
      <tr style="border-top:2px solid ${ACCENT}"><td style="padding:8px;font-weight:800">TOTAL VALORACIÓN</td><td style="padding:8px;text-align:right;font-weight:800" class="accent">${money(peritaje.importe_total)}</td></tr>
    </table></div>
    ${galeria(peritaje.fotos)}`;
  open(shell(`Peritaje ${peritaje.numero || ""}`, body));
}
