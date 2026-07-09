// Utilidad de impresión: genera documentos y listados e imprime en la propia página (sin pestañas).
import { imprimirHtmlString } from "@/lib/api";

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(n || 0));

function empresaHeader(empresa = {}) {
  const logo = empresa.logo
    ? `<img src="${esc(empresa.logo)}" alt="logo" style="max-height:64px;max-width:200px;object-fit:contain" />`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-.02em">${esc(empresa.nombre || "Mi empresa")}</div>`;
  const dir = [empresa.direccion, [empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return `
    <div style="display:flex;flex-direction:column;gap:4px">
      ${logo}
      <div style="font-size:11px;color:#52525b;line-height:1.5">
        ${empresa.nombre ? `<div style="font-weight:600;color:#18181b">${esc(empresa.nombre)}</div>` : ""}
        ${empresa.nif ? `<div>NIF: ${esc(empresa.nif)}</div>` : ""}
        ${dir ? `<div>${esc(dir)}</div>` : ""}
        ${empresa.telefono ? `<div>Tel: ${esc(empresa.telefono)}</div>` : ""}
        ${empresa.email ? `<div>${esc(empresa.email)}</div>` : ""}
      </div>
    </div>`;
}

function shell(title, bodyHTML, accent) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box;font-family:'IBM Plex Sans',-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    body{margin:0;padding:32px;color:#18181b;background:#fff}
    table{width:100%;border-collapse:collapse}
    .accent{color:${accent}}
    @page{margin:16mm}
    @media print{body{padding:0}.noprint{display:none}}
  </style></head><body>${bodyHTML}
  </body></html>`;
}

function open(html) {
  imprimirHtmlString(html);
}

export function imprimirDocumento({
  empresa = {}, tipoLabel, familia = "venta", numero, fecha, serie,
  contactoLabel = "Cliente", contacto = {}, lineas = [], base = 0, iva = 0, total = 0,
  forma_pago, notas, footer,
}) {
  const accent = familia === "compra" ? "#b45309" : "#4338ca";
  const famBadge = familia === "compra" ? "COMPRA" : "VENTA";
  const famBg = familia === "compra" ? "#fffbeb" : "#eef2ff";

  const filas = lineas.map((l) => {
    const b = Number(l.cantidad || 0) * Number(l.precio_unitario || 0) * (1 - Number(l.descuento || 0) / 100);
    const tot = l.total != null ? l.total : b * (1 + Number(l.tipo_iva || 0) / 100);
    return `<tr>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4">${esc(l.descripcion)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right">${esc(l.cantidad)} ${esc(l.unidad || "ud")}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right">${money(l.precio_unitario)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right">${Number(l.descuento || 0)}%</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right">${Number(l.tipo_iva || 0)}%</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:right;font-weight:600">${money(tot)}</td>
    </tr>`;
  }).join("");

  const body = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:16px;margin-bottom:22px">
      ${empresaHeader(empresa)}
      <div style="text-align:right">
        <div style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;color:${accent};background:${famBg};border:1px solid ${accent}33;border-radius:999px;padding:3px 10px;margin-bottom:8px">${famBadge}</div>
        <div style="font-size:24px;font-weight:800;letter-spacing:-.02em">${esc(tipoLabel)}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#3f3f46;margin-top:4px">${esc(numero || "—")}</div>
        <div style="font-size:12px;color:#71717a;margin-top:2px">Fecha: ${esc(fecha || "—")}${serie ? ` · Serie: ${esc(serie)}` : ""}</div>
      </div>
    </div>

    <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:12px 14px;margin-bottom:20px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#a1a1aa;margin-bottom:4px">${esc(contactoLabel)}</div>
      <div style="font-weight:600;font-size:14px">${esc(contacto.nombre || "—")}</div>
      <div style="font-size:12px;color:#52525b">${contacto.nif ? "NIF: " + esc(contacto.nif) : ""}${contacto.direccion ? " · " + esc(contacto.direccion) : ""}</div>
    </div>

    <table>
      <thead><tr style="background:#f4f4f5">
        <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a">Descripción</th>
        <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a">Cant.</th>
        <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a">Precio</th>
        <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a">Dto</th>
        <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a">IVA</th>
        <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a">Total</th>
      </tr></thead>
      <tbody>${filas || `<tr><td colspan="6" style="padding:16px;text-align:center;color:#a1a1aa">Sin líneas</td></tr>`}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:18px">
      <table style="width:280px">
        <tr><td style="padding:4px 8px;color:#71717a">Base imponible</td><td style="padding:4px 8px;text-align:right">${money(base)}</td></tr>
        <tr><td style="padding:4px 8px;color:#71717a">IVA</td><td style="padding:4px 8px;text-align:right">${money(iva)}</td></tr>
        <tr style="border-top:2px solid ${accent}"><td style="padding:8px;font-weight:800;font-size:15px">TOTAL</td><td style="padding:8px;text-align:right;font-weight:800;font-size:15px" class="accent">${money(total)}</td></tr>
      </table>
    </div>

    ${forma_pago ? `<div style="margin-top:16px;font-size:12px;color:#52525b">Forma de pago: <b>${esc(forma_pago)}</b></div>` : ""}
    ${notas ? `<div style="margin-top:8px;font-size:12px;color:#52525b">${esc(notas)}</div>` : ""}
    ${footer ? `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#71717a">${footer}</div>` : ""}
  `;
  open(shell(`${tipoLabel} ${numero || ""}`, body, accent));
}

export function imprimirListado({ empresa = {}, titulo, familia = "venta", columnas = [], filas = [] }) {
  const accent = familia === "compra" ? "#b45309" : "#4338ca";
  const famBadge = familia === "compra" ? "COMPRA" : familia === "venta" ? "VENTA" : "";
  const ths = columnas.map((c) => `<th style="padding:8px;text-align:${c.align || "left"};font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;border-bottom:2px solid #e4e4e7">${esc(c.label)}</th>`).join("");
  const trs = filas.map((row) => `<tr>${row.map((cell, i) => `<td style="padding:7px 8px;border-bottom:1px solid #f1f1f4;text-align:${columnas[i]?.align || "left"}">${esc(cell)}</td>`).join("")}</tr>`).join("");
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:14px;margin-bottom:18px">
      ${empresaHeader(empresa)}
      <div style="text-align:right">
        ${famBadge ? `<div style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;color:${accent};border:1px solid ${accent}33;border-radius:999px;padding:3px 10px;margin-bottom:8px">${famBadge}</div>` : ""}
        <div style="font-size:22px;font-weight:800;letter-spacing:-.02em">${esc(titulo)}</div>
        <div style="font-size:12px;color:#71717a;margin-top:2px">${new Date().toLocaleDateString("es-ES")} · ${filas.length} registros</div>
      </div>
    </div>
    <table><thead><tr>${ths}</tr></thead><tbody>${trs || `<tr><td colspan="${columnas.length}" style="padding:16px;text-align:center;color:#a1a1aa">Sin datos</td></tr>`}</tbody></table>
  `;
  open(shell(titulo, body, accent));
}
