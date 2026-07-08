import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { UploadSimple, QrCode, Trash, FilePdf, DeviceMobile, ArrowClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { mediaUrl, subirFoto, borrarFoto, crearFotoSesion } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function FotosGaleria({ tipo, id, fotos = [], onChange, titulo = "Fotos y adjuntos" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [token, setToken] = useState(null);

  const upload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of files) await subirFoto(tipo, id, f);
      toast.success("Archivos subidos");
      onChange && (await onChange());
    } catch { toast.error("Error al subir el archivo"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const remove = async (path) => {
    try { await borrarFoto(tipo, id, path); onChange && (await onChange()); }
    catch { toast.error("No se pudo eliminar"); }
  };

  const openQr = async () => {
    setQrOpen(true); setToken(null);
    try { const r = await crearFotoSesion(tipo, id); setToken(r.token); }
    catch { toast.error("No se pudo generar el QR"); setQrOpen(false); }
  };

  const qrUrl = token ? `${window.location.origin}/subir/${token}` : "";

  return (
    <div data-testid="fotos-galeria">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-heading font-semibold text-zinc-900 text-sm">{titulo} <span className="text-zinc-400 font-normal">({fotos.length})</span></h4>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" data-testid="foto-input" onChange={(e) => upload(Array.from(e.target.files))} />
          <Button variant="outline" size="sm" className="rounded-md" data-testid="subir-foto-button" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <UploadSimple size={15} className="mr-1.5" /> {uploading ? "Subiendo..." : "Subir"}
          </Button>
          <Button variant="outline" size="sm" className="rounded-md" data-testid="qr-foto-button" onClick={openQr}>
            <QrCode size={15} className="mr-1.5" /> Móvil (QR)
          </Button>
        </div>
      </div>

      {fotos.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded-lg py-8 text-center text-sm text-zinc-400">
          Sin fotos ni adjuntos. Sube desde este equipo o escanea el QR con el móvil.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {fotos.map((f) => {
            const isPdf = (f.content_type || "").includes("pdf");
            const url = mediaUrl(f.path);
            return (
              <div key={f.path} className="relative group rounded-md overflow-hidden border border-zinc-200 bg-zinc-50 aspect-square" data-testid={`foto-item`}>
                <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full">
                  {isPdf
                    ? <div className="w-full h-full flex flex-col items-center justify-center text-red-500"><FilePdf size={28} weight="duotone" /><span className="text-[10px] text-zinc-500 mt-1 truncate px-1 max-w-full">{f.filename}</span></div>
                    : <img src={url} alt={f.filename} className="w-full h-full object-cover" />}
                </a>
                <button data-testid="foto-eliminar" onClick={() => remove(f.path)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/90 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <Trash size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm rounded-lg" data-testid="qr-dialog">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><DeviceMobile size={20} weight="duotone" className="text-primary" /> Subir fotos desde el móvil</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrUrl ? (
              <>
                <div className="p-3 bg-white rounded-lg border border-zinc-200"><QRCodeCanvas value={qrUrl} size={200} data-testid="qr-canvas" /></div>
                <p className="text-sm text-zinc-500 mt-4 text-center">Escanea este código con la cámara del móvil para abrir la página de subida de fotos. Las fotos aparecerán aquí al actualizar.</p>
                <Button variant="outline" size="sm" className="rounded-md mt-4" data-testid="refrescar-fotos-button" onClick={() => onChange && onChange()}>
                  <ArrowClockwise size={15} className="mr-1.5" /> Actualizar fotos
                </Button>
              </>
            ) : <div className="text-sm text-zinc-400 py-10">Generando código QR…</div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
