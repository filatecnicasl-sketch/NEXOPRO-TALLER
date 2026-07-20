// Constantes del modelo de datos del editor de formatos de impresión

export const PAGE_SIZES_MM = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [216, 279],
};

export function pageDimensions(page) {
  const [pw, ph] = PAGE_SIZES_MM[page.size] || PAGE_SIZES_MM.A4;
  return page.orientation === "landscape" ? { w: ph, h: pw } : { w: pw, h: ph };
}
