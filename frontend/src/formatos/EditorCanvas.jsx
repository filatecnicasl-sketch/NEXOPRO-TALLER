import { useCallback, useEffect, useRef } from "react";
import { pageDimensions } from "@/formatos/format";
import { PX_PER_MM, round1 } from "@/formatos/editorUtils";
import { ElementContent } from "@/formatos/ElementContent";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_POS = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

function snap(v) { return Math.round(v * 2) / 2; }

export function EditorCanvas({
  template, zoom, mode, selectedId, onSelect, onUpdateElement,
  onRemoveElement, onDuplicateElement, formData, signatures, onFormValue, onSignature,
}) {
  const scale = PX_PER_MM * zoom;
  const { w: pageW, h: pageH } = pageDimensions(template.page);
  const drag = useRef(null);
  const design = mode === "design";

  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const o = d.orig;
    let { x, y, w, h } = o;
    if (!d.handle) {
      x = snap(o.x + dx); y = snap(o.y + dy);
    } else {
      if (d.handle.includes("e")) w = Math.max(3, snap(o.w + dx));
      if (d.handle.includes("s")) h = Math.max(2, snap(o.h + dy));
      if (d.handle.includes("w")) { const nx = snap(o.x + dx); w = Math.max(3, o.w + (o.x - nx)); x = o.x + o.w - w; }
      if (d.handle.includes("n")) { const ny = snap(o.y + dy); h = Math.max(2, o.h + (o.y - ny)); y = o.y + o.h - h; }
    }
    x = Math.max(0, Math.min(x, pageW - w));
    y = Math.max(0, Math.min(y, pageH - h));
    onUpdateElement(d.id, { x: round1(x), y: round1(y), w: round1(w), h: round1(h) });
  }, [scale, pageW, pageH, onUpdateElement]);

  const endDrag = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
  }, [onPointerMove]);

  const startDrag = useCallback((e, el, handle) => {
    if (!design || el.locked) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    drag.current = { id: el.id, startX: e.clientX, startY: e.clientY, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, handle };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag, { once: true });
  }, [design, onSelect, onPointerMove, endDrag]);

  useEffect(() => {
    if (!design) return;
    const onKey = (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!selectedId) return;
      const el = template.elements.find((x) => x.id === selectedId);
      if (!el || el.locked) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onRemoveElement(selectedId); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); onDuplicateElement(selectedId); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 1;
        const patch = {};
        if (e.key === "ArrowLeft") patch.x = round1(Math.max(0, el.x - step));
        if (e.key === "ArrowRight") patch.x = round1(Math.min(pageW - el.w, el.x + step));
        if (e.key === "ArrowUp") patch.y = round1(Math.max(0, el.y - step));
        if (e.key === "ArrowDown") patch.y = round1(Math.min(pageH - el.h, el.y + step));
        onUpdateElement(selectedId, patch);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [design, selectedId, template.elements, onRemoveElement, onDuplicateElement, onUpdateElement, pageW, pageH]);

  return (
    <div className="flex h-full w-full items-start justify-center overflow-auto bg-slate-200 p-6">
      <div className="relative shrink-0 bg-white shadow-xl"
        style={{
          width: pageW * scale, height: pageH * scale,
          backgroundImage: design ? "radial-gradient(circle, #cbd5e1 1px, transparent 1px)" : undefined,
          backgroundSize: design ? `${5 * scale}px ${5 * scale}px` : undefined,
        }}
        onPointerDown={() => design && onSelect(null)}>
        {template.elements.map((el) => {
          const selected = design && el.id === selectedId;
          return (
            <div key={el.id} className="absolute"
              style={{
                left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale,
                outline: selected ? "2px solid #2563eb" : design ? "1px dashed rgba(100,116,139,0.35)" : undefined,
                cursor: design && !el.locked ? "move" : undefined,
                touchAction: design ? "none" : undefined,
              }}
              onPointerDown={(e) => startDrag(e, el, null)}>
              <ElementContent el={el} variant={design ? "design" : "fill"} zoom={zoom}
                formData={formData} signatures={signatures} onFormValue={onFormValue} onSignature={onSignature} />
              {selected && !el.locked && HANDLES.map((h) => (
                <div key={h}
                  className={`absolute z-10 h-2.5 w-2.5 rounded-sm border border-white bg-blue-600 ${HANDLE_POS[h]}`}
                  onPointerDown={(e) => startDrag(e, el, h)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
