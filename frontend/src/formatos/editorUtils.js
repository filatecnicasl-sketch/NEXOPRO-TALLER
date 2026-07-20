export const PX_PER_MM = 96 / 25.4;

let counter = 0;
export function genId() {
  counter += 1;
  return `el_${Date.now().toString(36)}_${counter}`;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function createElement(type, x = 20, y = 20) {
  const id = genId();
  switch (type) {
    case "text":
      return { id, type, x, y, w: 60, h: 8, text: "Texto", fontSize: 10, bold: false, align: "left", color: "#000000" };
    case "field":
      return { id, type, x, y, w: 55, h: 12, label: "CAMPO", fieldKey: `campo_${counter}`, fontSize: 10, boxed: true };
    case "textarea":
      return { id, type, x, y, w: 80, h: 25, label: "OBSERVACIONES", fieldKey: `area_${counter}`, fontSize: 9, boxed: true };
    case "checkbox":
      return { id, type, x, y, w: 40, h: 6, label: "Opción", fieldKey: `check_${counter}`, fontSize: 8, bold: false };
    case "image":
      return { id, type, x, y, w: 40, h: 20, src: "coche-lateral" };
    case "line":
      return { id, type, x, y, w: 60, h: 1, orientation: "h", thickness: 1, color: "#000000" };
    case "rect":
      return { id, type, x, y, w: 60, h: 30, borderWidth: 1, borderColor: "#000000", background: "" };
    case "table":
      return {
        id, type, x, y, w: 120, h: 60,
        columns: [
          { title: "DESCRIPCIÓN", width: 0.6 },
          { title: "COLUMNA 2", width: 0.2 },
          { title: "COLUMNA 3", width: 0.2 },
        ],
        rows: 10, headerFontSize: 8, showRowNumbers: true, groupTitle: "",
      };
    case "signature":
      return { id, type, x, y, w: 55, h: 22, label: "FIRMA", sublabel: "" };
    default:
      return { id, type: "text", x, y, w: 60, h: 8, text: "Texto", fontSize: 10, bold: false, align: "left", color: "#000000" };
  }
}

export const ELEMENT_NAMES = {
  text: "Texto",
  field: "Campo",
  textarea: "Área de texto",
  checkbox: "Casilla",
  image: "Imagen",
  line: "Línea",
  rect: "Rectángulo",
  table: "Tabla",
  signature: "Firma",
};
