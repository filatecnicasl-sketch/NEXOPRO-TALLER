import { useEffect, useMemo, useState } from "react";
import { Plus, PencilSimple, Trash, CalendarBlank, Clock, Car } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getCitas, createCita, updateCita, estadoCita, deleteCita,
  getVehiculos, getContactos, createVehiculo, createContacto,
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
const TIPOS = ["", "Chapa", "Pintura", "Mecánica", "Revisión", "Peritaje", "Recepción", "Entrega"];
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";

const fmtDay = (iso) => {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const fmtHora = (iso) => (iso && iso.includes("T") ? iso.split("T")[1].slice(0, 5) : "—");

export default function Citas() {
  const [items, setItems] = useState([]);
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

  const load = () => { setLoading(true); getCitas().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(load, []);
  useEffect(() => { getVehiculos().then(setVehiculos); getContactos("cliente").then(setClientes); }, []);

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

  return (
    <div className="p-8 max-w-[1100px]" data-testid="citas-page">
      <PageHeader title="Citas" subtitle="Agenda de citas vinculadas a los vehículos" chip={`${items.length} ${items.length === 1 ? "cita" : "citas"}`}>
        <Button data-testid="nueva-cita-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700"><Plus size={16} className="mr-1.5" /> Nueva cita</Button>
      </PageHeader>

      {loading ? <p className="text-zinc-400">Cargando...</p>
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
