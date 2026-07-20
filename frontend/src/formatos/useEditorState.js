import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { genId } from "@/formatos/editorUtils";
import { buildRecepcionVehiculo } from "@/formatos/builtinTemplates";
import { getFormatos, createFormato, updateFormato, deleteFormato } from "@/lib/api";

export function useEditorState() {
  const [templates, setTemplates] = useState([]);
  const [currentId, setCurrentId] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("design");
  const [formData, setFormData] = useState({});
  const [signatures, setSignatures] = useState({});
  const [loading, setLoading] = useState(true);
  const timers = useRef({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        let list = await getFormatos();
        if (!list || list.length === 0) {
          const created = await createFormato(buildRecepcionVehiculo());
          list = [created];
        }
        if (!cancel) { setTemplates(list); setCurrentId(list[0].id); }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.id === currentId) || templates[0],
    [templates, currentId],
  );

  const scheduleSave = useCallback((t) => {
    if (!t) return;
    if (timers.current[t.id]) clearTimeout(timers.current[t.id]);
    timers.current[t.id] = setTimeout(() => {
      updateFormato(t.id, { name: t.name, page: t.page, elements: t.elements }).catch(() => {});
    }, 700);
  }, []);

  const updateTemplate = useCallback((updater) => {
    setTemplates((prev) => {
      const next = prev.map((t) => (t.id === currentId ? updater(t) : t));
      const changed = next.find((t) => t.id === currentId);
      scheduleSave(changed);
      return next;
    });
  }, [currentId, scheduleSave]);

  const updateElement = useCallback((id, patch) => {
    updateTemplate((t) => ({ ...t, elements: t.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) }));
  }, [updateTemplate]);

  const addElement = useCallback((el) => {
    updateTemplate((t) => ({ ...t, elements: [...t.elements, el] }));
    setSelectedId(el.id);
  }, [updateTemplate]);

  const removeElement = useCallback((id) => {
    updateTemplate((t) => ({ ...t, elements: t.elements.filter((el) => el.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
  }, [updateTemplate]);

  const duplicateElement = useCallback((id) => {
    const el = (template?.elements || []).find((e) => e.id === id);
    if (!el) return;
    addElement({ ...el, id: genId(), x: el.x + 5, y: el.y + 5 });
  }, [template, addElement]);

  const reorderElement = useCallback((id, dir) => {
    updateTemplate((t) => {
      const idx = t.elements.findIndex((e) => e.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= t.elements.length) return t;
      const arr = [...t.elements];
      const [item] = arr.splice(idx, 1);
      arr.splice(to, 0, item);
      return { ...t, elements: arr };
    });
  }, [updateTemplate]);

  const selectTemplate = useCallback((id) => {
    setCurrentId(id); setSelectedId(null); setFormData({}); setSignatures({});
  }, []);

  const createTemplate = useCallback(async (name) => {
    const doc = await createFormato({ name, page: { size: "A4", orientation: "portrait" }, elements: [] });
    setTemplates((prev) => [...prev, doc]);
    selectTemplate(doc.id);
  }, [selectTemplate]);

  const duplicateTemplate = useCallback(async () => {
    if (!template) return;
    const doc = await createFormato({
      name: `${template.name} (copia)`,
      page: template.page,
      elements: template.elements.map((el) => ({ ...el, id: genId() })),
    });
    setTemplates((prev) => [...prev, doc]);
    selectTemplate(doc.id);
  }, [template, selectTemplate]);

  const renameTemplate = useCallback((name) => updateTemplate((t) => ({ ...t, name })), [updateTemplate]);

  const deleteTemplate = useCallback(async () => {
    if (templates.length <= 1 || !template) return;
    const id = template.id;
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    selectTemplate(next[0].id);
    await deleteFormato(id).catch(() => {});
  }, [templates, template, selectTemplate]);

  const importTemplate = useCallback(async (t) => {
    const doc = await createFormato({ name: t.name || "Importado", page: t.page, elements: t.elements || [] });
    setTemplates((prev) => [...prev, doc]);
    selectTemplate(doc.id);
  }, [selectTemplate]);

  const setFormValue = useCallback((key, value) => setFormData((d) => ({ ...d, [key]: value })), []);
  const setSignature = useCallback((elementId, dataUrl) => setSignatures((s) => ({ ...s, [elementId]: dataUrl })), []);
  const clearForm = useCallback(() => { setFormData({}); setSignatures({}); }, []);

  return {
    loading, templates, template, selectedId, setSelectedId,
    mode, setMode, formData, setFormValue, signatures, setSignature, clearForm,
    updateTemplate, updateElement, addElement, removeElement, duplicateElement, reorderElement,
    selectTemplate, createTemplate, duplicateTemplate, renameTemplate, deleteTemplate, importTemplate,
  };
}
