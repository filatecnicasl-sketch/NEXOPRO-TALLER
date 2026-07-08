import { useEffect, useState } from "react";
import { LockKey, ArrowClockwise } from "@phosphor-icons/react";
import { verificarLicencia } from "@/lib/api";

const LICENSE_KEY = localStorage.getItem("nexopro_license") || process.env.REACT_APP_LICENSE_KEY;
const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

export default function LicenseGate({ children }) {
  const [estado, setEstado] = useState("checking");
  const [info, setInfo] = useState(null);

  const check = () => {
    setEstado("checking");
    if (!LICENSE_KEY) { setEstado("bloqueada"); setInfo({ mensaje: "No hay licencia configurada." }); return; }
    verificarLicencia(LICENSE_KEY)
      .then((r) => { setInfo(r); setEstado(r.valida ? "activa" : "bloqueada"); })
      .catch(() => { setEstado("bloqueada"); setInfo({ mensaje: "No se pudo verificar la licencia." }); });
  };

  useEffect(check, []);

  if (estado === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="license-checking">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <ArrowClockwise size={18} className="animate-spin" /> Verificando licencia…
        </div>
      </div>
    );
  }

  if (estado === "bloqueada") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4" data-testid="license-blocked">
        <div className="max-w-md w-full bg-white rounded-sm border border-slate-200 p-8 text-center">
          <div className="h-14 w-14 rounded-sm bg-red-50 flex items-center justify-center mx-auto mb-5">
            <LockKey size={28} className="text-red-500" weight="fill" />
          </div>
          <img src={LOGO} alt="NexoPro" className="h-8 w-8 object-contain mx-auto mb-3 opacity-60" />
          <h1 className="font-heading text-2xl font-bold text-slate-900">Aplicación desactivada</h1>
          <p className="text-sm text-slate-500 mt-3">
            {info?.mensaje || "Su suscripción no está activa."}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Póngase en contacto con su proveedor para reactivar el servicio.
          </p>
          <button data-testid="reintentar-licencia" onClick={check}
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowClockwise size={15} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return children;
}
