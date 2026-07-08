import { useRef, useState } from "react";
import { Eraser, FloppyDisk } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function SignaturePad({ onSave, saving = false }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  const ctx = () => {
    const c = canvasRef.current;
    const x = c.getContext("2d");
    x.lineWidth = 2.2; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#18181b";
    return x;
  };
  const pos = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const x = ctx(); const p = pos(e); x.beginPath(); x.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const x = ctx(); const p = pos(e); x.lineTo(p.x, p.y); x.stroke(); setDirty(true); };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setDirty(false); };
  const save = () => { if (dirty) onSave(canvasRef.current.toDataURL("image/png")); };

  return (
    <div data-testid="signature-pad">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        className="w-full h-40 bg-white border border-dashed border-zinc-300 rounded-lg touch-none cursor-crosshair"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-zinc-400">Firme con el dedo (tablet/móvil) o el ratón.</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={clear} className="rounded-md" data-testid="firma-borrar"><Eraser size={14} className="mr-1" /> Borrar</Button>
          <Button type="button" size="sm" onClick={save} disabled={!dirty || saving} className="rounded-md bg-primary" data-testid="firma-guardar"><FloppyDisk size={14} className="mr-1" weight="fill" /> {saving ? "Guardando…" : "Guardar firma"}</Button>
        </div>
      </div>
    </div>
  );
}
