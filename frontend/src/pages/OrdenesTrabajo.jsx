import { useEffect, useMemo, useState } from "react";
import { Plus, PencilSimple, Trash, MagnifyingGlass, Wrench } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getOrdenes, createOrden, updateOrden, deleteOrden, estadoOrden,
  getVehiculos, getContactos, getArticulos, createVehiculo, createContacto, eur,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import LineasEditor from "@/components/LineasEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIPOS_TRABAJO, ESTADOS_OT } from "@/lib/taller";

const EMPTY = {
  vehiculo_id: "", cliente_id: "", tipos_trabajo: [], descripcion: "",
  estado: "recepcion", fecha_entrada: "", fecha_entrega_estimada: "", lineas: [], notas: "",
};
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";

export default function OrdenesTrabajo() {
  const [items, setItems] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [lineas, setLineas] = useState([]);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [vehOpen, setVehOpen] = useState(false);
  const [vehForm, setVehForm] = useState({ matricula: "", marca: "", modelo: "", cliente_id: "", tipo: "cliente" });
  const [cliOpen, setCliOpen] = useState(false);
  const [cliForm, setCliForm] = useState({ nombre: "", nif: "", telefono: "", email: "" });

  const load = () => {
    setLoading(true);
    getOrdenes().then((d) => { setItems(d); setLoading(false); });
  };
  useEffect(load, []);
  useEffect(() => {
    getVehiculos().then(setVehiculos);
    getContactos("cliente").then(setClientes);
    getArticulos().then(setArticulos).catch(() => setArticulos([]));
  }, []);

  const openNew = () => { setForm(EMPTY); setLineas([]); setEditId(null); setOpen(true); };
  const openEdit = (o) => { setForm({ ...EMPTY, ...o }); setLineas(o.lineas || []); setEditId(o.id); setOpen(true); };

  const toggleTipo = (t) => {
    setForm((f) => ({ ...f, tipos_trabajo: f.tipos_trabajo.includes(t) ? f.tipos_trabajo.filter((x) => x !== t) : [...f.tipos_trabajo, t] }));
  };

  const save = async () => {
    if (!form.vehiculo_id) return toast.error("Selecciona un vehículo");
    const payload = { ...form, lineas };
    try {
      if (editId) { await updateOrden(editId, payload); toast.success("Orden actualizada"); }
      else { await createOrden(payload); toast.success("Orden creada"); }
      setOpen(false); load();
    } catch { toast.error("Error al guardar la orden"); }
  };

  const cambiarEstado = async (o, estado) => {
    try { await estadoOrden(o.id, estado); toast.success("Estado actualizado"); load(); }
    catch { toast.error("No se pudo cambiar el estado"); }
  };

  const remove = async () => { await deleteOrden(delId); setDelId(null); toast.success("Orden eliminada"); load(); };

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
      setForm((f) => ({ ...f, cliente_id: c.id }));
      setCliOpen(false); setCliForm({ nombre: "", nif: "", telefono: "", email: "" });
      toast.success("Cliente dado de alta");
    } catch { toast.error("Error al crear el cliente"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((o) => [o.numero, o.vehiculo_matricula, o.cliente_nombre, o.descripcion].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="ordenes-page">
      <PageHeader title="Órdenes de trabajo" subtitle="Chapa, pintura y mecánica" chip={`${items.length} ${items.length === 1 ? "orden" : "órdenes"}`}>
        <Button data-testid="nueva-orden-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700">
          <Plus size={16} className="mr-1.5" /> Nueva orden
        </Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input data-testid="buscar-orden-input" placeholder="Buscar por nº, matrícula o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-md bg-white" />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              {["Nº", "Vehículo", "Cliente", "Trabajos", "Estado", "Total", "Acciones"].map((h, i) => (
                <TableHead key={h} className={`text-[11px] uppercase tracking-wider text-zinc-500 font-semibold ${i >= 5 ? "text-right" : ""}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3"><Wrench size={26} className="text-zinc-400" /></div>
                  <p className="text-zinc-700 text-sm font-medium">No hay órdenes de trabajo</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Crea la primera orden de trabajo.</p>
                  <Button onClick={openNew} className="mt-4 rounded-md bg-primary hover:bg-indigo-700"><Plus size={15} className="mr-1.5" /> Nueva orden</Button>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((o, i) => (
              <TableRow key={o.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`orden-row-${o.id}`}>
                <TableCell className="py-2.5 font-mono-plex text-xs font-semibold text-zinc-900">{o.numero}</TableCell>
                <TableCell className="font-mono-plex text-sm text-zinc-700">{o.vehiculo_matricula || "—"}</TableCell>
                <TableCell className="text-zinc-600 text-sm">{o.cliente_nombre || "—"}</TableCell>
                <TableCell className="text-zinc-500 text-xs">{(o.tipos_trabajo || []).map((t) => TIPOS_TRABAJO.find((x) => x.value === t)?.label || t).join(", ") || "—"}</TableCell>
                <TableCell>
                  <select data-testid={`estado-select-${o.id}`} value={o.estado} onChange={(e) => cambiarEstado(o, e.target.value)} className="h-8 text-xs rounded-md border border-input bg-white px-2">
                    {ESTADOS_OT.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-zinc-900">{eur(o.total)}</TableCell>
                <TableCell className="text-right">
                  <button data-testid={`editar-orden-${o.id}`} onClick={() => openEdit(o)} className="text-zinc-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-orden-${o.id}`} onClick={() => setDelId(o.id)} className="text-zinc-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl rounded-sm max-h-[92vh] overflow-y-auto" data-testid="orden-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editId ? `Orden ${form.numero || ""}${form.vehiculo_matricula ? " · " + form.vehiculo_matricula : ""}` : "Nueva orden de trabajo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vehículo *</Label>
                <button type="button" data-testid="orden-nuevo-vehiculo" onClick={() => setVehOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select data-testid="orden-vehiculo" value={form.vehiculo_id} onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })} className={selectCls}>
                <option value="">— Selecciona vehículo —</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{`${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}`}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cliente</Label>
                <button type="button" data-testid="orden-nuevo-cliente" onClick={() => setCliOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select data-testid="orden-cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className={selectCls}>
                <option value="">— Del vehículo —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Tipo de trabajo</Label>
              <div className="flex gap-4 mt-2">
                {TIPOS_TRABAJO.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox data-testid={`tipo-${t.value}`} checked={form.tipos_trabajo.includes(t.value)} onCheckedChange={() => toggleTipo(t.value)} />
                    <span className="text-sm text-zinc-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Fecha de entrada</Label>
              <Input type="date" value={form.fecha_entrada} onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Entrega estimada</Label>
              <Input type="date" value={form.fecha_entrega_estimada} onChange={(e) => setForm({ ...form, fecha_entrega_estimada: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Estado</Label>
              <select data-testid="orden-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={selectCls}>
                {ESTADOS_OT.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descripción del trabajo</Label>
              <Textarea data-testid="orden-descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-2 block">Líneas (mano de obra y materiales)</Label>
              <LineasEditor lineas={lineas} setLineas={setLineas} articulos={articulos} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notas internas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-orden-button" onClick={save} className="rounded-sm bg-primary">Guardar orden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de vehículo */}
      <Dialog open={vehOpen} onOpenChange={setVehOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="orden-vehiculo-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo vehículo</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs">Matrícula</Label>
              <Input data-testid="quick-veh-matricula" value={vehForm.matricula} onChange={(e) => setVehForm({ ...vehForm, matricula: e.target.value.toUpperCase() })} className="rounded-sm mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <select value={vehForm.tipo} onChange={(e) => setVehForm({ ...vehForm, tipo: e.target.value })} className={selectCls}>
                <option value="cliente">Del cliente</option>
                <option value="cortesia">De cortesía</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Marca</Label>
              <Input value={vehForm.marca} onChange={(e) => setVehForm({ ...vehForm, marca: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Modelo</Label>
              <Input value={vehForm.modelo} onChange={(e) => setVehForm({ ...vehForm, modelo: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Cliente</Label>
              <select value={vehForm.cliente_id} onChange={(e) => setVehForm({ ...vehForm, cliente_id: e.target.value })} className={selectCls}>
                <option value="">— Sin asignar —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-quick-vehiculo" onClick={guardarVehiculo} className="rounded-sm bg-primary">Dar de alta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de cliente */}
      <Dialog open={cliOpen} onOpenChange={setCliOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="orden-cliente-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Nombre / Razón social *</Label>
              <Input data-testid="quick-cli-nombre" value={cliForm.nombre} onChange={(e) => setCliForm({ ...cliForm, nombre: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">NIF / CIF</Label>
              <Input value={cliForm.nif} onChange={(e) => setCliForm({ ...cliForm, nif: e.target.value })} className="rounded-sm mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={cliForm.telefono} onChange={(e) => setCliForm({ ...cliForm, telefono: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Email</Label>
              <Input value={cliForm.email} onChange={(e) => setCliForm({ ...cliForm, email: e.target.value })} className="rounded-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCliOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-quick-cliente" onClick={guardarCliente} className="rounded-sm bg-primary">Dar de alta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden de trabajo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-orden" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
