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

const REP_ROWS = 21;

const SIDE_SVG = `<svg viewBox="0 0 240 92" width="140" height="54" style="display:block">
  <path d="M12 64 C12 42 42 42 62 38 L96 20 C112 13 152 11 172 24 L206 34 C224 39 230 47 230 60 L230 66 C230 70 226 72 222 72 L20 72 C15 72 12 69 12 64 Z" fill="none" stroke="#52525b" stroke-width="1.5"/>
  <circle cx="72" cy="72" r="15" fill="none" stroke="#52525b" stroke-width="1.5"/>
  <circle cx="188" cy="72" r="15" fill="none" stroke="#52525b" stroke-width="1.5"/>
  <path d="M96 32 L112 21 L150 21 L162 33 Z" fill="none" stroke="#a1a1aa" stroke-width="1"/>
</svg>`;

export function imprimirHojaEntrada({ empresa = {}, orden = {}, vehiculo = {}, cliente = {} }) {
  const fmtF = (f) => { try { const d = new Date(f); return isNaN(d) ? (f || "") : d.toLocaleDateString("es-ES"); } catch { return f || ""; } };
  const fentrada = fmtF(orden.fecha_entrada || new Date().toISOString().slice(0, 10));
  const esMO = (l) => ["h", "hora", "horas", "mo"].includes((l.unidad || "").toLowerCase());

  let reps = "";
  for (let i = 0; i < REP_ROWS; i++) {
    const l = (orden.lineas || [])[i];
    const imp = l ? money(Number(l.cantidad || 0) * Number(l.precio_unitario || 0)) : "";
    const desc = l ? l.descripcion : "";
    const mo = l && esMO(l) ? imp : "";
    const mat = l && !esMO(l) ? imp : "";
    reps += `<tr><td class="n">${i + 1}</td><td class="d">${esc(desc)}</td><td class="m">${esc(mo)}</td><td class="m">${esc(mat)}</td></tr>`;
  }

  const hc = (l, v, span = 1) => `<div style="border-right:.8px solid #000;border-bottom:.8px solid #000;padding:2px 6px;grid-column:span ${span};min-width:0"><div class="lbl">${esc(l)}</div><div class="val">${esc(v || "")}</div></div>`;
  const chk = (t) => `<div style="display:flex;gap:6px;align-items:flex-start;font-size:8px;line-height:1.25;font-weight:700"><span style="font-size:12px;line-height:1">☐</span><span>${t}</span></div>`;

  const body = `
  <div style="border:1.4px solid #000;height:190mm;display:flex;flex-direction:column;overflow:hidden">
    <div style="text-align:center;font-size:19px;font-weight:800;letter-spacing:.02em;padding:5px 0;border-bottom:1.4px solid #000">EJEMPLAR PARA EL PRESTADOR DEL SERVICIO</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1.4px solid #000">
      <!-- Taller -->
      <div style="display:grid;grid-template-columns:1.5fr 1fr;border-right:1.4px solid #000">
        ${hc("Nombre del taller", empresa.nombre)}${hc("CIF", empresa.nif)}
        ${hc("Dirección", [empresa.direccion, [empresa.codigo_postal, empresa.ciudad].filter(Boolean).join(" ")].filter(Boolean).join(" · "))}${hc("RIIA", "")}
        ${hc("Mail", empresa.email)}${hc("Teléfono", empresa.telefono)}
        ${hc("", "")}${hc("Fax", "")}
      </div>
      <!-- Cliente -->
      <div style="display:flex;flex-direction:column">
        <div style="border-bottom:.8px solid #000;padding:2px 6px;font-size:9px;font-weight:800">RESGUARDO DE DEPÓSITO SIN PRESUPUESTO Nº: <span class="accent">${esc(orden.numero || "")}</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;flex:1">
          ${hc("Titular del vehículo", cliente.nombre || orden.cliente_nombre)}${hc("CIF/DNI titular", cliente.nif)}
          ${hc("Persona solicitante", "")}${hc("CIF/DNI solicitante", "")}
          ${hc("Dirección titular", cliente.direccion)}${hc("Teléfono", cliente.telefono)}
          ${hc("Mail", cliente.email)}${hc("Fax", "")}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:0.92fr 1.08fr;flex:1;min-height:0">
      <!-- REPARACIONES -->
      <div style="border-right:1.4px solid #000;display:flex;flex-direction:column;min-height:0">
        <div style="text-align:center;font-weight:800;font-size:10px;padding:3px 0;border-bottom:.8px solid #000">REPARACIONES A REALIZAR</div>
        <table class="rep"><thead><tr>
          <th style="width:16px">Nº</th><th style="text-align:left;padding-left:5px">DESCRIPCIÓN</th>
          <th style="width:56px">MANO DE OBRA</th><th style="width:52px">MATERIALES</th>
        </tr></thead><tbody>${reps}</tbody></table>
      </div>

      <!-- COLUMNA DERECHA -->
      <div style="display:flex;flex-direction:column;min-height:0">
        <!-- Vehículo + croquis -->
        <div style="display:flex;border-bottom:1.4px solid #000">
          <div style="width:150px;border-right:.8px solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 2px">
            ${SIDE_SVG}${CAR_SVG.replace('width="100%" height="130"', 'width="150" height="70"').replace('max-width:340px', 'max-width:150px')}
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;align-content:start">
            ${hc("Fecha", fentrada)}${hc("Matrícula", orden.vehiculo_matricula || vehiculo.matricula)}${hc("Marca", vehiculo.marca)}
            ${hc("Km", vehiculo.kilometros != null ? String(vehiculo.kilometros) : "")}
            <div style="border-right:.8px solid #000;border-bottom:.8px solid #000;padding:2px 6px"><div class="lbl">Seguro</div><div style="font-size:9px">☐ SÍ &nbsp; ☐ NO</div></div>
            ${hc("Modelo", vehiculo.modelo)}
            <div style="border-bottom:.8px solid #000;padding:2px 6px;grid-column:span 3"><span class="lbl">Combustible R</span> <span class="val">${esc(vehiculo.combustible || "")}</span></div>
            <div style="padding:2px 6px;grid-column:span 3"><div class="lbl">Observaciones</div><div style="font-size:9px;min-height:22px">${esc([orden.descripcion, (orden.tipos_trabajo || []).map((t) => TIPOS[t] || t).join(", ")].filter(Boolean).join(" · "))}</div></div>
          </div>
        </div>

        <!-- Renuncia -->
        <div style="border:1.4px solid #000;margin:6px;padding:8px 10px">
          <div style="text-align:center;font-size:16px;font-weight:800;line-height:1.1;margin-bottom:6px">RENUNCIA A LA ELABORACIÓN<br>DE PRESUPUESTO PREVIO</div>
          <div style="font-size:8px;font-weight:700;line-height:1.4;text-align:justify">EL CLIENTE TIENE DERECHO A LA ELABORACIÓN DE UN PRESUPUESTO PREVIO. MEDIANTE LA PRESENTE FIRMA EL USUARIO RENUNCIA A LA ELABORACIÓN DE PRESUPUESTO PREVIO Y AUTORIZA A REALIZAR LOS TRABAJOS NECESARIOS PARA LA REPARACIÓN DEL VEHÍCULO Y/O SERVICIOS SOLICITADOS CONFORME A LO REFLEJADO EN ESTE RESGUARDO DE DEPÓSITO.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px">
            <div><div style="font-size:9px;font-weight:800">EL PRESTADOR DEL SERVICIO</div><div style="font-size:9px;font-weight:700">${esc(empresa.nombre || "")}</div><div style="height:30px"></div></div>
            <div style="text-align:center"><div style="font-size:9px;font-weight:800;text-align:left">CONFORME CLIENTE</div>${orden.firma_cliente_path ? `<img src="${esc(mediaUrl(orden.firma_cliente_path))}" style="max-height:34px;max-width:150px;object-fit:contain" />` : `<div style="height:34px"></div>`}</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;border-top:1.4px solid #000;border-bottom:1.4px solid #000;padding:4px 8px;font-size:8.5px;font-weight:800">
          FECHA PREVISTA DE ENTREGA DEL VEHÍCULO REPARADO <span style="flex:1;border-bottom:1px solid #999;margin:0 6px">&nbsp;</span><span class="val">${esc(fmtF(orden.fecha_entrega_estimada))}</span>
        </div>

        <div style="flex:1;padding:5px 8px">
          <div style="font-size:8.5px;font-weight:800;margin-bottom:5px">EL CLIENTE CON LA FIRMA ANTERIOR AUTORIZA AL TALLER A:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 16px">
            ${chk("REALIZAR DESPLAZAMIENTOS DE DIAGNÓSTICO.")}
            ${chk("UTILIZAR ELEMENTOS, EQUIPOS O CONJUNTOS USADOS O NO ESPECÍFICOS (ART. 9 Y 10 DECRETO 9/2003).")}
            ${chk("UTILIZAR ELEMENTOS, EQUIPOS O CONJUNTOS RECONSTRUIDOS (ART. 9 Y 10 DECRETO 9/2003).")}
            ${chk("RENUNCIA A RETIRAR ELEMENTOS SUSTITUIDOS TRAS REPARACIÓN.")}
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1.4px solid #000">
      <div style="border-right:1.4px solid #000;padding:5px 8px;font-size:7px;line-height:1.4;text-align:justify"><b>Protección de Datos de Carácter Personal:</b> con la firma del presente usted presta su consentimiento para que sus datos sean tratados mientras que no comunique lo contrario por este taller, con la finalidad de gestión contable/administrativa de los servicios. Podrá ejercitar sus derechos de acceso, rectificación, supresión, oposición, y los demás reconocidos en esta norma, enviando solicitud a la dirección indicada, remitiendo copia de su DNI. Puede ejercitar el derecho a presentar una reclamación ante la Agencia Española de Protección de Datos.</div>
      <div style="padding:5px 8px;font-size:7px;line-height:1.4;text-align:justify;font-weight:700">SI TRANSCURRIDOS TRES DÍAS DESDE LA PUESTA EN CONOCIMIENTO DEL CLIENTE DE LA FINALIZACIÓN DE LOS TRABAJOS DE ELABORACIÓN DEL PRESUPUESTO O REPARACIÓN DEL VEHÍCULO, NO PROCEDA EL CLIENTE AL PRONUNCIAMIENTO SOBRE LA ACEPTACIÓN O NO DEL PRESUPUESTO O A LA RETIRADA DEL VEHÍCULO, SE DEVENGARÁN UNOS GASTOS DIARIOS DE ESTANCIA DE __________ € MÁS IVA.</div>
    </div>
  </div>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resguardo ${esc(orden.numero || "")}</title>
  <style>
    *{box-sizing:border-box;font-family:'IBM Plex Sans',-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    html,body{margin:0;padding:0}
    body{color:#000;background:#fff;font-size:9px}
    @page{size:A4 landscape;margin:6mm}
    .accent{color:${ACCENT}}
    .lbl{font-size:6.5px;text-transform:uppercase;letter-spacing:.04em;color:#3f3f46;font-weight:700}
    .val{font-weight:700;font-size:10px}
    table.rep{width:100%;height:100%;border-collapse:collapse;table-layout:fixed}
    table.rep th{font-size:7px;text-transform:uppercase;border:.8px solid #000;padding:2px;background:#f4f4f5}
    table.rep td{border-right:.8px solid #000;border-bottom:1px dotted #b0b0b0;font-size:8.5px;padding:1px 3px}
    table.rep td.n{text-align:center;color:#52525b;font-size:7.5px}
    table.rep td.d{border-right:.8px solid #000}
    table.rep td.m{text-align:right}
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
