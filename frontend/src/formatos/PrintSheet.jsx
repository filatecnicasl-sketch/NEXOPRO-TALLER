import { pageDimensions } from "@/formatos/format";
import { ElementContent } from "@/formatos/ElementContent";

// Hoja oculta en pantalla; se renderiza a tamaño real (mm) solo al imprimir.
export function PrintSheet({ template, formData, signatures }) {
  const { w, h } = pageDimensions(template.page);
  const cssSize = template.page.orientation === "landscape"
    ? `${template.page.size} landscape`
    : template.page.size;

  return (
    <>
      <style>{`
        .fmt-print-sheet { display: none; }
        @media print {
          @page { size: ${cssSize}; margin: 0; }
          body { margin: 0 !important; }
          body * { visibility: hidden !important; }
          .fmt-print-sheet, .fmt-print-sheet * { visibility: visible !important; }
          .fmt-print-sheet { display: block !important; position: absolute; left: 0; top: 0; z-index: 99999; }
        }
      `}</style>
      <div className="fmt-print-sheet">
        <div style={{ position: "relative", width: `${w}mm`, height: `${h}mm`, background: "#fff", overflow: "hidden" }}>
          {template.elements.map((el) => (
            <div key={el.id} style={{ position: "absolute", left: `${el.x}mm`, top: `${el.y}mm`, width: `${el.w}mm`, height: `${el.h}mm` }}>
              <ElementContent el={el} variant="print" zoom={1} formData={formData} signatures={signatures}
                onFormValue={() => undefined} onSignature={() => undefined} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
