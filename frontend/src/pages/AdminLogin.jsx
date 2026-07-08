import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LockKey } from "@phosphor-icons/react";
import { adminLogin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

function formatErr(detail) {
  if (!detail) return "Error al iniciar sesión";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await adminLogin(email, password);
      localStorage.setItem("nexopro_admin_token", data.token);
      localStorage.setItem("nexopro_admin_user", JSON.stringify(data.user));
      toast.success("Bienvenido");
      nav("/admin");
    } catch (err) {
      toast.error(formatErr(err?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4" data-testid="admin-login-page">
      <div className="max-w-sm w-full bg-white rounded-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <img src={LOGO} alt="NexoPro" className="h-9 w-9 object-contain" />
          <div className="leading-none">
            <div className="font-heading font-bold text-[17px] text-slate-900">NexoPro</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">Panel de control central</div>
          </div>
        </div>
        <h1 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
          <LockKey size={20} className="text-primary" /> Acceso administrador
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label className="text-xs">Email</Label>
            <Input data-testid="admin-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-sm mt-1" placeholder="admin@nexopro.com" required />
          </div>
          <div>
            <Label className="text-xs">Contraseña</Label>
            <Input data-testid="admin-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="rounded-sm mt-1" required />
          </div>
          <Button data-testid="admin-login-button" type="submit" disabled={loading}
            className="w-full rounded-sm bg-primary">
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
