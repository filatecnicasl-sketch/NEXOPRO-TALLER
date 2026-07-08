import { useState, useRef } from "react";
import { UploadSimple, FilePdf, Sparkle, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { extraerPdf, eur, eurCoste } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function ImportPdfDialog({ open, onOpenChange, onExtracted, titulo = "Importar documento con IA" }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState(null);
  const [consumo, setConsumo] = useState(null);
  const inputRef = useRef();

  const reset = () => { setFile(null); setDatos(null); setConsumo(null); setLoading(false); };

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return toast.error("Solo se aceptan archivos PDF");
    setFile(f);
    setDatos(null);
  };

  const procesar = async () => {
    setLoading(true);
    try {
      const res = await extraerPdf(file);
      setDatos(res.datos);
      setConsumo(res.consumo || null);
      toast.success("Datos extraídos correctamente");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo procesar el PDF");
    } finally {
      setLoading(false);
    }
  };

  const confirmar = () => {
    onExtracted(datos, file);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-2xl rounded-sm" data-testid="import-pdf-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkle size={20} weight="fill" className="text-primary" /> {titulo}
          </DialogTitle>
        </DialogHeader>

        {!file && (
          <div
            data-testid="pdf-dropzone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            className="border-2 border-dashed border-slate-300 rounded-sm py-14 text-center cursor-pointer hover:border-primary hover:bg-accent/40 transition-colors"
          >
            <UploadSimple size={36} className="mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 font-medium">Arrastra el PDF del proveedor aquí</p>
            <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              data-testid="pdf-file-input"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        )}

        {file && (
          <div className="space-y-4">
            <div className="relative flex items-center gap-3 border border-slate-200 rounded-sm p-4 overflow-hidden">
              {loading && <div className="scan-line" />}
              <FilePdf size={28} className="text-red-500 shrink-0" weight="duotone" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{file.name}</div>
                <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</div>
              </div>
              {loading && <span className="ml-auto font-mono-plex text-xs text-primary animate-pulse">Extrayendo datos AI...</span>}
              {datos && <CheckCircle size={22} weight="fill" className="ml-auto text-emerald-500" />}
            </div>

            {datos && (
              <div className="border border-slate-200 rounded-sm p-4 space-y-2 text-sm" data-testid="datos-extraidos">
                <div className="flex justify-between"><span className="text-slate-400">Proveedor</span><span className="font-medium">{datos.proveedor?.nombre || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">NIF/CIF</span><span className="font-mono-plex text-xs">{datos.proveedor?.nif || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Nº documento</span><span>{datos.numero || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fecha</span><span>{datos.fecha || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Líneas detectadas</span><span>{datos.lineas?.length || 0}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-400">Total</span><span className="font-semibold text-primary">{eur(datos.total)}</span></div>
                {datos.proveedor_existente && (
                  <div className="text-xs text-emerald-600 bg-emerald-50 rounded-sm px-2 py-1">✓ Proveedor encontrado en tu base de datos</div>
                )}
                {consumo && (
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-sm px-2 py-1.5 flex items-center justify-between" data-testid="consumo-ia">
                    <span>Coste IA de esta lectura</span>
                    <span className="font-mono-plex text-slate-700">{consumo.total_tokens} tokens ≈ {eurCoste(consumo.coste_eur)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {file && !datos && (
            <Button variant="outline" className="rounded-sm" onClick={reset} disabled={loading}>Cambiar archivo</Button>
          )}
          {file && !datos && (
            <Button data-testid="procesar-pdf-button" className="rounded-sm bg-primary" onClick={procesar} disabled={loading}>
              {loading ? "Procesando..." : "Extraer datos con IA"}
            </Button>
          )}
          {datos && (
            <Button data-testid="confirmar-extraccion-button" className="rounded-sm bg-primary" onClick={confirmar}>
              Revisar y crear
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
