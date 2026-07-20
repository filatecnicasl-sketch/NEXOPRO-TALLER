import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEditorState } from "@/formatos/useEditorState";
import { pageDimensions } from "@/formatos/format";
import { PX_PER_MM, createElement } from "@/formatos/editorUtils";
import { TopBar } from "@/formatos/TopBar";
import { Palette } from "@/formatos/Palette";
import { PropertiesPanel } from "@/formatos/PropertiesPanel";
import { EditorCanvas } from "@/formatos/EditorCanvas";
import { PrintSheet } from "@/formatos/PrintSheet";

export default function FormatosEditor() {
  const ed = useEditorState();
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef(null);
  const design = ed.mode === "design";

  const fitZoom = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !ed.template) return 1;
    const { w, h } = pageDimensions(ed.template.page);
    const zx = (wrap.clientWidth - 60) / (w * PX_PER_MM);
    const zy = (wrap.clientHeight - 60) / (h * PX_PER_MM);
    return Math.min(2.5, Math.max(0.2, Math.min(zx, zy)));
  }, [ed.template]);

  const onFit = useCallback(() => setZoom(fitZoom()), [fitZoom]);

  useEffect(() => {
    if (ed.template) setZoom(fitZoom());
  }, [fitZoom, ed.template?.id]);

  if (ed.loading || !ed.template) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500 text-sm" data-testid="fmt-loading">
        Cargando formatos…
      </div>
    );
  }

  const addElement = (type) => {
    const { w, h } = pageDimensions(ed.template.page);
    const el = createElement(type);
    el.x = Math.max(5, w / 2 - el.w / 2);
    el.y = Math.max(5, h / 2 - el.h / 2);
    ed.addElement(el);
  };

  const selected = ed.template.elements.find((e) => e.id === ed.selectedId) || null;

  return (
    <div className="flex h-screen flex-col overflow-hidden" data-testid="formatos-editor">
      <div className="app-screen flex h-full flex-col">
        <div className="flex items-center gap-2 border-b bg-slate-800 px-3 py-1.5">
          <Link to="/ajustes" data-testid="fmt-back" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/90 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" /> Volver a Ajustes
          </Link>
        </div>
        <TopBar
          templates={ed.templates}
          currentId={ed.template.id}
          mode={ed.mode}
          zoom={zoom}
          onZoom={setZoom}
          onFit={onFit}
          onSetMode={ed.setMode}
          onSelectTemplate={ed.selectTemplate}
          onCreateTemplate={() => ed.createTemplate(`Formato ${ed.templates.length + 1}`)}
          onDuplicateTemplate={ed.duplicateTemplate}
          onDeleteTemplate={ed.deleteTemplate}
          onImportTemplate={ed.importTemplate}
          onClearForm={ed.clearForm}
        />
        <div className="flex min-h-0 flex-1">
          {design && <Palette onAdd={addElement} disabled={!design} />}
          <div ref={wrapRef} className="min-w-0 flex-1">
            <EditorCanvas
              template={ed.template}
              zoom={zoom}
              mode={ed.mode}
              selectedId={ed.selectedId}
              onSelect={ed.setSelectedId}
              onUpdateElement={ed.updateElement}
              onRemoveElement={ed.removeElement}
              onDuplicateElement={ed.duplicateElement}
              formData={ed.formData}
              signatures={ed.signatures}
              onFormValue={ed.setFormValue}
              onSignature={ed.setSignature}
            />
          </div>
          {design && (
            <PropertiesPanel
              template={ed.template}
              element={selected}
              onUpdateElement={ed.updateElement}
              onUpdateTemplate={(p) => ed.updateTemplate((t) => ({ ...t, ...p }))}
              onRemoveElement={ed.removeElement}
              onDuplicateElement={ed.duplicateElement}
              onReorderElement={ed.reorderElement}
            />
          )}
        </div>
      </div>
      <PrintSheet template={ed.template} formData={ed.formData} signatures={ed.signatures} />
    </div>
  );
}
