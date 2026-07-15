import { useEffect, useMemo, useState } from "react";
import { Plus, PencilSimple, Trash, MagnifyingGlass, ShieldCheck, Camera, Gear, Printer } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getPeritajes, createPeritaje, updatePeritaje, deletePeritaje, estadoPeritaje, getPeritaje,
  getVehiculos, getContactos, getCompanias, createCompania, deleteCompania, createVehiculo, createContacto, getAjustes, eur,
} from "@/lib/api";
import { imprimirInformePeritaje } from "@/lib/taller_print";
import PageHeader from "@/components/PageHeader";
import FotosGaleria from "@/components/FotosGaleria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPTY = {
  vehiculo_id: "", cliente_id: "", compania: "", poliza: "", siniestro: "",
  descripcion: "", danios: [], estado: "pendiente", fecha: "",
};
const ESTADOS = [
  { value: "pendiente", label: "Pendiente", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "valorado", label: "Valorado", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "aprobado", label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "rechazado", label: "Rechazado", cls: "bg-red-50 text-red-700 ring-red-200" },
];
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";

function EstadoBadge({ estado }) {
  const e = ESTADOS.find((x) => x.value === estado) || ESTADOS[0];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${e.cls}`}>{e.label}</span>;
}

export default function Peritajes() {
  const [items, setItems] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [companias, setCompanias] = useState([]);
  const [empresa, setEmpresa] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [danios, setDanios] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editFotos, setEditFotos] = useState([]);
  const [delId, setDelId] = useState(null);
  const [compOpen, setCompOpen] = useState(false);
  const [nuevaComp, setNuevaComp] = useState("");
  const [vehOpen, setVehOpen] = useState(false);
  const [vehForm, setVehForm] = useState({ matricula: "", marca: "", modelo: "", cliente_id: "", tipo: "cliente" });
  const [cliOpen, setCliOpen] = useState(false);
  const [cliForm, setCliForm] = useState({ nombre: "", nif: "", telefono: "", email: "" });

  const load = () => { setLoading(true); getPeritajes().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(load, []);
  useEffect(() => {
    getVehiculos().then(setVehiculos);
    getContactos("cliente").then(setClientes);
    getCompanias().then(setCompanias);
    getAjustes().then((a) => setEmpresa(a.empresa || {})).catch(() => {});
  }, []);

  const imprimir = (p) => {
    const veh = vehiculos.find((v) => v.id === p.vehiculo_id) || {};
    imprimirInformePeritaje({ empresa, peritaje: p, vehiculo: veh });
  };

  const openNew = () => { setForm(EMPTY); setDanios([]); setEditId(null); setEditFotos([]); setOpen(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p }); setDanios(p.danios || []); setEditId(p.id); setEditFotos(p.fotos || []); setOpen(true); };

  const refreshFotos = async () => {
    if (!editId) return;
    const p = await getPeritaje(editId);
    setEditFotos(p.fotos || []);
  };

  const setDanio = (i, field, v) => { const n = [...danios]; n[i] = { ...n[i], [field]: v }; setDanios(n); };
  const addDanio = () => setDanios([...danios, { descripcion: "", importe: 0 }]);
  const rmDanio = (i) => setDanios(danios.filter((_, idx) => idx !== i));
  const totalDanios = danios.reduce((s, d) => s + Number(d.importe || 0), 0);

  const save = async () => {
    if (!form.vehiculo_id) return toast.error("Selecciona un vehículo");
    const payload = { ...form, danios: danios.map((d) => ({ descripcion: d.descripcion, importe: Number(d.importe || 0) })) };
    try {
      if (editId) { await updatePeritaje(editId, payload); toast.success("Peritaje actualizado"); }
      else {
        const p = await createPeritaje(payload);
        setEditId(p.id); setEditFotos(p.fotos || []);
        toast.success("Valoración creada. Ya puedes añadir fotos.");
        load();
        return; // mantener abierto para adjuntar fotos
      }
      setOpen(false); load();
    } catch { toast.error("Error al guardar la valoración"); }
  };

  const cambiarEstado = async (p, estado) => {
    try { await estadoPeritaje(p.id, estado); toast.success("Estado actualizado"); load(); }
    catch { toast.error("No se pudo cambiar el estado"); }
  };

  const remove = async () => { await deletePeritaje(delId); setDelId(null); toast.success("Valoración eliminada"); load(); };

  const addCompania = async () => {
    if (!nuevaComp.trim()) return;
    try { const c = await createCompania({ nombre: nuevaComp.trim() }); setCompanias([...companias, c].sort((a, b) => a.nombre.localeCompare(b.nombre))); setNuevaComp(""); toast.success("Compañía añadida"); }
    catch { toast.error("Error al añadir compañía"); }
  };
  const rmCompania = async (id) => { await deleteCompania(id); setCompanias(companias.filter((c) => c.id !== id)); };

  const guardarVehiculoRapido = async () => {
    if (!vehForm.matricula.trim() && !vehForm.marca.trim()) return toast.error("Indica al menos la matrícula");
    try {
      const v = await createVehiculo({ ...vehForm, matricula: vehForm.matricula.toUpperCase() });
      setVehiculos(await getVehiculos());
      setForm((f) => ({ ...f, vehiculo_id: v.id }));
      setVehOpen(false); setVehForm({ matricula: "", marca: "", modelo: "", cliente_id: "", tipo: "cliente" });
      toast.success("Vehículo dado de alta");
    } catch { toast.error("Error al crear el vehículo"); }
  };

  const guardarClienteRapido = async () => {
    if (!cliForm.nombre.trim()) return toast.error("El nombre es obligatorio");
    try {
      const c = await createContacto({ ...cliForm, tipo: "cliente" });
      setClientes(await getContactos("cliente"));
      setVehForm((f) => ({ ...f, cliente_id: c.id }));
      setCliOpen(false); setCliForm({ nombre: "", nif: "", telefono: "", email: "" });
      toast.success("Cliente dado de alta");
    } catch { toast.error("Error al crear el cliente"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((p) => [p.numero, p.vehiculo_matricula, p.cliente_nombre, p.compania, p.siniestro].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="peritajes-page">
      <PageHeader title="Valoraciones" subtitle="Daños, compañía de seguros y reportaje fotográfico" chip={`${items.length} ${items.length === 1 ? "valoración" : "valoraciones"}`}>
        <Button variant="outline" onClick={() => setCompOpen(true)} className="rounded-md" data-testid="gestionar-companias-button"><Gear size={16} className="mr-1.5" /> Compañías</Button>
        <Button data-testid="nuevo-peritaje-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700"><Plus size={16} className="mr-1.5" /> Nueva valoración</Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input data-testid="buscar-peritaje-input" placeholder="Buscar por nº, matrícula, compañía o siniestro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-md bg-white" />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              {["Nº", "Vehículo", "Compañía", "Siniestro", "Estado", "Fotos", "Importe", "Acciones"].map((h, i) => (
                <TableHead key={h} className={`text-[11px] uppercase tracking-wider text-zinc-500 font-semibold ${i >= 6 ? "text-right" : ""}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3"><ShieldCheck size={26} className="text-zinc-400" /></div>
                  <p className="text-zinc-700 text-sm font-medium">No hay valoraciones todavía</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Crea la primera valoración con sus daños y fotos.</p>
                  <Button onClick={openNew} className="mt-4 rounded-md bg-primary hover:bg-indigo-700"><Plus size={15} className="mr-1.5" /> Nueva valoración</Button>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p, i) => (
              <TableRow key={p.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`peritaje-row-${p.id}`}>
                <TableCell className="py-2.5 font-mono-plex text-xs font-semibold text-zinc-900">{p.numero}</TableCell>
                <TableCell className="font-mono-plex text-sm text-zinc-700">{p.vehiculo_matricula || "—"}</TableCell>
                <TableCell className="text-zinc-600 text-sm">{p.compania || "—"}</TableCell>
                <TableCell className="text-zinc-500 text-sm">{p.siniestro || "—"}</TableCell>
                <TableCell>
                  <select data-testid={`peritaje-estado-select-${p.id}`} value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value)} className="h-8 text-xs rounded-md border border-input bg-white px-2">
                    {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </TableCell>
                <TableCell className="text-zinc-500 text-sm"><span className="inline-flex items-center gap-1"><Camera size={14} /> {(p.fotos || []).length}</span></TableCell>
                <TableCell className="text-right tabular-nums font-medium text-zinc-900">{eur(p.importe_total)}</TableCell>
                <TableCell className="text-right">
                  <button data-testid={`imprimir-peritaje-${p.id}`} onClick={() => imprimir(p)} className="text-zinc-400 hover:text-primary p-1.5" title="Imprimir informe"><Printer size={16} /></button>
                  <button data-testid={`editar-peritaje-${p.id}`} onClick={() => openEdit(p)} className="text-zinc-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-peritaje-${p.id}`} onClick={() => setDelId(p.id)} className="text-zinc-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Alta / edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-sm max-h-[92vh] overflow-y-auto" data-testid="peritaje-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editId ? `Valoración ${form.numero || ""}` : "Nueva valoración"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vehículo *</Label>
                <button type="button" data-testid="peritaje-nuevo-vehiculo" onClick={() => setVehOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select data-testid="peritaje-vehiculo" value={form.vehiculo_id} onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })} className={selectCls}>
                <option value="">— Selecciona vehículo —</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{`${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}`}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Compañía de seguros</Label>
              <select data-testid="peritaje-compania" value={form.compania} onChange={(e) => setForm({ ...form, compania: e.target.value })} className={selectCls}>
                <option value="">— Selecciona compañía —</option>
                {companias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Nº póliza</Label>
              <Input value={form.poliza} onChange={(e) => setForm({ ...form, poliza: e.target.value })} className="rounded-sm mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Nº siniestro</Label>
              <Input data-testid="peritaje-siniestro" value={form.siniestro} onChange={(e) => setForm({ ...form, siniestro: e.target.value })} className="rounded-sm mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <select data-testid="peritaje-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={selectCls}>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descripción de los daños</Label>
              <Textarea data-testid="peritaje-descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>

            {/* Daños valorados */}
            <div className="col-span-2">
              <Label className="text-xs mb-2 block">Valoración de daños</Label>
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_140px_40px] gap-2 bg-zinc-50 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <div>Concepto</div><div className="text-right">Importe</div><div />
                </div>
                {danios.length === 0 && <div className="px-3 py-5 text-center text-sm text-zinc-400">Sin daños valorados.</div>}
                {danios.map((d, i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px_40px] gap-2 px-3 py-2 border-t border-zinc-100 items-center">
                    <Input data-testid={`danio-desc-${i}`} value={d.descripcion} onChange={(e) => setDanio(i, "descripcion", e.target.value)} className="h-9 text-sm rounded-md" placeholder="Ej. Pintura aleta delantera" />
                    <Input data-testid={`danio-importe-${i}`} type="number" value={d.importe} onChange={(e) => setDanio(i, "importe", e.target.value)} className="h-9 text-sm rounded-md text-right" />
                    <button onClick={() => rmDanio(i)} className="text-zinc-400 hover:text-red-500 flex justify-center"><Trash size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <Button variant="outline" size="sm" className="rounded-md" data-testid="add-danio-button" onClick={addDanio}><Plus size={15} className="mr-1" /> Añadir daño</Button>
                <div className="text-sm text-zinc-900 font-semibold">Total daños <span className="tabular-nums ml-1 text-primary">{eur(totalDanios)}</span></div>
              </div>
            </div>

            {/* Fotos: sólo tras crear (necesita id) */}
            <div className="col-span-2 border-t border-zinc-100 pt-4">
              {editId ? (
                <FotosGaleria tipo="peritajes" id={editId} fotos={editFotos} onChange={refreshFotos} titulo="Reportaje fotográfico de daños" />
              ) : (
                <p className="text-sm text-zinc-400">Guarda la valoración para poder adjuntar fotos (subida directa o por QR desde el móvil).</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); }} className="rounded-sm">Cerrar</Button>
            <Button data-testid="guardar-peritaje-button" onClick={save} className="rounded-sm bg-primary">{editId ? "Guardar cambios" : "Crear valoración"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compañías de seguros */}
      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="companias-dialog">
          <DialogHeader><DialogTitle className="font-heading">Compañías de seguros</DialogTitle></DialogHeader>
          <div className="flex gap-2 py-2">
            <Input data-testid="nueva-compania-input" value={nuevaComp} onChange={(e) => setNuevaComp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCompania()} placeholder="Nombre de la compañía" className="rounded-sm" />
            <Button data-testid="add-compania-button" onClick={addCompania} className="rounded-sm bg-primary"><Plus size={16} /></Button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {companias.length === 0 && <p className="text-sm text-zinc-400 py-3 text-center">Sin compañías. Añade la primera.</p>}
            {companias.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-50 text-sm">
                <span className="text-zinc-800">{c.nombre}</span>
                <button onClick={() => rmCompania(c.id)} className="text-zinc-400 hover:text-red-500"><Trash size={15} /></button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de vehículo */}
      <Dialog open={vehOpen} onOpenChange={setVehOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="peritaje-vehiculo-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo vehículo</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs">Matrícula</Label>
              <Input data-testid="pveh-matricula" value={vehForm.matricula} onChange={(e) => setVehForm({ ...vehForm, matricula: e.target.value.toUpperCase() })} className="rounded-sm mt-1 font-mono-plex" />
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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cliente</Label>
                <button type="button" data-testid="pveh-nuevo-cliente" onClick={() => setCliOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select value={vehForm.cliente_id} onChange={(e) => setVehForm({ ...vehForm, cliente_id: e.target.value })} className={selectCls}>
                <option value="">— Sin asignar —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-pveh" onClick={guardarVehiculoRapido} className="rounded-sm bg-primary">Dar de alta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de cliente */}
      <Dialog open={cliOpen} onOpenChange={setCliOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="peritaje-cliente-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Nombre / Razón social *</Label>
              <Input data-testid="pcli-nombre" value={cliForm.nombre} onChange={(e) => setCliForm({ ...cliForm, nombre: e.target.value })} className="rounded-sm mt-1" />
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
            <Button data-testid="guardar-pcli" onClick={guardarClienteRapido} className="rounded-sm bg-primary">Dar de alta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar valoración?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-peritaje" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
