import { ELEMENT_NAMES, round1 } from "@/formatos/editorUtils";
import { BUILTIN_IMAGES, BUILTIN_IMAGE_NAMES } from "@/formatos/assets";
import { Trash2, Copy, Lock, Unlock, ChevronUp, ChevronDown, Plus, X } from "lucide-react";

const inputCls = "w-full rounded border border-slate-300 px-1.5 py-1 text-xs outline-none focus:border-blue-500";
const labelCls = "mb-0.5 block text-[11px] font-medium text-slate-500";

function Num({ label, value, onChange, step = 0.5, min }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <input type="number" className={inputCls} value={value} step={step} min={min}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(round1(v)); }} />
    </div>
  );
}
function Txt({ label, value, onChange }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Bool({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />{label}
    </label>
  );
}

export function PropertiesPanel({ template, element, onUpdateElement, onUpdateTemplate, onRemoveElement, onDuplicateElement, onReorderElement }) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 overflow-auto border-l bg-white p-3">
      {element ? (
        <ElementProps element={element}
          onUpdate={(p) => onUpdateElement(element.id, p)}
          onRemove={() => onRemoveElement(element.id)}
          onDuplicate={() => onDuplicateElement(element.id)}
          onReorder={(dir) => onReorderElement(element.id, dir)} />
      ) : (
        <PageProps template={template} onUpdateTemplate={onUpdateTemplate} />
      )}
    </div>
  );
}

function PageProps({ template, onUpdateTemplate }) {
  return (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Página</div>
      <div>
        <span className={labelCls}>Tamaño</span>
        <select className={inputCls} value={template.page.size}
          onChange={(e) => onUpdateTemplate({ page: { ...template.page, size: e.target.value } })}>
          <option value="A4">A4</option><option value="A5">A5</option><option value="Letter">Carta</option>
        </select>
      </div>
      <div>
        <span className={labelCls}>Orientación</span>
        <select className={inputCls} value={template.page.orientation}
          onChange={(e) => onUpdateTemplate({ page: { ...template.page, orientation: e.target.value } })}>
          <option value="portrait">Vertical</option><option value="landscape">Apaisada</option>
        </select>
      </div>
      <div>
        <span className={labelCls}>Nombre de la plantilla</span>
        <input className={inputCls} value={template.name} onChange={(e) => onUpdateTemplate({ name: e.target.value })} />
      </div>
      <div className="rounded-md bg-slate-50 p-2 text-[11px] leading-snug text-slate-500">
        Selecciona un elemento de la página para editar sus propiedades. Atajos: <b>Supr</b> elimina, <b>Ctrl+D</b> duplica, <b>flechas</b> mueven.
      </div>
    </>
  );
}

