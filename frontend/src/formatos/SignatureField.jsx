import { useEffect, useRef } from "react";

// Lienzo para firmar con el ratón o el dedo
export function SignatureField({ value, onChange, widthPx, heightPx }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (value) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, cv.width, cv.height);
      image.src = value;
    }
  }, [value]);

  const pos = (e) => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * cv.width,
      y: ((e.clientY - r.top) / r.height) * cv.height,
    };
  };

  const save = () => {
    const cv = canvasRef.current;
    if (cv) onChange(cv.toDataURL("image/png"));
  };

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(150, Math.round(widthPx * 2))}
      height={Math.max(80, Math.round(heightPx * 2))}
      className="h-full w-full touch-none bg-white"
      style={{ cursor: "crosshair" }}
      onPointerDown={(e) => {
        drawing.current = true;
        last.current = pos(e);
        e.target.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const cv = canvasRef.current;
        const ctx = cv.getContext("2d");
        const p = pos(e);
        ctx.strokeStyle = "#1a2a6c";
        ctx.lineWidth = Math.max(2, cv.width / 200);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
      }}
      onPointerUp={() => { drawing.current = false; save(); }}
      onPointerLeave={() => { if (drawing.current) { drawing.current = false; save(); } }}
    />
  );
}
