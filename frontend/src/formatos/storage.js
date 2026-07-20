// Exportar / importar plantillas como JSON

export function exportTemplate(t) {
  const data = JSON.stringify({ name: t.name, page: t.page, elements: t.elements }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(t.name || "formato").replace(/[^\w\-]+/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function parseImportedTemplate(str) {
  try {
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.elements)) return null;
    const page = obj.page && obj.page.size ? obj.page : { size: "A4", orientation: "portrait" };
    return { name: obj.name || "Importado", page, elements: obj.elements };
  } catch (e) {
    return null;
  }
}
