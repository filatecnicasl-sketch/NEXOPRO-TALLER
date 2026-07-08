import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, SignOut, Copy, CheckCircle, XCircle, CurrencyEur, Trash, ShieldCheck, Robot,
} from "@phosphor-icons/react";
import {
  adminMe, getLicencias, createLicencia, estadoLicencia, registrarPago, deleteLicencia, getAdminConsumoIA, eur, eurCoste,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";
const EMPTY = { empresa: "", email: "", telefono: "", precio_mensual: 29, notas: "" };

export default function AdminPanel() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [delId, setDelId] = useState(null);
  const [consumo, setConsumo] = useState(null);

  const load = () => {
    setLoading(true);
    getLicencias().then((d) => { setItems(d); setLoading(false); });
    getAdminConsumoIA().then(setConsumo).catch(() => {});
  };

  useEffect(() => {
    if (!localStorage.getItem("nexopro_admin_token")) { nav("/admin/login"); return; }
    adminMe().then(load).catch(() => { localStorage.removeItem("nexopro_admin_token"); nav("/admin/login"); });
  }, []);

  const logout = () => { localStorage.removeItem("nexopro_admin_token"); nav("/admin/login"); };

  const crear = async () => {
    if (!form.empresa.trim()) return toast.error("Indica la empresa");
    try { await createLicencia({ ...form, precio_mensual: Number(form.precio_mensual) }); toast.success("Licencia creada"); setOpen(false); setForm(EMPTY); load(); }
    catch { toast.error("Error al crear"); }
  };

  const toggle = async (l) => {
    const nuevo = l.estado === "activa" ? "suspendida" : "activa";
    await estadoLicencia(l.id, nuevo);
    toast.success(nuevo === "activa" ? "Cliente activado" : "Cliente suspendido");
    load();
  };

  const pago = async (l) => { await registrarPago(l.id); toast.success("Pago registrado, cliente activo"); load(); };
  const remove = async () => { await deleteLicencia(delId); setDelId(null); toast.success("Licencia eliminada"); load(); };
  const copiar = (k) => { navigator.clipboard.writeText(k); toast.success("Clave copiada"); };

  const activas = items.filter((l) => l.estado === "activa").length;
  const ingresos = items.filter((l) => l.estado === "activa").reduce((s, l) => s + (l.precio_mensual || 0), 0);

  return (
    <div className="min-h-screen bg-background" data-testid="admin-panel-page">
      <header className="bg-slate-900 text-white">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-3">
          <img src={LOGO} alt="NexoPro" className="h-8 w-8 object-contain" />
          <div className="leading-none">
            <div className="font-heading font-bold text-[16px]">NexoPro</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">Panel de control central</div>
          </div>
          <Button data-testid="admin-logout-button" onClick={logout} variant="ghost"
            className="ml-auto text-slate-300 hover:text-white hover:bg-slate-800 rounded-sm">
            <SignOut size={16} className="mr-1" /> Salir
          </Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900">Clientes y licencias</h1>
            <p className="text-sm text-slate-500 mt-1.5">Activa o suspende el acceso de cada cliente según su pago mensual</p>
          </div>
          <Button data-testid="nueva-licencia-button" onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-sm bg-primary">
            <Plus size={16} className="mr-1" /> Nuevo cliente
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-sm p-5">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Clientes totales</div>
            <div className="font-heading text-2xl font-bold mt-2">{items.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-5">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Activos</div>
            <div className="font-heading text-2xl font-bold mt-2 text-emerald-600">{activas}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-sm p-5">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Ingresos mensuales (activos)</div>
            <div className="font-heading text-2xl font-bold mt-2 text-primary">{eur(ingresos)}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Empresa</TableHead>
                <TableHead>Clave de licencia</TableHead>
                <TableHead className="text-right">Cuota/mes</TableHead>
                <TableHead>Último pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">Cargando…</TableCell></TableRow>}
              {!loading && items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-16 text-center">
                  <ShieldCheck size={40} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-500 text-sm">No hay clientes todavía</p>
                </TableCell></TableRow>
              )}
              {items.map((l) => (
                <TableRow key={l.id} data-testid={`licencia-row-${l.id}`}>
                  <TableCell>
                    <div className="font-medium text-slate-800">{l.empresa}</div>
                    <div className="text-xs text-slate-400">{l.email || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => copiar(l.license_key)} className="font-mono-plex text-xs text-slate-600 inline-flex items-center gap-1 hover:text-primary" data-testid={`copiar-${l.id}`}>
                      {l.license_key} <Copy size={13} />
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{eur(l.precio_mensual)}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{l.ultimo_pago || "—"}</TableCell>
                  <TableCell>
                    {l.estado === "activa"
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={14} weight="fill" /> Activa</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-red-500"><XCircle size={14} weight="fill" /> Suspendida</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <button data-testid={`pago-${l.id}`} onClick={() => pago(l)} title="Registrar pago" className="text-slate-400 hover:text-emerald-600 p-1.5"><CurrencyEur size={16} /></button>
                    <button data-testid={`toggle-${l.id}`} onClick={() => toggle(l)} title={l.estado === "activa" ? "Suspender" : "Activar"}
                      className={`p-1.5 ${l.estado === "activa" ? "text-slate-400 hover:text-red-500" : "text-slate-400 hover:text-emerald-600"}`}>
                      {l.estado === "activa" ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    </button>
                    <button data-testid={`eliminar-${l.id}`} onClick={() => setDelId(l.id)} className="text-slate-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Consumo de IA por cliente */}
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-slate-900 text-white"><Robot size={18} /></span>
            <div>
              <h2 className="font-heading text-xl font-bold text-slate-900">Consumo de IA</h2>
              <p className="text-sm text-slate-500">Lecturas de PDF y coste estimado por cliente</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-sm p-5">
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Lecturas totales</div>
              <div className="font-heading text-2xl font-bold mt-2" data-testid="ia-total-lecturas">{consumo?.num_lecturas ?? 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-sm p-5">
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Tokens totales</div>
              <div className="font-heading text-2xl font-bold mt-2 tabular-nums">{(consumo?.total_tokens ?? 0).toLocaleString("es-ES")}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-sm p-5">
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Coste IA estimado</div>
              <div className="font-heading text-2xl font-bold mt-2 text-primary">{eurCoste(consumo?.coste_total_eur ?? 0)}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Licencia</TableHead>
                  <TableHead className="text-right">Lecturas</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Coste estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!consumo || consumo.clientes.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-400 text-sm">Todavía no hay lecturas de IA registradas</TableCell></TableRow>
                )}
                {consumo?.clientes.map((c, i) => (
                  <TableRow key={c.license_key || i} data-testid={`consumo-cliente-row-${i}`}>
                    <TableCell className="font-medium text-slate-800">{c.empresa || "Sin identificar"}</TableCell>
                    <TableCell className="font-mono-plex text-xs text-slate-500">{c.license_key || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.num_lecturas}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">{c.total_tokens.toLocaleString("es-ES")}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-primary">{eurCoste(c.coste_total_eur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="licencia-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo cliente / licencia</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Empresa *</Label>
              <Input data-testid="input-empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email de contacto</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cuota mensual (€)</Label>
              <Input data-testid="input-precio-mensual" type="number" value={form.precio_mensual} onChange={(e) => setForm({ ...form, precio_mensual: e.target.value })} className="rounded-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="crear-licencia-button" onClick={crear} className="rounded-sm bg-primary">Crear licencia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar licencia?</AlertDialogTitle>
            <AlertDialogDescription>El cliente perderá el acceso. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-button" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
