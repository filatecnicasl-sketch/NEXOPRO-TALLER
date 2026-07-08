import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CheckCircle, WarningCircle, UploadSimple } from "@phosphor-icons/react";
import { infoSubida, subirFotoToken } from "@/lib/api";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

export default function SubirFotos() {
  const { token } = useParams();
  const fileRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [estado, setEstado] = useState("cargando");
  const [subidas, setSubidas] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    infoSubida(token)
      .then((r) => { setInfo(r); setSubidas(r.total || 0); setEstado("ok"); })
      .catch(() => setEstado("error"));
  }, [token]);

  const subir = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const f of files) {
      try { const r = await subirFotoToken(token, f); setSubidas(r.total); ok++; } catch { /* seguir */ }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    return ok;
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center px-4 py-10">
      <img src={LOGO} alt="NexoPro" className="h-10 w-10 object-contain mb-3" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" data-testid="subir-fotos-page">
        {estado === "cargando" && <p className="text-center text-zinc-400 py-10">Cargando…</p>}

        {estado === "error" && (
          <div className="text-center py-8">
            <WarningCircle size={40} weight="fill" className="text-amber-500 mx-auto mb-3" />
            <h1 className="font-heading text-xl font-bold text-zinc-900">Enlace no válido</h1>
            <p className="text-sm text-zinc-500 mt-2">Este enlace de subida ha caducado o no existe. Genera un nuevo código QR desde la aplicación.</p>
          </div>
        )}

        {estado === "ok" && info && (
          <>
            <div className="text-center mb-5">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3"><Camera size={28} weight="duotone" /></span>
              <h1 className="font-heading text-xl font-bold text-zinc-900">Subir fotos</h1>
              <p className="text-sm text-zinc-500 mt-1">{info.label ? <>Vinculadas a <span className="font-semibold text-zinc-700">{info.label}</span></> : "Adjunta las fotos al registro"}</p>
            </div>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" data-testid="subir-input" onChange={(e) => subir(Array.from(e.target.files))} />
            <button data-testid="tomar-foto-button" disabled={uploading} onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-4 font-medium text-base active:scale-[0.99] transition-transform disabled:opacity-60">
              <UploadSimple size={20} weight="bold" /> {uploading ? "Subiendo…" : "Hacer foto / elegir"}
            </button>

            <div className="mt-6 flex items-center justify-center gap-2 text-emerald-600" data-testid="subidas-contador">
              <CheckCircle size={18} weight="fill" />
              <span className="text-sm text-zinc-600"><span className="font-semibold text-zinc-900">{subidas}</span> foto(s) en este registro</span>
            </div>
            <p className="text-xs text-zinc-400 text-center mt-4">Puedes seguir haciendo más fotos. Se guardan automáticamente. Ya puedes cerrar esta página cuando termines.</p>
          </>
        )}
      </div>
    </div>
  );
}
