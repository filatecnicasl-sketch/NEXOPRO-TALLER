import { Type, TextCursorInput, AlignLeft, CheckSquare, Image as ImageIcon, Minus, Square, Table as TableIcon, PenTool } from "lucide-react";
import { ELEMENT_NAMES } from "@/formatos/editorUtils";

const ICONS = {
  text: <Type className="h-4 w-4" />,
  field: <TextCursorInput className="h-4 w-4" />,
  textarea: <AlignLeft className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  line: <Minus className="h-4 w-4" />,
  rect: <Square className="h-4 w-4" />,
  table: <TableIcon className="h-4 w-4" />,
  signature: <PenTool className="h-4 w-4" />,
};

const ORDER = ["text", "field", "textarea", "checkbox", "image", "line", "rect", "table", "signature"];

export function Palette({ onAdd, disabled }) {
  return (
    <div className="flex w-44 shrink-0 flex-col gap-1 overflow-auto border-r bg-white p-2">
      <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Elementos</div>
      {ORDER.map((t) => (
        <button key={t} type="button" disabled={disabled} data-testid={`fmt-add-${t}`} onClick={() => onAdd(t)}
          className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">
          {ICONS[t]}{ELEMENT_NAMES[t]}
        </button>
      ))}
      <div className="mt-2 px-1 text-[11px] leading-snug text-slate-400">
        Pulsa para añadir al centro de la página. Arrastra para mover y usa los tiradores para redimensionar.
      </div>
    </div>
  );
}
