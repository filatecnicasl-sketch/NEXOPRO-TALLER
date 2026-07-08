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

const CAR_SVG = `<svg viewBox="0 0 320 150" width="100%" height="130" preserveAspectRatio="xMidYMid meet" style="max-width:340px">
  <rect x="46" y="6" width="40" height="15" rx="6" fill="#e4e4e7"/>
  <rect x="234" y="6" width="40" height="15" rx="6" fill="#e4e4e7"/>
  <rect x="46" y="129" width="40" height="15" rx="6" fill="#e4e4e7"/>
  <rect x="234" y="129" width="40" height="15" rx="6" fill="#e4e4e7"/>
  <rect x="34" y="18" width="252" height="114" rx="46" fill="none" stroke="#71717a" stroke-width="1.6"/>
  <path d="M96 30 q64 -8 128 0 l-16 30 q-48 -6 -96 0 Z" fill="none" stroke="#a1a1aa" stroke-width="1.2"/>
  <path d="M96 120 q64 8 128 0 l-16 -30 q-48 6 -96 0 Z" fill="none" stroke="#a1a1aa" stroke-width="1.2"/>
  <rect x="112" y="64" width="96" height="22" rx="4" fill="none" stroke="#d4d4d8" stroke-width="1"/>
  <line x1="34" y1="75" x2="70" y2="75" stroke="#d4d4d8" stroke-width="1"/>
  <line x1="250" y1="75" x2="286" y2="75" stroke="#d4d4d8" stroke-width="1"/>
</svg>`;

function linea(label, valor, ancho = "1fr") {
  return `<div style="min-width:0">
    <span style="font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa">${esc(label)}</span>
    <div style="border-bottom:1px solid #d4d4d8;min-height:16px;font-size:12px;font-weight:600;padding:1px 0">${esc(valor || "")}</div>
  </div>`;
}

export function imprimirHojaEntrada({ empresa = {}, orden = {}, vehiculo = {}, cliente = {} }) {
  const trabajos = (orden.tipos_trabajo || []).map((t) => TIPOS[t] || t).join(", ");
  const fentrada = orden.fecha_entrada || new Date().toISOString().slice(0, 10);
  const marcaModelo = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ");
  const km = vehiculo.kilometros != null ? `${vehiculo.kilometros} km` : "";

  const copia = (destinatario) => `
  <div style="border:1px solid #e4e4e7;border-radius:10px;padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${ACCENT};padding-bottom:8px;margin-bottom:10px">
      ${empresaHeader(empresa)}
      <div style="text-align:right">
        <div style="font-size:17px;font-weight:800;letter-spacing:-.02em">Hoja de entrada</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#3f3f46;margin-top:2px">${esc(orden.numero || "—")}</div>
        <div style="display:inline-block;margin-top:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:${ACCENT};border-radius:4px;padding:2px 7px">Ejemplar para el ${esc(destinatario)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px;margin-bottom:8px">
      ${linea("Cliente", cliente.nombre || orden.cliente_nombre)}
      ${linea("NIF / CIF", cliente.nif)}
      ${linea("Teléfono", cliente.telefono)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px">
      ${linea("Matrícula", orden.vehiculo_matricula || vehiculo.matricula)}
      ${linea("Marca / Modelo", marcaModelo)}
      ${linea("Bastidor / VIN", vehiculo.bastidor)}
      ${linea("Color", vehiculo.color)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
      ${linea("Km de entrada", km)}
      ${linea("Combustible", vehiculo.combustible)}
      ${linea("Fecha de entrada", fentrada)}
      ${linea("Hora", "")}
    </div>

    <div style="margin-bottom:10px">
      <span style="font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa">Trabajos solicitados / motivo</span>
      <div style="border-bottom:1px solid #d4d4d8;min-height:16px;font-size:12px;padding:1px 0">${esc([trabajos, orden.descripcion].filter(Boolean).join(" · "))}</div>
      <div style="border-bottom:1px solid #d4d4d8;min-height:16px"></div>
    </div>

    <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:16px;margin-bottom:10px">
      <div>
        <div style="font-size:9px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Estado y daños observados</div>
        <div style="text-align:center;border:1px dashed #d4d4d8;border-radius:8px;padding:6px">${CAR_SVG}
          <div style="font-size:8px;color:#a1a1aa;margin-top:2px">Marque los golpes, arañazos y daños existentes</div>
        </div>
      </div>
      <div>
        <div style="font-size:9px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Objetos de valor en el vehículo</div>
        <div style="border-bottom:1px solid #d4d4d8;min-height:16px;margin-bottom:6px"></div>
        <div style="border-bottom:1px solid #d4d4d8;min-height:16px;margin-bottom:6px"></div>
        <div style="border-bottom:1px solid #d4d4d8;min-height:16px;margin-bottom:10px"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${linea("Presupuesto máx. autorizado", "")}
          ${linea("Fecha entrega estimada", orden.fecha_entrega_estimada)}
        </div>
      </div>
    </div>

    <div style="font-size:7.5px;color:#71717a;line-height:1.5;background:#fafafa;border:1px solid #f1f1f4;border-radius:6px;padding:7px 9px;margin-bottom:8px">
      El cliente autoriza la reparación del vehículo por los trabajos indicados y hasta el importe máximo señalado. El taller no se
      responsabiliza de los objetos de valor no declarados. Transcurrido el plazo de recogida, podrán aplicarse gastos de custodia
      y estacionamiento. El vehículo podrá ser retenido hasta el pago total de la reparación (derecho de retención, art. 1.600 CC).
      Datos tratados por ${esc(empresa.nombre || "el taller")} con la finalidad de gestionar la reparación (RGPD UE 2016/679);
      puede ejercer sus derechos de acceso, rectificación y supresión dirigiéndose al taller.
    </div>

    <div style="display:flex;justify-content:space-between;gap:30px;margin-top:14px">
      <div style="flex:1;border-top:1px solid #d4d4d8;padding-top:5px;font-size:10px;color:#71717a">Firma y sello del taller</div>
      <div style="flex:1;border-top:1px solid #d4d4d8;padding-top:5px;font-size:10px;color:#71717a">Firma del cliente (conforme)</div>
    </div>
  </div>`;

  const body = `
    ${copia("TALLER")}
    <div style="text-align:center;color:#a1a1aa;font-size:9px;letter-spacing:.3em;margin:8px 0">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
    ${copia("CLIENTE")}`;
  open(shell(`Hoja de entrada ${orden.numero || ""}`, body));
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
