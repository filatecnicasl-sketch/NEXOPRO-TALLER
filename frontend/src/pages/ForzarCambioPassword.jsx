import { useState } from "react";
import { LockKey } from "@phosphor-icons/react";
import { toast } from "sonner";
import { appChangePassword } from "@/lib/api";
import { useAppAuth } from "@/lib/appAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForzarCambioPassword() {
  const { refresh, logout } = useAppAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!actual || !nueva) return toast.error("Rellena ambos campos");
    setBusy(true);
    try { await appChangePassword(actual, nueva); toast.success("Contraseña actualizada"); await refresh(); }
    catch (err) { toast.error(err?.response?.data?.detail || "No se pudo cambiar"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4" data-testid="forzar-cambio-password">
      <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 shadow-xl p-8">
        <div className="flex flex-col items-center mb-5">
          <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center mb-3"><LockKey size={24} className="text-amber-500" weight="fill" /></div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Cambia tu contraseña</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">Por seguridad, debes establecer una contraseña propia antes de continuar.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><Label className="text-xs">Contraseña actual</Label><Input data-testid="fcp-actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} className="rounded-md mt-1" /></div>
          <div><Label className="text-xs">Nueva contraseña</Label><Input data-testid="fcp-nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} className="rounded-md mt-1" placeholder="Mín. 8, 1 mayúscula y 1 número" /></div>
          <Button data-testid="fcp-submit" type="submit" disabled={busy} className="w-full rounded-md bg-primary hover:bg-indigo-700">{busy ? "Guardando…" : "Guardar y continuar"}</Button>
        </form>
        <button onClick={logout} className="text-xs text-slate-400 hover:underline mt-4 mx-auto block">Cerrar sesión</button>
      </div>
    </div>
  );
}
