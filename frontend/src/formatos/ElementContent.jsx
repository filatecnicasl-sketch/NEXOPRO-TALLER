import { PX_PER_MM } from "@/formatos/editorUtils";
import { resolveImageSrc } from "@/formatos/assets";
import { SignatureField } from "@/formatos/SignatureField";

const PT_TO_PX = 96 / 72;

export function ElementContent(props) {
  const { el, variant, zoom } = props;
  const print = variant === "print";
  const scale = PX_PER_MM * zoom;

  const fs = (pt) => (print ? `${pt}pt` : `${pt * PT_TO_PX * zoom}px`);
  const mm = (v) => (print ? `${v}mm` : `${v * scale}px`);

  const sub = {
    variant, zoom,
    formData: props.formData,
    signatures: props.signatures,
    onFormValue: props.onFormValue,
    onSignature: props.onSignature,
    fs, mm, scale,
  };

  switch (el.type) {
    case "text": return <TextView el={el} fs={fs} />;
    case "field": return <FieldView el={el} {...sub} />;
    case "textarea": return <TextareaView el={el} {...sub} />;
    case "checkbox": return <CheckboxView el={el} {...sub} />;
    case "image": return <ImageView el={el} />;
    case "line": return <LineView el={el} mm={mm} />;
    case "rect": return <RectView el={el} />;
    case "table": return <TableView el={el} {...sub} />;
    case "signature": return <SignatureView el={el} {...sub} />;
    default: return null;
  }
}

function TextView({ el, fs }) {
  return (
    <div className="h-full w-full overflow-hidden"
      style={{ fontSize: fs(el.fontSize), fontWeight: el.bold ? 700 : 400, textAlign: el.align, color: el.color, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>
      {el.text}
    </div>
  );
}

function FieldView({ el, variant, formData, onFormValue, fs, mm }) {
  const labelH = el.label ? 3 : 0;
  const value = String(formData[el.fieldKey] ?? "");
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {el.label && (
        <div style={{ fontSize: fs(5.5), fontWeight: 700, height: mm(labelH), lineHeight: 1.1 }} className="shrink-0 uppercase">{el.label}</div>
      )}
      <div className="relative min-h-0 flex-1" style={el.boxed ? { border: "1px solid #333" } : { borderBottom: "1px solid #333" }}>
        {variant === "fill" ? (
          <input value={value} onChange={(e) => onFormValue(el.fieldKey, e.target.value)}
            className="h-full w-full bg-transparent px-1 outline-none" style={{ fontSize: fs(el.fontSize) }} />
        ) : (
          <div className="h-full w-full truncate px-1" style={{ fontSize: fs(el.fontSize), lineHeight: 1.3 }}>{value}</div>
        )}
      </div>
    </div>
  );
}

function TextareaView({ el, variant, formData, onFormValue, fs, mm }) {
  const value = String(formData[el.fieldKey] ?? "");
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {el.label && (
        <div style={{ fontSize: fs(5.5), fontWeight: 700, height: mm(3), lineHeight: 1.1 }} className="shrink-0 uppercase">{el.label}</div>
      )}
      <div className="relative min-h-0 flex-1" style={el.boxed ? { border: "1px solid #333" } : undefined}>
        {variant === "fill" ? (
          <textarea value={value} onChange={(e) => onFormValue(el.fieldKey, e.target.value)}
            className="h-full w-full resize-none bg-transparent px-1 outline-none" style={{ fontSize: fs(el.fontSize), lineHeight: 1.3 }} />
        ) : (
          <div className="h-full w-full overflow-hidden px-1" style={{ fontSize: fs(el.fontSize), lineHeight: 1.3, whiteSpace: "pre-wrap" }}>{value}</div>
        )}
      </div>
    </div>
  );
}

function CheckboxView({ el, variant, formData, onFormValue, fs, mm, scale }) {
  const checked = formData[el.fieldKey] === true;
  const boxMm = Math.min(3.5, el.h - 0.5);
  const inner = (
    <>
      <div className="flex shrink-0 items-center justify-center"
        style={{ width: mm(boxMm), height: mm(boxMm), border: `${variant === "print" ? 1 : Math.max(1, scale * 0.3)}px solid #000`, fontSize: fs(el.fontSize + 2), fontWeight: 700, lineHeight: 1 }}>
        {checked ? "✕" : ""}
      </div>
      {el.label && (
        <div style={{ fontSize: fs(el.fontSize), fontWeight: el.bold ? 700 : 400, lineHeight: 1.2, marginLeft: mm(1.5) }}>{el.label}</div>
      )}
    </>
  );
  if (variant === "fill") {
    return (
      <button type="button" onClick={() => onFormValue(el.fieldKey, !checked)}
        className="flex h-full w-full cursor-pointer items-start overflow-hidden text-left">{inner}</button>
    );
  }
  return <div className="flex h-full w-full items-start overflow-hidden">{inner}</div>;
}

