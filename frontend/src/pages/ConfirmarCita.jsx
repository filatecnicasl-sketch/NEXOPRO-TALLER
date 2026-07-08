import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarBlank, CheckCircle, XCircle, WarningCircle, Clock, Car } from "@phosphor-icons/react";
import { getCitaPublica, responderCita } from "@/lib/api";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

const ESTADO_LABEL = {
  confirmada: { txt: "Cita confirmada", cls: "text-emerald-600", icon: CheckCircle },
  cancelada: { txt: "Cita cancelada", cls: "text-red-500", icon: XCircle },
};

export default function ConfirmarCita() {
  const { token } = useParams();
  const [cita, setCita] = useState(null);
  const [estado, setEstado] = useState("cargando");
  const [enviando, setEnviando] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    getCitaPublica(token)
      .then((c) => { setCita(c); setResultado(["confirmada", "cancelada"].includes(c.estado) ? c.estado : null); setEstado("ok"); })
      .catch(() => setEstado("error"));
  }, [token]);

  const responder = async (accion) => {
    setEnviando(accion);
    try {
      const r = await responderCita(token, accion);
      setResultado(r.estado);
    } catch { setEstado("error"); }
    finally { setEnviando(""); }
  };

  const R = resultado ? ESTADO_LABEL[resultado] : null;

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center px-4 py-10">
      <img src={LOGO} alt="NexoPro" className="h-10 w-10 object-contain mb-3" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" data-testid="confirmar-cita-page">
        {estado === "cargando" && <p className="text-center text-zinc-400 py-10">Cargando…</p>}

        {estado === "error" && (
          <div className="text-center py-8" data-testid="cita-error">
            <WarningCircle size={40} weight="fill" className="text-amber-500 mx-auto mb-3" />
            <h1 className="font-heading text-xl font-bold text-zinc-900">Enlace no válido</h1>
            <p className="text-sm text-zinc-500 mt-2">Este enlace de cita ha caducado o no existe. Contacta directamente con el taller.</p>
          </div>
        )}

        {estado === "ok" && cita && (
          <>
            <div className="text-center mb-5">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3"><CalendarBlank size={28} weight="duotone" /></span>
              <h1 className="font-heading text-xl font-bold text-zinc-900">Su cita en {cita.empresa_nombre}</h1>
              <p className="text-sm text-zinc-500 mt-1">{cita.cliente_nombre || ""}</p>
            </div>

            <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 mb-5">
              <div className="flex items-center gap-3 px-4 py-3 text-sm"><CalendarBlank size={18} className="text-zinc-400" /> <span className="text-zinc-500">Fecha</span> <span className="ml-auto font-semibold text-zinc-900">{cita.fecha}</span></div>
              <div className="flex items-center gap-3 px-4 py-3 text-sm"><Clock size={18} className="text-zinc-400" /> <span className="text-zinc-500">Hora</span> <span className="ml-auto font-semibold text-zinc-900">{cita.hora || "—"}</span></div>
              {cita.vehiculo_matricula && <div className="flex items-center gap-3 px-4 py-3 text-sm"><Car size={18} className="text-zinc-400" /> <span className="text-zinc-500">Vehículo</span> <span className="ml-auto font-mono-plex font-semibold text-zinc-900">{cita.vehiculo_matricula}</span></div>}
              {cita.motivo && <div className="px-4 py-3 text-sm text-zinc-500">Motivo: <span className="text-zinc-800">{cita.motivo}</span></div>}
            </div>

            {R ? (
              <div className="text-center py-4" data-testid="cita-resultado">
                <R.icon size={44} weight="fill" className={`${R.cls} mx-auto mb-2`} />
                <p className={`font-heading text-lg font-bold ${R.cls}`}>{R.txt}</p>
                <p className="text-sm text-zinc-500 mt-1">Gracias. Ya puede cerrar esta página.{cita.empresa_telefono ? ` Para cualquier cambio, llame al ${cita.empresa_telefono}.` : ""}</p>
                {resultado === "cancelada" && (
                  <button data-testid="reconfirmar-btn" disabled={enviando} onClick={() => responder("confirmar")} className="mt-4 text-sm text-primary hover:underline">Me he equivocado, confirmar la cita</button>
                )}
                {resultado === "confirmada" && (
                  <button data-testid="recancelar-btn" disabled={enviando} onClick={() => responder("cancelar")} className="mt-4 text-sm text-red-500 hover:underline">Necesito cancelar la cita</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button data-testid="confirmar-cita-btn" disabled={!!enviando} onClick={() => responder("confirmar")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-4 font-medium active:scale-[0.99] transition-transform disabled:opacity-60">
                  <CheckCircle size={20} weight="fill" /> {enviando === "confirmar" ? "…" : "Confirmar"}
                </button>
                <button data-testid="cancelar-cita-btn" disabled={!!enviando} onClick={() => responder("cancelar")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white border border-red-200 text-red-600 py-4 font-medium active:scale-[0.99] transition-transform disabled:opacity-60">
                  <XCircle size={20} weight="fill" /> {enviando === "cancelar" ? "…" : "Cancelar"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-zinc-500 mt-4">Powered by NexoPro</p>
    </div>
  );
}
