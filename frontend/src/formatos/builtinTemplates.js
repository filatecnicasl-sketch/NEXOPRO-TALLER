import { genId } from "@/formatos/editorUtils";

function tx(text, x, y, w, h, fontSize = 8, bold = false, align = "left") {
  return { id: genId(), type: "text", x, y, w, h, text, fontSize, bold, align, color: "#000000" };
}
function fld(label, fieldKey, x, y, w, h = 6, fontSize = 9) {
  return { id: genId(), type: "field", x, y, w, h, label, fieldKey, fontSize, boxed: true };
}
function area(label, fieldKey, x, y, w, h) {
  return { id: genId(), type: "textarea", x, y, w, h, label, fieldKey, fontSize: 8, boxed: true };
}
function chk(label, fieldKey, x, y, w, h = 5, fontSize = 7, bold = false) {
  return { id: genId(), type: "checkbox", x, y, w, h, label, fieldKey, fontSize, bold };
}
function img(src, x, y, w, h) {
  return { id: genId(), type: "image", x, y, w, h, src };
}
function box(x, y, w, h, borderWidth = 1.5) {
  return { id: genId(), type: "rect", x, y, w, h, borderWidth, borderColor: "#000000", background: "" };
}
function firma(label, sublabel, x, y, w, h) {
  return { id: genId(), type: "signature", x, y, w, h, label, sublabel };
}

