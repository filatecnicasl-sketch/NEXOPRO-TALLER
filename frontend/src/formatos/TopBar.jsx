import { useRef } from "react";
import { Printer, Pencil, FilePlus2, Copy, Trash2, Download, Upload, ZoomIn, ZoomOut, Maximize, Eraser, PenLine } from "lucide-react";
import { exportTemplate, parseImportedTemplate } from "@/formatos/storage";

const btn = "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition disabled:opacity-40";
const btnGhost = `${btn} text-slate-600 hover:bg-slate-100`;
const iconBtn = "rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40";

export function TopBar({
  templates, currentId, mode, zoom, onZoom, onFit, onSetMode,
  onSelectTemplate, onCreateTemplate, onDuplicateTemplate, onDeleteTemplate,
  onImportTemplate, onClearForm,
}) {
  const fileRef = useRef(null);
  const current = templates.find((t) => t.id === currentId);
  const design = mode === "design";

  const onImportFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const t = parseImportedTemplate(String(reader.result));
      if (t) onImportTemplate(t);
      else alert("El archivo no es una plantilla válida.");
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
      <div className="flex items-center gap-2 pr-2">
        <Printer className="h-5 w-5 text-blue-700" />
        <span className="hidden text-sm font-bold text-slate-800 lg:inline">Formatos de impresión</span>
      </div>

      <select data-testid="fmt-template-select"
        className="max-w-52 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        value={currentId} onChange={(e) => onSelectTemplate(e.target.value)}>
        {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
      </select>

      <button className={iconBtn} title="Nueva plantilla" data-testid="fmt-new" onClick={onCreateTemplate} disabled={!design}><FilePlus2 className="h-4 w-4" /></button>
      <button className={iconBtn} title="Duplicar plantilla" data-testid="fmt-duplicate" onClick={onDuplicateTemplate} disabled={!design}><Copy className="h-4 w-4" /></button>
      <button className={iconBtn} title="Eliminar plantilla" data-testid="fmt-delete" onClick={onDeleteTemplate} disabled={!design || templates.length <= 1}><Trash2 className="h-4 w-4 text-red-600" /></button>
      <button className={iconBtn} title="Exportar plantilla (JSON)" disabled={!current} onClick={() => current && exportTemplate(current)}><Download className="h-4 w-4" /></button>
      <button className={iconBtn} title="Importar plantilla (JSON)" onClick={() => fileRef.current?.click()} disabled={!design}><Upload className="h-4 w-4" /></button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />

      <div className="mx-1 h-6 w-px bg-slate-200" />

      <div className="flex rounded-md border border-slate-300 p-0.5">
        <button data-testid="fmt-mode-design"
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${design ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          onClick={() => onSetMode("design")}><Pencil className="h-3.5 w-3.5" /> Diseñar</button>
        <button data-testid="fmt-mode-fill"
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${!design ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          onClick={() => onSetMode("fill")}><PenLine className="h-3.5 w-3.5" /> Rellenar</button>
      </div>

      <div className="mx-1 h-6 w-px bg-slate-200" />

      <button className={iconBtn} title="Alejar" onClick={() => onZoom(Math.max(0.3, zoom - 0.15))}><ZoomOut className="h-4 w-4" /></button>
      <span className="w-12 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
      <button className={iconBtn} title="Acercar" onClick={() => onZoom(Math.min(2.5, zoom + 0.15))}><ZoomIn className="h-4 w-4" /></button>
      <button className={iconBtn} title="Ajustar a ventana" onClick={onFit}><Maximize className="h-4 w-4" /></button>

      <div className="flex-1" />

      {!design && (
        <button className={btnGhost} onClick={onClearForm} title="Vaciar los datos rellenados"><Eraser className="h-4 w-4" /> Limpiar</button>
      )}
      <button data-testid="fmt-print" className={`${btn} bg-blue-700 font-medium text-white hover:bg-blue-800`} onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Imprimir / PDF
      </button>
    </div>
  );
}
