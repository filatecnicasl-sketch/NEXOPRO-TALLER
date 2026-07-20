import { useState } from "react";
import { LockKey, EnvelopeSimple, ShieldCheck, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAppAuth } from "@/lib/appAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

export default function Login() {
  const { login } = useAppAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error("Introduce email y contraseña");
    if (need2fa && !totp.trim()) return toast.error("Introduce el código de verificación");
    setBusy(true);
    try {
      const r = await login(email.trim(), password, need2fa ? totp.trim() : undefined);
      if (r.requires_2fa) { setNeed2fa(true); toast.info("Introduce el código de tu app de autenticación"); }
      else toast.success("Bienvenido/a");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo iniciar sesión");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4" data-testid="login-page">
      <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={LOGO} alt="NexoPro" className="h-12 w-12 object-contain mb-3" />
          <h1 className="font-heading text-2xl font-bold text-slate-900">NexoPro</h1>
          <p className="text-sm text-slate-500 mt-1">Accede a tu taller</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {!need2fa ? (
            <>
              <div>
                <Label className="text-xs">Email</Label>
                <div className="relative mt-1">
                  <EnvelopeSimple size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@taller.com" className="pl-9 rounded-md" autoComplete="username" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Contraseña</Label>
                <div className="relative mt-1">
                  <LockKey size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 rounded-md" autoComplete="current-password" />
                </div>
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-600" /> Código de verificación (2FA)</Label>
              <Input data-testid="login-totp" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} placeholder="000000" maxLength={6} className="mt-1 rounded-md text-center tracking-[0.3em] font-mono-plex text-lg" autoFocus />
              <p className="text-xs text-slate-400 mt-1.5">Abre tu app de autenticación (Google Authenticator, etc.)</p>
            </div>
          )}
          <Button data-testid="login-submit" type="submit" disabled={busy} className="w-full rounded-md bg-primary hover:bg-indigo-700">
            {busy ? "Entrando…" : "Iniciar sesión"} <ArrowRight size={16} className="ml-1.5" />
          </Button>
        </form>
        <p className="text-[11px] text-slate-400 text-center mt-5">Acceso protegido. Si has olvidado tu contraseña, contacta con el administrador del taller.</p>
      </div>
    </div>
  );
}
