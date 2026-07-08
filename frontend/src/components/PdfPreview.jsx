import { ArrowSquareOut } from "@phosphor-icons/react";
import { archivoUrl } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PdfPreview({ open, onOpenChange, path, filename }) {
  const url = path ? archivoUrl(path) : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl rounded-lg" data-testid="pdf-preview-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight text-sm flex items-center justify-between pr-6">
            <span className="truncate">{filename || "Documento original"}</span>
            {url && (
              <a href={url} target="_blank" rel="noreferrer" data-testid="pdf-open-newtab" className="text-primary hover:text-indigo-700 inline-flex items-center gap-1 text-xs font-medium">
                <ArrowSquareOut size={15} /> Abrir
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        {url ? (
          <iframe title="Vista previa PDF" src={url} className="w-full h-[70vh] rounded-md border border-zinc-200 bg-zinc-50" data-testid="pdf-preview-frame" />
        ) : (
          <div className="py-16 text-center text-zinc-400 text-sm">No hay documento adjunto.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