function ImageView({ el }) {
  return <img src={resolveImageSrc(el.src)} alt="" draggable={false} className="h-full w-full select-none" style={{ objectFit: "fill" }} />;
}

function LineView({ el, mm }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div style={el.orientation === "h"
        ? { width: "100%", borderTop: `${el.thickness}px solid ${el.color}` }
        : { height: "100%", borderLeft: `${el.thickness}px solid ${el.color}`, width: mm(0.5) }} />
    </div>
  );
}

function RectView({ el }) {
  return <div className="h-full w-full" style={{ border: `${el.borderWidth}px solid ${el.borderColor}`, background: el.background || "transparent" }} />;
}

function TableView({ el, variant, formData, onFormValue, fs, mm }) {
  const numCol = el.showRowNumbers ? 5 : 0;
  const totalFrac = el.columns.reduce((a, c) => a + c.width, 0) || 1;
  const availW = el.w - numCol;
  const groupH = el.groupTitle ? 5 : 0;
  const headH = 5;
  const border = "1px solid #000";
  const cellKey = (r, c) => `tbl_${el.id}_${r}_${c}`;

  return (
    <table className="h-full w-full" style={{ borderCollapse: "collapse", tableLayout: "fixed", border }}>
      <colgroup>
        {el.showRowNumbers && <col style={{ width: mm(numCol) }} />}
        {el.columns.map((c, i) => (<col key={i} style={{ width: mm((c.width / totalFrac) * availW) }} />))}
      </colgroup>
      <tbody>
        {el.groupTitle && (
          <tr style={{ height: mm(groupH) }}>
            <td colSpan={el.columns.length + (el.showRowNumbers ? 1 : 0)}
              style={{ border, textAlign: "center", fontWeight: 700, fontSize: fs(el.headerFontSize + 1), padding: 0 }}>{el.groupTitle}</td>
          </tr>
        )}
        <tr style={{ height: mm(headH) }}>
          {el.showRowNumbers && <td style={{ border, padding: 0 }} />}
          {el.columns.map((c, i) => (
            <td key={i} style={{ border, textAlign: "center", fontWeight: 700, fontSize: fs(el.headerFontSize), padding: 0 }}>{c.title}</td>
          ))}
        </tr>
        {Array.from({ length: el.rows }, (_, r) => (
          <tr key={r} style={{ height: mm(Math.max(2, (el.h - groupH - headH) / el.rows)) }}>
            {el.showRowNumbers && (
              <td style={{ border, textAlign: "center", fontSize: fs(el.headerFontSize), padding: 0 }}>{r + 1}</td>
            )}
            {el.columns.map((_, c) => (
              <td key={c} style={{ border, padding: 0 }}>
                {variant === "fill" ? (
                  <input value={String(formData[cellKey(r, c)] ?? "")} onChange={(e) => onFormValue(cellKey(r, c), e.target.value)}
                    className="h-full w-full bg-transparent px-0.5 outline-none" style={{ fontSize: fs(el.headerFontSize) }} />
                ) : (
                  <div className="truncate px-0.5" style={{ fontSize: fs(el.headerFontSize) }}>{String(formData[cellKey(r, c)] ?? "")}</div>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SignatureView({ el, variant, signatures, onSignature, fs, mm, zoom }) {
  const dataUrl = signatures[el.id];
  const lineH = 3;
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {el.label && (
        <div style={{ fontSize: fs(5.5), fontWeight: 700, height: mm(lineH), lineHeight: 1.1 }} className="shrink-0 uppercase">{el.label}</div>
      )}
      <div className="relative min-h-0 flex-1" style={{ borderBottom: "1px solid #000" }}>
        {variant === "fill" ? (
          <SignatureField value={dataUrl} onChange={(d) => onSignature(el.id, d)}
            widthPx={el.w * PX_PER_MM * zoom}
            heightPx={Math.max(20, el.h * PX_PER_MM * zoom - lineH * PX_PER_MM * zoom)} />
        ) : dataUrl ? (
          <img src={dataUrl} alt="firma" className="h-full w-full" style={{ objectFit: "contain" }} />
        ) : null}
      </div>
      {el.sublabel && (
        <div style={{ fontSize: fs(5), height: mm(2.5), lineHeight: 1.1 }} className="shrink-0">{el.sublabel}</div>
      )}
    </div>
  );
}
