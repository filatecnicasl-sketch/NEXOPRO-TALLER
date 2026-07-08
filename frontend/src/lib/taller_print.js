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

const REP_ROWS = 15;

export function imprimirHojaEntrada({ empresa = {}, orden = {}, vehiculo = {}, cliente = {} }) {
  const fentrada = orden.fecha_entrada || new Date().toISOString().slice(0, 10);
  const fmtF = (f) => { try { const d = new Date(f); return isNaN(d) ? (f || "") : d.toLocaleDateString("es-ES"); } catch { return f || ""; } };
  const esMO = (l) => ["h", "hora", "horas", "mo"].includes((l.unidad || "").toLowerCase());

  let reps = "";
  for (let i = 0; i < REP_ROWS; i++) {
    const l = (orden.lineas || [])[i];
    const mo = l && esMO(l) ? l.descripcion : "";
    const mat = l && !esMO(l) ? l.descripcion : "";
    reps += `<tr><td style="text-align:center;color:#71717a;width:16px">${i + 1}</td><td style="padding-left:4px">${esc(mo)}</td><td style="padding-left:4px">${esc(mat)}</td></tr>`;
  }

  const fld = (label, val) => `<div style="min-width:0"><div class="lbl">${esc(label)}</div><div class="fld">${esc(val || "")}</div></div>`;
  const chk = (marcado, txt) => `<div class="chk"><span style="font-size:11px;line-height:1">${marcado ? "☑" : "☐"}</span><span>${txt}</span></div>`;

  const body = `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${ACCENT};padding-bottom:6px;margin-bottom:8px">
    <div style="display:flex;gap:10px;align-items:flex-start">
      ${empresa.logo ? `<img src="${esc(empresa.logo)}" style="max-height:46px;max-width:120px;object-fit:contain" />` : ""}
      <div>
        <div class="lbl">Nombre del taller</div>
        <div style="font-size:15px;font-weight:800;letter-spacing:-.01em">${esc(empresa.nombre || "TALLER")}</div>
        <div style="font-size:8.5px;color:#3f3f46;margin-top:2px">${esc([empresa.direccion, [empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(" ")].filter(Boolean).join(" · "))}</div>
        <div style="font-size:8.5px;color:#3f3f46">${empresa.email ? esc(empresa.email) : ""}${empresa.telefono ? " · Tel: " + esc(empresa.telefono) : ""}</div>
        <div style="font-size:8.5px;color:#3f3f46;margin-top:1px">${empresa.nif ? "CIF: " + esc(empresa.nif) : ""} &nbsp; RIIA: __________</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:8px;font-weight:700;color:#fff;background:${ACCENT};border-radius:4px;padding:2px 8px;display:inline-block;letter-spacing:.05em">EJEMPLAR PARA EL PRESTADOR DEL SERVICIO</div>
      <div style="font-size:13px;font-weight:800;margin-top:6px;line-height:1.2">RESGUARDO DE DEPÓSITO<br>SIN PRESUPUESTO Nº: <span class="accent">${esc(orden.numero || "—")}</span></div>
    </div>
  </div>

  <div class="box" style="margin-bottom:8px">
    <div style="display:grid;grid-template-columns:1.6fr 1.2fr 1fr;gap:12px;margin-bottom:6px">
      ${fld("Titular del vehículo", cliente.nombre || orden.cliente_nombre)}
      ${fld("Persona solicitante", "")}
      ${fld("Dirección titular", cliente.direccion)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">
      ${fld("CIF / DNI titular", cliente.nif)}
      ${fld("CIF / DNI solicitante", "")}
      ${fld("Teléfono", cliente.telefono)}
      ${fld("Fax", "")}
      ${fld("Mail", cliente.email)}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1.05fr 1fr;gap:12px;margin-bottom:8px">
    <div>
      <div class="sec" style="margin-bottom:3px">Reparaciones a realizar</div>
      <table class="rep">
        <thead><tr style="background:#f4f4f5">
          <th style="width:16px">Nº</th><th style="text-align:left;padding-left:4px">Mano de obra</th><th style="text-align:left;padding-left:4px">Materiales</th>
        </tr></thead>
        <tbody>${reps}</tbody>
      </table>
    </div>
    <div>
      <div class="box" style="margin-bottom:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:6px">
          ${fld("Fecha", fmtF(fentrada))}
          ${fld("Matrícula", orden.vehiculo_matricula || vehiculo.matricula)}
          ${fld("Km", vehiculo.kilometros != null ? String(vehiculo.kilometros) : "")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px">
          ${fld("Marca", vehiculo.marca)}
          ${fld("Modelo", vehiculo.modelo)}
        </div>
        <div style="display:flex;gap:18px;align-items:center;margin-bottom:6px;font-size:8.5px">
          <div><span class="lbl">Seguro</span> &nbsp; ☐ SÍ &nbsp; ☐ NO</div>
          <div style="flex:1">${fld("Combustible", vehiculo.combustible)}</div>
        </div>
        ${fld("Observaciones", [orden.descripcion, (orden.tipos_trabajo || []).map((t) => TIPOS[t] || t).join(", ")].filter(Boolean).join(" · "))}
      </div>
      <div style="text-align:center;border:1px dashed #d4d4d8;border-radius:8px;padding:4px">${CAR_SVG}
        <div style="font-size:7px;color:#a1a1aa">Marque los daños existentes en el vehículo</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:12px;margin-bottom:8px">
    <div class="box">
      <div class="sec" style="margin-bottom:4px">Renuncia a la elaboración de presupuesto previo</div>
      <div style="font-size:8px;line-height:1.45;text-align:justify">EL CLIENTE TIENE DERECHO A LA ELABORACIÓN DE UN PRESUPUESTO PREVIO. MEDIANTE LA PRESENTE FIRMA EL USUARIO RENUNCIA A LA ELABORACIÓN DE PRESUPUESTO PREVIO Y AUTORIZA A REALIZAR LOS TRABAJOS NECESARIOS PARA LA REPARACIÓN DEL VEHÍCULO Y/O SERVICIOS SOLICITADOS CONFORME A LO REFLEJADO EN ESTE RESGUARDO DE DEPÓSITO.</div>
      <div style="display:flex;justify-content:space-between;gap:20px;margin-top:14px">
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #d4d4d8;padding-top:3px;font-size:8px;color:#71717a">EL PRESTADOR DEL SERVICIO<br><b>${esc(empresa.nombre || "")}</b></div>
        </div>
        <div style="flex:1;text-align:center">
          ${orden.firma_cliente_path ? `<img src="${esc(mediaUrl(orden.firma_cliente_path))}" style="max-height:38px;max-width:150px;object-fit:contain" />` : `<div style="height:38px"></div>`}
          <div style="border-top:1px solid #d4d4d8;padding-top:3px;font-size:8px;color:#71717a">CONFORME CLIENTE</div>
        </div>
      </div>
      <div style="margin-top:8px">${fld("Fecha prevista de entrega del vehículo reparado", fmtF(orden.fecha_entrega_estimada))}</div>
    </div>
    <div class="box">
      <div class="sec" style="margin-bottom:4px">El cliente, con la firma anterior, autoriza al taller a:</div>
      ${chk(false, "Realizar desplazamientos de diagnóstico.")}
      ${chk(false, "Utilizar elementos, equipos o conjuntos usados o no específicos (Art. 9 y 10 Decreto 9/2003).")}
      ${chk(false, "Utilizar elementos, equipos o conjuntos reconstruidos (Art. 9 y 10 Decreto 9/2003).")}
      ${chk(false, "Renuncia a retirar elementos sustituidos tras reparación.")}
    </div>
  </div>

  <div style="font-size:7px;line-height:1.5;color:#52525b;text-align:justify;border-top:1px solid #e4e4e7;padding-top:6px">
    <p style="margin:0 0 5px">SI TRANSCURRIDOS TRES DÍAS DESDE LA PUESTA EN CONOCIMIENTO DEL CLIENTE DE LA FINALIZACIÓN DE LOS TRABAJOS DE ELABORACIÓN DEL PRESUPUESTO O REPARACIÓN DEL VEHÍCULO, NO PROCEDA EL CLIENTE AL PRONUNCIAMIENTO SOBRE LA ACEPTACIÓN O NO DEL PRESUPUESTO O A LA RETIRADA DEL VEHÍCULO, SE DEVENGARÁN UNOS GASTOS DIARIOS DE ESTANCIA DE __________ € MÁS IVA.</p>
    <p style="margin:0"><b>Protección de Datos de Carácter Personal:</b> con la firma del presente usted presta su consentimiento para que sus datos sean tratados mientras que no comunique lo contrario por este taller, con la finalidad de gestión contable/administrativa de los servicios. Podrá ejercitar sus derechos de acceso, rectificación, supresión, oposición, y los demás reconocidos en esta norma, enviando solicitud a la dirección indicada, remitiendo copia de su DNI. Puede ejercitar el derecho a presentar una reclamación ante la Agencia Española de Protección de Datos.</p>
  </div>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resguardo ${esc(orden.numero || "")}</title>
  <style>
    *{box-sizing:border-box;font-family:'IBM Plex Sans',-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    body{margin:0;padding:7mm;color:#18181b;background:#fff;font-size:9px}
    @page{size:A4 landscape;margin:6mm}
    @media print{body{padding:0}}
    .accent{color:${ACCENT}}
    .lbl{font-size:6.5px;text-transform:uppercase;letter-spacing:.06em;color:#71717a}
    .val{font-weight:700}
    .box{border:1px solid #a1a1aa;border-radius:6px;padding:7px 9px}
    .fld{border-bottom:1px solid #d4d4d8;min-height:13px;font-weight:700;font-size:10px;padding:1px 0}
    table.rep{width:100%;border-collapse:collapse}
    table.rep th{font-size:7.5px;text-transform:uppercase;color:#71717a;padding:3px}
    table.rep td{border:1px solid #e4e4e7;font-size:8.5px;height:15px}
    table.rep th{border:1px solid #d4d4d8}
    .chk{display:flex;gap:6px;margin-bottom:5px;font-size:8px;line-height:1.3}
    .sec{font-weight:800;font-size:9px;color:${ACCENT};text-transform:uppercase;letter-spacing:.05em}
  </style></head><body>${body}
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
  </body></html>`;
  open(html);
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
