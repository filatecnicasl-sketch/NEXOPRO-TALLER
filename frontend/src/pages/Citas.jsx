import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PencilSimple, Trash, CalendarBlank, Clock, Car, CaretLeft, CaretRight, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getCitas, createCita, updateCita, estadoCita, deleteCita, enviarRecordatorioCita,
  getVehiculos, getContactos, createVehiculo, createContacto, getPeritajes, getPrestamos,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMPTY = { vehiculo_id: "", cliente_id: "", fecha: "", duracion_min: 60, motivo: "", tipo_trabajo: "", estado: "pendiente", notas: "" };
const ESTADOS = [
  { value: "pendiente", label: "Pendiente", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "confirmada", label: "Confirmada", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "realizada", label: "Realizada", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "cancelada", label: "Cancelada", cls: "bg-red-50 text-red-700 ring-red-200" },
];
const TIPOS = ["", "Chapa", "Pintura", "Mecánica", "Revisión", "Valoración", "Recepción", "Entrega"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";

const fmtDay = (iso) => {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const fmtHora = (iso) => (iso && iso.includes("T") ? iso.split("T")[1].slice(0, 5) : "—");

export default function Citas() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [peritajes, setPeritajes] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [vehOpen, setVehOpen] = useState(false);
  const [vehForm, setVehForm] = useState({ matricula: "", marca: "", modelo: "", cliente_id: "", tipo: "cliente" });
  const [cliOpen, setCliOpen] = useState(false);
  const [cliForm, setCliForm] = useState({ nombre: "", nif: "", telefono: "", email: "" });
  const [vista, setVista] = useState("agenda");
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const citasPorDia = useMemo(() => {
    const m = {};
    items.forEach((c) => { if (c.fecha) { const k = c.fecha.split("T")[0]; (m[k] = m[k] || []).push(c); } });
    Object.values(m).forEach((a) => a.sort((x, y) => (x.fecha || "").localeCompare(y.fecha || "")));
    return m;
  }, [items]);
  const celdas = useMemo(() => {
    const y = mes.getFullYear(), mo = mes.getMonth();
    let start = new Date(y, mo, 1).getDay(); start = start === 0 ? 6 : start - 1;
    const sd = new Date(y, mo, 1 - start);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(sd); d.setDate(sd.getDate() + i); return d; });
  }, [mes]);
  const openNewFecha = (d) => { setForm({ ...EMPTY, fecha: isoDay(d) + "T09:00" }); setEditId(null); setOpen(true); };
  const [semana, setSemana] = useState(() => new Date());
  const diasSemana = useMemo(() => {
    const d = new Date(semana); let wd = d.getDay(); wd = wd === 0 ? 6 : wd - 1;
    const mon = new Date(d); mon.setDate(d.getDate() - wd); mon.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
  }, [semana]);

  const load = () => { setLoading(true); getCitas().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(load, []);
  useEffect(() => {
    getVehiculos().then(setVehiculos);
    getContactos("cliente").then(setClientes);
    getPeritajes().then((ps) => setPeritajes(ps.filter((p) => ["pendiente", "valorado"].includes(p.estado)))).catch(() => {});
    getPrestamos("activo").then(setPrestamos).catch(() => {});
  }, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm({ ...EMPTY, ...c }); setEditId(c.id); setOpen(true); };

  const save = async () => {
    if (!form.fecha) return toast.error("Indica la fecha y hora de la cita");
    const payload = { ...form, duracion_min: Number(form.duracion_min || 60) };
    try {
      if (editId) { await updateCita(editId, payload); toast.success("Cita actualizada"); }
      else { await createCita(payload); toast.success("Cita creada"); }
      setOpen(false); load();
    } catch { toast.error("Error al guardar la cita"); }
  };

  const cambiarEstado = async (c, estado) => {
    try { await estadoCita(c.id, estado); toast.success("Estado actualizado"); load(); }
    catch { toast.error("No se pudo cambiar el estado"); }
  };
  const remove = async () => { await deleteCita(delId); setDelId(null); toast.success("Cita eliminada"); load(); };
  const [enviando, setEnviando] = useState(null);
  const enviarRecordatorio = async (c) => {
    setEnviando(c.id);
    try {
      const r = await enviarRecordatorioCita(c.id);
      const res = r.resultados || {};
      const oks = Object.keys(res).filter((k) => res[k].ok);
      const fails = Object.keys(res).filter((k) => !res[k].ok);
      if (oks.length) toast.success(`Recordatorio enviado (${oks.join(", ")})`);
      if (fails.length) toast.error(fails.map((k) => `${k}: ${res[k].error}`).join(" · "));
      if (!oks.length && !fails.length) toast.error("No se pudo enviar el recordatorio");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error al enviar el recordatorio"); }
    finally { setEnviando(null); }
  };

  const guardarVehiculo = async () => {
    if (!vehForm.matricula.trim() && !vehForm.marca.trim()) return toast.error("Indica al menos la matrícula");
    try {
      const v = await createVehiculo({ ...vehForm, matricula: vehForm.matricula.toUpperCase() });
      setVehiculos(await getVehiculos());
      setForm((f) => ({ ...f, vehiculo_id: v.id }));
      setVehOpen(false); setVehForm({ matricula: "", marca: "", modelo: "", cliente_id: "", tipo: "cliente" });
      toast.success("Vehículo dado de alta");
    } catch { toast.error("Error al crear el vehículo"); }
  };
  const guardarCliente = async () => {
    if (!cliForm.nombre.trim()) return toast.error("El nombre es obligatorio");
    try {
      const c = await createContacto({ ...cliForm, tipo: "cliente" });
      setClientes(await getContactos("cliente"));
      setVehForm((f) => ({ ...f, cliente_id: c.id }));
      setCliOpen(false); setCliForm({ nombre: "", nif: "", telefono: "", email: "" });
      toast.success("Cliente dado de alta");
    } catch { toast.error("Error al crear el cliente"); }
  };

  const grupos = useMemo(() => {
    const g = {};
    items.forEach((c) => {
      const key = c.fecha ? c.fecha.split("T")[0] : "sin-fecha";
      (g[key] = g[key] || []).push(c);
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const eventosPorDia = useMemo(() => {
    const m = {};
    const push = (k, ev) => { if (k) (m[k] = m[k] || []).push(ev); };
    items.forEach((c) => {
      if (!c.fecha) return;
      const e = ESTADOS.find((x) => x.value === c.estado) || ESTADOS[0];
      push(c.fecha.split("T")[0], { key: "c" + c.id, hora: fmtHora(c.fecha), texto: c.vehiculo_matricula || c.motivo || "Cita", cls: e.cls, kind: "cita", ref: c });
    });
    peritajes.forEach((p) => {
      if (!p.fecha) return;
      push(p.fecha.split("T")[0], { key: "p" + p.id, hora: "", texto: `Valoración ${p.vehiculo_matricula || ""}`.trim(), cls: "bg-amber-50 text-amber-700 ring-amber-200", kind: "peritaje", ref: p });
    });
    prestamos.forEach((pr) => {
      const k = (pr.fecha_devolucion_prevista || pr.fecha_entrega || "").split("T")[0];
      push(k, { key: "pr" + pr.id, hora: "", texto: `Cortesía ${pr.vehiculo_matricula || ""}`.trim(), cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", kind: "cortesia", ref: pr });
    });
    Object.values(m).forEach((a) => a.sort((x, y) => (x.hora || "").localeCompare(y.hora || "")));
    return m;
  }, [items, peritajes, prestamos]);

  const clickEvento = (e, ev) => {
    e.stopPropagation();
    if (ev.kind === "cita") openEdit(ev.ref);
    else if (ev.kind === "peritaje") navigate("/taller/peritajes");
    else navigate("/taller/cortesia");
  };

  const Leyenda = () => (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-t border-zinc-100 text-[11px] text-zinc-500">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Citas</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Valoraciones pendientes</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Devolución cortesía</span>
    </div>
  );

  const renderMes = () => {
    const hoy = isoDay(new Date());
    const mesActual = mes.getMonth();
    return (
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="citas-mes">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h3 className="font-heading font-semibold text-zinc-900 capitalize">{mes.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</h3>
          <div className="flex items-center gap-1">
            <button data-testid="mes-hoy" onClick={() => { const d = new Date(); setMes(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50">Hoy</button>
            <button data-testid="mes-prev" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="p-1.5 rounded-md hover:bg-zinc-100"><CaretLeft size={16} /></button>
            <button data-testid="mes-next" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="p-1.5 rounded-md hover:bg-zinc-100"><CaretRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-100">
          {DIAS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((d, i) => {
            const k = isoDay(d); const evs = eventosPorDia[k] || []; const otro = d.getMonth() !== mesActual;
            return (
              <div key={i} onClick={() => openNewFecha(d)} data-testid={`mes-dia-${k}`} className={`min-h-[96px] border-b border-r border-zinc-100 p-1.5 cursor-pointer hover:bg-indigo-50/40 transition-colors ${otro ? "bg-zinc-50/60" : ""}`}>
                <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center ${k === hoy ? "rounded-full bg-primary text-white" : otro ? "text-zinc-300" : "text-zinc-500"}`}>{d.getDate()}</div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((ev) => (
                    <button key={ev.key} data-testid={`mes-ev-${ev.key}`} onClick={(e) => clickEvento(e, ev)} className={`w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium ring-1 ring-inset ${ev.cls}`}>
                      {ev.hora ? ev.hora + " " : ""}{ev.texto}
                    </button>
                  ))}
                  {evs.length > 3 && <div className="text-[10px] text-zinc-400 px-1">+{evs.length - 3} más</div>}
                </div>
              </div>
            );
          })}
        </div>
        <Leyenda />
      </div>
    );
  };

  const renderSemana = () => {
    const hoy = isoDay(new Date());
    const ini = diasSemana[0], fin = diasSemana[6];
    return (
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden" data-testid="citas-semana">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h3 className="font-heading font-semibold text-zinc-900 capitalize">{ini.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – {fin.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</h3>
          <div className="flex items-center gap-1">
            <button data-testid="sem-hoy" onClick={() => setSemana(new Date())} className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50">Hoy</button>
            <button data-testid="sem-prev" onClick={() => { const d = new Date(semana); d.setDate(d.getDate() - 7); setSemana(d); }} className="p-1.5 rounded-md hover:bg-zinc-100"><CaretLeft size={16} /></button>
            <button data-testid="sem-next" onClick={() => { const d = new Date(semana); d.setDate(d.getDate() + 7); setSemana(d); }} className="p-1.5 rounded-md hover:bg-zinc-100"><CaretRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 min-h-[440px]">
          {diasSemana.map((d, i) => {
            const k = isoDay(d); const evs = eventosPorDia[k] || [];
            return (
              <div key={i} onClick={() => openNewFecha(d)} data-testid={`sem-dia-${k}`} className="border-r last:border-r-0 border-zinc-100 p-2 cursor-pointer hover:bg-indigo-50/40 transition-colors">
                <div className="text-center mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">{DIAS[i]}</div>
                  <div className={`text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center ${k === hoy ? "rounded-full bg-primary text-white" : "text-zinc-700"}`}>{d.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {evs.map((ev) => (
                    <button key={ev.key} data-testid={`sem-ev-${ev.key}`} onClick={(e) => clickEvento(e, ev)} className={`w-full text-left rounded px-1.5 py-1 text-[11px] ring-1 ring-inset ${ev.cls}`}>
                      {ev.hora && <div className="font-mono-plex text-[10px] opacity-80">{ev.hora}</div>}
                      <div className="truncate font-medium">{ev.texto}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <Leyenda />
      </div>
    );
  };

  return (
    <div className="p-8 max-w-[1100px]" data-testid="citas-page">
      <PageHeader title="Citas" subtitle="Agenda de citas vinculadas a los vehículos" chip={`${items.length} ${items.length === 1 ? "cita" : "citas"}`}>
        <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 mr-1">
          {[["agenda", "Agenda"], ["semana", "Semana"], ["mes", "Mes"]].map(([v, l]) => (
            <button key={v} data-testid={`vista-${v}`} onClick={() => setVista(v)} className={`px-3 py-1.5 text-sm rounded-[5px] transition-colors ${vista === v ? "bg-primary text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>{l}</button>
          ))}
        </div>
        <Button data-testid="nueva-cita-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700"><Plus size={16} className="mr-1.5" /> Nueva cita</Button>
      </PageHeader>

      {vista === "mes" ? renderMes()
        : vista === "semana" ? renderSemana()
        : loading ? <p className="text-zinc-400">Cargando...</p>
        : items.length === 0 ? (
          <div className="bg-white border border-dashed border-zinc-300 rounded-lg py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3"><CalendarBlank size={26} className="text-zinc-400" /></div>
            <p className="text-zinc-700 text-sm font-medium">No hay citas todavía</p>
            <p className="text-zinc-400 text-xs mt-0.5">Programa la primera cita de un vehículo.</p>
            <Button onClick={openNew} className="mt-4 rounded-md bg-primary hover:bg-indigo-700"><Plus size={15} className="mr-1.5" /> Nueva cita</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {grupos.map(([dia, citas]) => (
              <div key={dia} data-testid={`grupo-${dia}`}>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-zinc-700 capitalize"><CalendarBlank size={16} weight="duotone" className="text-primary" /> {fmtDay(citas[0].fecha)}</div>
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm divide-y divide-zinc-100">
                  {citas.map((c) => {
                    const est = ESTADOS.find((e) => e.value === c.estado) || ESTADOS[0];
                    return (
                      <div key={c.id} className="flex items-center gap-4 px-4 py-3" data-testid={`cita-row-${c.id}`}>
                        <div className="flex items-center gap-1.5 text-sm font-mono-plex text-zinc-900 w-16 shrink-0"><Clock size={14} className="text-zinc-400" /> {fmtHora(c.fecha)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-plex text-sm font-medium text-zinc-800">{c.vehiculo_matricula || "—"}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${est.cls}`}>{est.label}</span>
                            {c.tipo_trabajo && <span className="text-xs text-zinc-400">{c.tipo_trabajo}</span>}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{c.cliente_nombre || "—"}{c.motivo ? ` · ${c.motivo}` : ""}</div>
                        </div>
                        <select data-testid={`cita-estado-${c.id}`} value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value)} className="h-8 text-xs rounded-md border border-input bg-white px-2">
                          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                        <button data-testid={`recordatorio-cita-${c.id}`} disabled={enviando === c.id} onClick={() => enviarRecordatorio(c)}
                          title={c.recordatorio_enviado_at ? `Recordatorio enviado (${(c.recordatorio_canales || []).join(", ")})` : "Enviar recordatorio al cliente"}
                          className={`p-1.5 transition-colors ${c.recordatorio_enviado_at ? "text-emerald-500 hover:text-emerald-600" : "text-zinc-400 hover:text-primary"} disabled:opacity-40`}>
                          <PaperPlaneTilt size={16} weight={c.recordatorio_enviado_at ? "fill" : "regular"} />
                        </button>
                        <button data-testid={`editar-cita-${c.id}`} onClick={() => openEdit(c)} className="text-zinc-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                        <button data-testid={`eliminar-cita-${c.id}`} onClick={() => setDelId(c.id)} className="text-zinc-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-sm max-h-[92vh] overflow-y-auto" data-testid="cita-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editId ? "Editar cita" : "Nueva cita"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vehículo</Label>
                <button type="button" data-testid="cita-nuevo-vehiculo" onClick={() => setVehOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select data-testid="cita-vehiculo" value={form.vehiculo_id} onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })} className={selectCls}>
                <option value="">— Selecciona vehículo —</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{`${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}`}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Fecha y hora *</Label>
              <Input data-testid="cita-fecha" type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Duración (min)</Label>
              <Input type="number" value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <select value={form.tipo_trabajo} onChange={(e) => setForm({ ...form, tipo_trabajo: e.target.value })} className={selectCls}>
                {TIPOS.map((t) => <option key={t} value={t}>{t || "—"}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <select data-testid="cita-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={selectCls}>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Motivo</Label>
              <Input data-testid="cita-motivo" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="rounded-sm mt-1" placeholder="Ej. Presupuesto, reparación de golpe…" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-cita-button" onClick={save} className="rounded-sm bg-primary">Guardar cita</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de vehículo */}
      <Dialog open={vehOpen} onOpenChange={setVehOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="cita-vehiculo-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo vehículo</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs">Matrícula</Label><Input data-testid="cveh-matricula" value={vehForm.matricula} onChange={(e) => setVehForm({ ...vehForm, matricula: e.target.value.toUpperCase() })} className="rounded-sm mt-1 font-mono-plex" /></div>
            <div><Label className="text-xs">Tipo</Label><select value={vehForm.tipo} onChange={(e) => setVehForm({ ...vehForm, tipo: e.target.value })} className={selectCls}><option value="cliente">Del cliente</option><option value="cortesia">De cortesía</option></select></div>
            <div><Label className="text-xs">Marca</Label><Input value={vehForm.marca} onChange={(e) => setVehForm({ ...vehForm, marca: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">Modelo</Label><Input value={vehForm.modelo} onChange={(e) => setVehForm({ ...vehForm, modelo: e.target.value })} className="rounded-sm mt-1" /></div>
            <div className="col-span-2">
              <div className="flex items-center justify-between"><Label className="text-xs">Cliente</Label><button type="button" data-testid="cveh-nuevo-cliente" onClick={() => setCliOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button></div>
              <select value={vehForm.cliente_id} onChange={(e) => setVehForm({ ...vehForm, cliente_id: e.target.value })} className={selectCls}><option value="">— Sin asignar —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setVehOpen(false)} className="rounded-sm">Cancelar</Button><Button data-testid="guardar-cveh" onClick={guardarVehiculo} className="rounded-sm bg-primary">Dar de alta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de cliente */}
      <Dialog open={cliOpen} onOpenChange={setCliOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="cita-cliente-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2"><Label className="text-xs">Nombre / Razón social *</Label><Input data-testid="ccli-nombre" value={cliForm.nombre} onChange={(e) => setCliForm({ ...cliForm, nombre: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">NIF / CIF</Label><Input value={cliForm.nif} onChange={(e) => setCliForm({ ...cliForm, nif: e.target.value })} className="rounded-sm mt-1 font-mono-plex" /></div>
            <div><Label className="text-xs">Teléfono</Label><Input value={cliForm.telefono} onChange={(e) => setCliForm({ ...cliForm, telefono: e.target.value })} className="rounded-sm mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCliOpen(false)} className="rounded-sm">Cancelar</Button><Button data-testid="guardar-ccli" onClick={guardarCliente} className="rounded-sm bg-primary">Dar de alta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar cita?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel><AlertDialogAction data-testid="confirmar-eliminar-cita" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
