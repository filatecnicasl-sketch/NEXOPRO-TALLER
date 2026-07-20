import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, Key, LockKey } from "@phosphor-icons/react";
import { toast } from "sonner";
import { appChangePassword, app2faSetup, app2faEnable, app2faDisable } from "@/lib/api";
import { useAppAuth } from "@/lib/appAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MiCuentaCard() {
  const { user, refresh } = useAppAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null); // {secret, otpauth_uri}
  const [code, setCode] = useState("");
  const [disCode, setDisCode] = useState("");

  const cambiar = async () => {
    if (!actual || !nueva) return toast.error("Rellena ambos campos");
    setBusy(true);
    try { await appChangePassword(actual, nueva); toast.success("Contraseña cambiada"); setActual(""); setNueva(""); refresh?.(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo cambiar"); }
    finally { setBusy(false); }
  };

  const iniciar2fa = async () => {
    setBusy(true);
    try { const d = await app2faSetup(); setSetup(d); }
    catch { toast.error("No se pudo iniciar 2FA"); }
    finally { setBusy(false); }
  };
  const activar2fa = async () => {
    if (!code.trim()) return toast.error("Introduce el código");
    setBusy(true);
    try { await app2faEnable(code.trim()); toast.success("2FA activado"); setSetup(null); setCode(""); refresh?.(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Código incorrecto"); }
    finally { setBusy(false); }
  };
  const desactivar2fa = async () => {
    if (!disCode.trim()) return toast.error("Introduce el código actual");
    setBusy(true);
    try { await app2faDisable(disCode.trim()); toast.success("2FA desactivado"); setDisCode(""); refresh?.(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Código incorrecto"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="mi-cuenta-card">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600"><LockKey size={18} weight="duotone" /></span>
        <div>
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Mi cuenta y seguridad</h3>
          <p className="text-xs text-zinc-500">Sesión: {user?.email} · {user?.role}</p>
        </div>
      </div>
      <div className="p-5 space-y-6">
        {/* Cambiar contraseña */}
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 mb-3"><Key size={16} className="text-amber-500" /> Cambiar contraseña</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Contraseña actual</Label><Input data-testid="cuenta-actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} className="rounded-md mt-1" /></div>
            <div><Label className="text-xs">Nueva contraseña</Label><Input data-testid="cuenta-nueva" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} className="rounded-md mt-1" placeholder="Mín. 8, 1 mayús., 1 número" /></div>
          </div>
          <Button data-testid="cuenta-cambiar-btn" onClick={cambiar} disabled={busy} className="rounded-md mt-3 bg-primary">Cambiar contraseña</Button>
        </div>

        {/* 2FA */}
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 mb-3"><ShieldCheck size={16} className="text-emerald-500" /> Verificación en dos pasos (2FA)</div>
          {user?.totp_enabled ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700 flex items-center gap-1.5"><ShieldCheck size={15} weight="fill" /> Activada. Tu cuenta pide un código al entrar.</p>
              <div className="flex items-end gap-2">
                <div><Label className="text-xs">Código actual para desactivar</Label><Input data-testid="cuenta-2fa-discode" value={disCode} onChange={(e) => setDisCode(e.target.value.replace(/\D/g, ""))} maxLength={6} className="rounded-md mt-1 font-mono-plex w-32 text-center" placeholder="000000" /></div>
                <Button data-testid="cuenta-2fa-disable" onClick={desactivar2fa} disabled={busy} variant="outline" className="rounded-md border-red-200 text-red-600 hover:bg-red-50">Desactivar 2FA</Button>
              </div>
            </div>
          ) : !setup ? (
            <div>
              <p className="text-sm text-zinc-600 mb-3">Añade una capa extra de seguridad con Google Authenticator, Authy, etc. {user?.role === "admin" && <b>Muy recomendado para el administrador.</b>}</p>
              <Button data-testid="cuenta-2fa-setup" onClick={iniciar2fa} disabled={busy} className="rounded-md bg-emerald-600 hover:bg-emerald-700">Activar 2FA</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">1) Escanea este código QR con tu app de autenticación:</p>
              <div className="bg-white p-3 border border-zinc-200 rounded-md inline-block"><QRCodeSVG value={setup.otpauth_uri} size={160} /></div>
              <p className="text-xs text-zinc-400">¿No puedes escanear? Clave manual: <span className="font-mono-plex select-all">{setup.secret}</span></p>
              <div className="flex items-end gap-2">
                <div><Label className="text-xs">2) Introduce el código generado</Label><Input data-testid="cuenta-2fa-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} className="rounded-md mt-1 font-mono-plex w-32 text-center" placeholder="000000" /></div>
                <Button data-testid="cuenta-2fa-enable" onClick={activar2fa} disabled={busy} className="rounded-md bg-emerald-600 hover:bg-emerald-700">Confirmar y activar</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