// Reproduce el "Resguardo de depósito sin presupuesto" (A4 apaisada, 297x210 mm).
export function buildRecepcionVehiculo() {
  const tablaReparaciones = {
    id: genId(), type: "table", x: 18, y: 62, w: 132, h: 112,
    columns: [
      { title: "DESCRIPCIÓN", width: 0.67 },
      { title: "MANO DE OBRA", width: 0.165 },
      { title: "MATERIALES", width: 0.165 },
    ],
    rows: 21, headerFontSize: 6, showRowNumbers: true,
    groupTitle: "REPARACIONES A REALIZAR",
  };

  return {
    name: "Recepción de Vehículo",
    page: { size: "A4", orientation: "landscape" },
    elements: [
      tx("EJEMPLAR PARA EL PRESTADOR DEL SERVICIO", 18, 8, 266, 7, 15, true, "center"),
      fld("NOMBRE DEL TALLER", "taller.nombre", 18, 15, 84, 8),
      fld("CIF", "taller.cif", 107, 15, 35, 8),
      fld("DIRECCIÓN", "taller.direccion", 18, 25, 84, 8),
      fld("RIIA", "taller.riia", 107, 25, 35, 8),
      fld("MAIL", "taller.mail", 18, 35, 84, 8),
      fld("TELÉFONO", "taller.telefono", 107, 35, 35, 8),
      fld("FAX", "taller.fax", 107, 45, 35, 8),
      tx("RESGUARDO DE DEPÓSITO SIN PRESUPUESTO Nº:", 152, 16.5, 88, 4, 7, true),
      fld("", "resguardo.numero", 240, 15.5, 44, 6),
      fld("TITULAR DEL VEHÍCULO", "cliente.titular", 152, 23, 80, 8),
      fld("CIF/DNI TITULAR", "cliente.cifTitular", 236, 23, 48, 8),
      fld("PERSONA SOLICITANTE", "cliente.solicitante", 152, 31.5, 80, 8),
      fld("CIF/DNI SOLICITANTE", "cliente.cifSolicitante", 236, 31.5, 48, 8),
      fld("DIRECCIÓN TITULAR", "cliente.direccion", 152, 40, 80, 8),
      fld("TELÉFONO", "cliente.telefono", 236, 40, 48, 8),
      fld("MAIL", "cliente.mail", 152, 48.5, 80, 8),
      fld("FAX", "cliente.fax", 236, 48.5, 48, 8),
      img("coche-inferior", 153, 57, 27, 9),
      img("coche-superior", 153, 67.5, 27, 11),
      img("coche-lateral", 153, 80, 27, 11),
      fld("FECHA", "vehiculo.fecha", 183, 57, 30, 8),
      fld("MATRÍCULA", "vehiculo.matricula", 217, 57, 32, 8),
      fld("MARCA", "vehiculo.marca", 253, 57, 31, 8),
      fld("KM", "vehiculo.km", 183, 67, 30, 8),
      tx("SEGURO", 217, 70, 14, 4, 6, true),
      chk("SI", "vehiculo.seguroSi", 232, 69, 11, 5),
      chk("NO", "vehiculo.seguroNo", 244, 69, 12, 5),
      fld("MODELO", "vehiculo.modelo", 260, 67, 24, 8),
      tx("COMBUSTIBLE", 183, 79, 24, 4, 6, true),
      chk("R", "vehiculo.combR", 208, 78, 9, 5),
      chk("1/4", "vehiculo.comb14", 218, 78, 11, 5),
      chk("1/2", "vehiculo.comb12", 230, 78, 11, 5),
      chk("3/4", "vehiculo.comb34", 242, 78, 11, 5),
      chk("1", "vehiculo.comb1", 254, 78, 9, 5),
      area("OBSERVACIONES", "vehiculo.observaciones", 183, 85, 101, 9),
      tablaReparaciones,
      box(152, 97, 132, 53, 2),
      tx("RENUNCIA A LA ELABORACIÓN", 156, 99, 124, 6, 12, true, "center"),
      tx("DE PRESUPUESTO PREVIO", 156, 105.5, 124, 6, 12, true, "center"),
      tx("EL CLIENTE TIENE DERECHO A LA ELABORACIÓN DE UN PRESUPUESTO PREVIO. MEDIANTE LA PRESENTE FIRMA EL USUARIO RENUNCIA A LA ELABORACIÓN DE PRESUPUESTO PREVIO Y AUTORIZA A REALIZAR LOS TRABAJOS NECESARIOS PARA LA REPARACIÓN DEL VEHÍCULO Y/O SERVICIOS SOLICITADOS CONFORME A LO REFLEJADO EN ESTE RESGUARDO DE DEPÓSITO.",
        157, 113, 122, 12, 5, true),
      tx("EL PRESTADOR DEL SERVICIO", 157, 137, 62, 3.5, 6, true),
      tx("CONFORME CLIENTE", 224, 137, 56, 3.5, 6, true),
      firma("", "", 224, 140, 56, 9),
      tx("FECHA PREVISTA DE ENTREGA DEL VEHÍCULO REPARADO", 160, 153, 88, 4, 7, true),
      fld("", "entrega.fechaPrevista", 250, 152, 34, 6),
      tx("EL CLIENTE CON LA FIRMA ANTERIOR AUTORIZA AL TALLER A:", 152, 160, 132, 4, 7, true),
      chk("REALIZAR DESPLAZAMIENTOS DE DIAGNÓSTICO", "autoriza.desplazamientos", 152, 166, 64, 8, 5, true),
      chk("UTILIZAR ELEMENTOS, EQUIPOS O CONJUNTOS USADOS O NO ESPECÍFICOS (ART 9 Y 10 DECRETO 9/2003)", "autoriza.usados", 220, 166, 64, 8, 5, true),
      chk("UTILIZAR ELEMENTOS, EQUIPOS O CONJUNTOS RECONSTRUIDOS (ART 9 Y 10 DECRETO 9/2003)", "autoriza.reconstruidos", 152, 175, 64, 8, 5, true),
      chk("RENUNCIA A RETIRAR ELEMENTOS SUSTITUIDOS TRAS REPARACIÓN", "autoriza.renunciaRetirar", 220, 175, 64, 8, 5, true),
      tx("Protección de Datos de Carácter Personal: con la firma del presente usted, presta su consentimiento para que sus datos, sean tratados mientras que no comunique lo contrario por este taller, con la finalidad de gestión contable/administrativa de los servicios. Podrá ejercitar sus derechos de acceso, rectificación, supresión, oposición, y los demás reconocidos en esta norma, enviando solicitud a la dirección indicada, remitiendo copia de su DNI. Puede ejercitar el derecho a presentar una reclamación ante la Agencia Española de Protección de Datos.",
        18, 179, 130, 17, 4.5, false),
      tx("SI TRANSCURRIDOS TRES DÍAS DESDE LA PUESTA EN CONOCIMIENTO DEL CLIENTE DE LA FINALIZACIÓN DE LOS TRABAJOS DE ELABORACIÓN DEL PRESUPUESTO O REPARACIÓN DEL VEHÍCULO, NO PROCEDE EL CLIENTE AL PRONUNCIAMIENTO SOBRE LA ACEPTACIÓN O NO DEL PRESUPUESTO O A LA RETIRADA DEL VEHÍCULO, SE DEVENGARÁN UNOS GASTOS DIARIOS DE ESTANCIA DE          € MÁS IVA.",
        152, 179, 132, 17, 4.5, true),
    ],
  };
}