function ElementProps({ element: el, onUpdate, onRemove, onDuplicate, onReorder }) {
  const upImage = (e) => {
    const f = e.target.files?.[0];
    if (!f || el.type !== "image") return;
    const reader = new FileReader();
    reader.onload = () => onUpdate({ src: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ELEMENT_NAMES[el.type]}</span>
        <div className="flex gap-1">
          <button title="Subir (encima)" className="rounded p-1 hover:bg-slate-100" onClick={() => onReorder(1)}><ChevronUp className="h-4 w-4 text-slate-600" /></button>
          <button title="Bajar (debajo)" className="rounded p-1 hover:bg-slate-100" onClick={() => onReorder(-1)}><ChevronDown className="h-4 w-4 text-slate-600" /></button>
          <button title={el.locked ? "Desbloquear" : "Bloquear"} className="rounded p-1 hover:bg-slate-100" onClick={() => onUpdate({ locked: !el.locked })}>
            {el.locked ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-slate-600" />}
          </button>
          <button title="Duplicar (Ctrl+D)" className="rounded p-1 hover:bg-slate-100" onClick={onDuplicate}><Copy className="h-4 w-4 text-slate-600" /></button>
          <button title="Eliminar (Supr)" className="rounded p-1 hover:bg-red-50" onClick={onRemove}><Trash2 className="h-4 w-4 text-red-600" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Num label="X (mm)" value={el.x} onChange={(v) => onUpdate({ x: v })} min={0} />
        <Num label="Y (mm)" value={el.y} onChange={(v) => onUpdate({ y: v })} min={0} />
        <Num label="Ancho (mm)" value={el.w} onChange={(v) => onUpdate({ w: Math.max(3, v) })} min={3} />
        <Num label="Alto (mm)" value={el.h} onChange={(v) => onUpdate({ h: Math.max(2, v) })} min={2} />
      </div>

      {el.type === "text" && (
        <>
          <div><span className={labelCls}>Texto</span>
            <textarea className={`${inputCls} h-16 resize-none`} value={el.text} onChange={(e) => onUpdate({ text: e.target.value })} /></div>
          <Num label="Tamaño (pt)" value={el.fontSize} onChange={(v) => onUpdate({ fontSize: v })} step={0.5} min={3} />
          <div className="flex items-center gap-3">
            <Bool label="Negrita" value={el.bold} onChange={(v) => onUpdate({ bold: v })} />
            <select className={inputCls} value={el.align} onChange={(e) => onUpdate({ align: e.target.value })}>
              <option value="left">Izquierda</option><option value="center">Centrado</option><option value="right">Derecha</option>
            </select>
          </div>
          <div><span className={labelCls}>Color</span>
            <input type="color" className="h-7 w-full cursor-pointer" value={el.color} onChange={(e) => onUpdate({ color: e.target.value })} /></div>
        </>
      )}

      {(el.type === "field" || el.type === "textarea") && (
        <>
          <Txt label="Etiqueta" value={el.label} onChange={(v) => onUpdate({ label: v })} />
          <Txt label="Clave de dato (NEXOPRO)" value={el.fieldKey} onChange={(v) => onUpdate({ fieldKey: v })} />
          <Num label="Tamaño letra (pt)" value={el.fontSize} onChange={(v) => onUpdate({ fontSize: v })} step={0.5} min={5} />
          <Bool label="Con recuadro" value={el.boxed} onChange={(v) => onUpdate({ boxed: v })} />
        </>
      )}

      {el.type === "checkbox" && (
        <>
          <Txt label="Texto" value={el.label} onChange={(v) => onUpdate({ label: v })} />
          <Txt label="Clave de dato" value={el.fieldKey} onChange={(v) => onUpdate({ fieldKey: v })} />
          <Num label="Tamaño letra (pt)" value={el.fontSize} onChange={(v) => onUpdate({ fontSize: v })} step={0.5} min={4} />
          <Bool label="Negrita" value={el.bold} onChange={(v) => onUpdate({ bold: v })} />
        </>
      )}

      {el.type === "image" && (
        <>
          <div><span className={labelCls}>Imagen integrada</span>
            <select className={inputCls} value={BUILTIN_IMAGES[el.src] ? el.src : ""} onChange={(e) => e.target.value && onUpdate({ src: e.target.value })}>
              <option value="">(personalizada)</option>
              {Object.keys(BUILTIN_IMAGES).map((k) => (<option key={k} value={k}>{BUILTIN_IMAGE_NAMES[k]}</option>))}
            </select></div>
          <div><span className={labelCls}>Subir imagen</span>
            <input type="file" accept="image/*" className="text-xs" onChange={upImage} /></div>
        </>
      )}

      {el.type === "line" && (
        <>
          <div><span className={labelCls}>Orientación</span>
            <select className={inputCls} value={el.orientation} onChange={(e) => onUpdate({ orientation: e.target.value })}>
              <option value="h">Horizontal</option><option value="v">Vertical</option>
            </select></div>
          <Num label="Grosor (px)" value={el.thickness} onChange={(v) => onUpdate({ thickness: Math.max(0.5, v) })} step={0.5} min={0.5} />
          <div><span className={labelCls}>Color</span>
            <input type="color" className="h-7 w-full cursor-pointer" value={el.color} onChange={(e) => onUpdate({ color: e.target.value })} /></div>
        </>
      )}

      {el.type === "rect" && (
        <>
          <Num label="Grosor borde (px)" value={el.borderWidth} onChange={(v) => onUpdate({ borderWidth: Math.max(0, v) })} step={0.5} min={0} />
          <div><span className={labelCls}>Color borde</span>
            <input type="color" className="h-7 w-full cursor-pointer" value={el.borderColor} onChange={(e) => onUpdate({ borderColor: e.target.value })} /></div>
          <Txt label="Fondo (vacío = transparente)" value={el.background} onChange={(v) => onUpdate({ background: v })} />
        </>
      )}

      {el.type === "table" && <TableProps el={el} onUpdate={onUpdate} />}

      {el.type === "signature" && (
        <>
          <Txt label="Etiqueta" value={el.label} onChange={(v) => onUpdate({ label: v })} />
          <Txt label="Texto bajo la línea" value={el.sublabel} onChange={(v) => onUpdate({ sublabel: v })} />
        </>
      )}
    </>
  );
}

function TableProps({ el, onUpdate }) {
  const setCol = (i, patch) => {
    const columns = el.columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onUpdate({ columns });
  };
  return (
    <>
      <Txt label="Título agrupado" value={el.groupTitle} onChange={(v) => onUpdate({ groupTitle: v })} />
      <Num label="Filas" value={el.rows} onChange={(v) => onUpdate({ rows: Math.max(1, Math.round(v)) })} step={1} min={1} />
      <Num label="Tamaño letra (pt)" value={el.headerFontSize} onChange={(v) => onUpdate({ headerFontSize: v })} step={0.5} min={4} />
      <Bool label="Numerar filas" value={el.showRowNumbers} onChange={(v) => onUpdate({ showRowNumbers: v })} />
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className={labelCls}>Columnas</span>
          <button className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] hover:bg-slate-200"
            onClick={() => onUpdate({ columns: [...el.columns, { title: "NUEVA", width: 0.2 }] })}>
            <Plus className="h-3 w-3" /> Añadir
          </button>
        </div>
        {el.columns.map((c, i) => (
          <div key={i} className="mb-1 flex items-center gap-1">
            <input className={`${inputCls} flex-1`} value={c.title} onChange={(e) => setCol(i, { title: e.target.value })} />
            <input type="number" className={`${inputCls} w-14`} value={c.width} step={0.05} min={0.05} title="Fracción del ancho"
              onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) setCol(i, { width: Math.max(0.05, v) }); }} />
            <button className="rounded p-1 hover:bg-red-50" disabled={el.columns.length <= 1}
              onClick={() => onUpdate({ columns: el.columns.filter((_, idx) => idx !== i) })}>
              <X className="h-3.5 w-3.5 text-red-600" />
            </button>
          </div>
        ))}
        <div className="text-[10px] text-slate-400">El número es la fracción del ancho total de cada columna.</div>
      </div>
    </>
  );
}
