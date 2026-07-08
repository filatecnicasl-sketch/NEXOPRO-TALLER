import { useEffect, useMemo, useState } from "react";
import { Plus, PencilSimple, Trash, Car, UploadSimple, FilePdf, Image as ImageIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getPrestamos, createPrestamo, updatePrestamo, deletePrestamo, subirContrato,
  getVehiculos, getContactos, createVehiculo, createContacto, mediaUrl,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EMPTY = {
  vehiculo_id: "", cliente_id: "", fecha_entrega: "", fecha_devolucion_prevista: "",
  fecha_devolucion_real: "", km_entrega: "", km_devolucion: "", estado: "activo", notas: "",
};
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";

export default function Cortesia() {
  const [items, setItems] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [delId, setDelId] = useState(null);
  const [vehOpen, setVehOpen] = useState(false);
  const [vehForm, setVehForm] = useState({ matricula: "", marca: "", modelo: "", tipo: "cortesia" });
  const [cliOpen, setCliOpen] = useState(false);
  const [cliForm, setCliForm] = useState({ nombre: "", nif: "", telefono: "", email: "" });

  const load = () => { setLoading(true); getPrestamos().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(load, []);
  useEffect(() => { getVehiculos().then(setVehiculos); getContactos("cliente").then(setClientes); }, []);

  const cortesias = useMemo(() => vehiculos.filter((v) => v.tipo === "cortesia"), [vehiculos]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setEditData(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p, km_entrega: p.km_entrega ?? "", km_devolucion: p.km_devolucion ?? "" }); setEditId(p.id); setEditData(p); setOpen(true); };

  const payloadFrom = () => ({
    ...form,
    km_entrega: form.km_entrega === "" ? null : Number(form.km_entrega),
    km_devolucion: form.km_devolucion === "" ? null : Number(form.km_devolucion),
  });

  const save = async () => {
    if (!form.vehiculo_id) return toast.error("Selecciona el vehículo de cortesía");
    if (!form.cliente_id) return toast.error("Selecciona el cliente");
    try {
      if (editId) { const p = await updatePrestamo(editId, payloadFrom()); setEditData(p); toast.success("Préstamo actualizado"); load(); }
      else {
        const p = await createPrestamo(payloadFrom());
        setEditId(p.id); setEditData(p); toast.success("Préstamo creado. Ya puedes adjuntar el contrato.");
        load(); return;
      }
      setOpen(false); load();
    } catch { toast.error("Error al guardar el préstamo"); }
  };

  const uploadContrato = async (file) => {
    if (!file || !editId) return;
    try { const r = await subirContrato(editId, file); setEditData((d) => ({ ...d, ...r })); toast.success("Contrato adjuntado"); load(); }
    catch { toast.error("Error al subir el contrato"); }
  };

  const remove = async () => { await deletePrestamo(delId); setDelId(null); toast.success("Préstamo eliminado"); load(); };

  const guardarVehiculo = async () => {
    if (!vehForm.matricula.trim() && !vehForm.marca.trim()) return toast.error("Indica al menos la matrícula");
    try {
      const v = await createVehiculo({ ...vehForm, matricula: vehForm.matricula.toUpperCase(), tipo: "cortesia" });
      setVehiculos(await getVehiculos());
      setForm((f) => ({ ...f, vehiculo_id: v.id }));
      setVehOpen(false); setVehForm({ matricula: "", marca: "", modelo: "", tipo: "cortesia" });
      toast.success("Vehículo de cortesía dado de alta");
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

  return (
    <div className="p-8 max-w-[1300px]" data-testid="cortesia-page">
      <PageHeader title="Vehículos de cortesía" subtitle="Préstamos de vehículos de cortesía con contrato" chip={`${items.length} ${items.length === 1 ? "préstamo" : "préstamos"}`}>
        <Button data-testid="nuevo-prestamo-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700"><Plus size={16} className="mr-1.5" /> Nuevo préstamo</Button>
      </PageHeader>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              {["Vehículo cortesía", "Cliente", "Entrega", "Devolución prevista", "Estado", "Contrato", "Acciones"].map((h, i) => (
                <TableHead key={h} className={`text-[11px] uppercase tracking-wider text-zinc-500 font-semibold ${i === 6 ? "text-right" : ""}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3"><Car size={26} className="text-zinc-400" /></div>
                  <p className="text-zinc-700 text-sm font-medium">No hay préstamos de cortesía</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Registra el primer préstamo de un vehículo de cortesía.</p>
                  <Button onClick={openNew} className="mt-4 rounded-md bg-primary hover:bg-indigo-700"><Plus size={15} className="mr-1.5" /> Nuevo préstamo</Button>
                </TableCell>
              </TableRow>
            )}
            {items.map((p, i) => (
              <TableRow key={p.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`prestamo-row-${p.id}`}>
                <TableCell className="py-2.5 font-mono-plex text-sm font-semibold text-zinc-900">{p.vehiculo_matricula || "—"}</TableCell>
                <TableCell className="text-zinc-600 text-sm">{p.cliente_nombre || "—"}</TableCell>
                <TableCell className="text-zinc-500 text-sm">{p.fecha_entrega || "—"}</TableCell>
                <TableCell className="text-zinc-500 text-sm">{p.fecha_devolucion_prevista || "—"}</TableCell>
                <TableCell>
                  {p.estado !== "devuelto" && p.fecha_devolucion_prevista && p.fecha_devolucion_prevista < new Date().toISOString().slice(0, 10)
                    ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-600 ring-red-200" data-testid="prestamo-vencido">Vencido</span>
                    : <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${p.estado === "devuelto" ? "bg-zinc-100 text-zinc-600 ring-zinc-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>{p.estado === "devuelto" ? "Devuelto" : "Activo"}</span>}
                </TableCell>
                <TableCell>
                  {p.contrato_path
                    ? <a href={mediaUrl(p.contrato_path)} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1"><FilePdf size={14} /> Ver</a>
                    : <span className="text-zinc-300 text-xs">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <button data-testid={`editar-prestamo-${p.id}`} onClick={() => openEdit(p)} className="text-zinc-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-prestamo-${p.id}`} onClick={() => setDelId(p.id)} className="text-zinc-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl rounded-sm max-h-[92vh] overflow-y-auto" data-testid="prestamo-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editId ? "Préstamo de cortesía" : "Nuevo préstamo de cortesía"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vehículo de cortesía *</Label>
                <button type="button" data-testid="prestamo-nuevo-vehiculo" onClick={() => setVehOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select data-testid="prestamo-vehiculo" value={form.vehiculo_id} onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })} className={selectCls}>
                <option value="">— Selecciona vehículo —</option>
                {cortesias.map((v) => <option key={v.id} value={v.id}>{`${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}`}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cliente *</Label>
                <button type="button" data-testid="prestamo-nuevo-cliente" onClick={() => setCliOpen(true)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"><Plus size={12} /> Nuevo</button>
              </div>
              <select data-testid="prestamo-cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className={selectCls}>
                <option value="">— Selecciona cliente —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Fecha de entrega</Label><Input type="date" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">Devolución prevista</Label><Input type="date" value={form.fecha_devolucion_prevista} onChange={(e) => setForm({ ...form, fecha_devolucion_prevista: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">Km entrega</Label><Input type="number" value={form.km_entrega} onChange={(e) => setForm({ ...form, km_entrega: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">Km devolución</Label><Input type="number" value={form.km_devolucion} onChange={(e) => setForm({ ...form, km_devolucion: e.target.value })} className="rounded-sm mt-1" /></div>
            <div className="col-span-2">
              <Label className="text-xs">Estado</Label>
              <select data-testid="prestamo-estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={selectCls}>
                <option value="activo">Activo (prestado)</option>
                <option value="devuelto">Devuelto</option>
              </select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Notas</Label><Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="rounded-sm mt-1" rows={2} /></div>

            <div className="col-span-2 border-t border-zinc-100 pt-4">
              <Label className="text-xs mb-2 block">Contrato de cesión</Label>
              {editId ? (
                <div className="flex items-center gap-3">
                  {editData?.contrato_path && (
                    <a href={mediaUrl(editData.contrato_path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                      {(editData.contrato_filename || "").toLowerCase().endsWith(".pdf") ? <FilePdf size={16} /> : <ImageIcon size={16} />} {editData.contrato_filename || "Ver contrato"}
                    </a>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer border border-zinc-200 rounded-md px-3 py-1.5 hover:bg-zinc-50">
                    <UploadSimple size={15} /> {editData?.contrato_path ? "Reemplazar" : "Escanear / subir contrato"}
                    <input type="file" accept="image/*,application/pdf" className="hidden" data-testid="contrato-input" onChange={(e) => uploadContrato(e.target.files[0])} />
                  </label>
                </div>
              ) : <p className="text-sm text-zinc-400">Guarda el préstamo para poder adjuntar el contrato escaneado.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cerrar</Button>
            <Button data-testid="guardar-prestamo-button" onClick={save} className="rounded-sm bg-primary">{editId ? "Guardar cambios" : "Crear préstamo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de vehículo de cortesía */}
      <Dialog open={vehOpen} onOpenChange={setVehOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="prestamo-vehiculo-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo vehículo de cortesía</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div><Label className="text-xs">Matrícula</Label><Input data-testid="cortveh-matricula" value={vehForm.matricula} onChange={(e) => setVehForm({ ...vehForm, matricula: e.target.value.toUpperCase() })} className="rounded-sm mt-1 font-mono-plex" /></div>
            <div><Label className="text-xs">Marca</Label><Input value={vehForm.marca} onChange={(e) => setVehForm({ ...vehForm, marca: e.target.value })} className="rounded-sm mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs">Modelo</Label><Input value={vehForm.modelo} onChange={(e) => setVehForm({ ...vehForm, modelo: e.target.value })} className="rounded-sm mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setVehOpen(false)} className="rounded-sm">Cancelar</Button><Button data-testid="guardar-cortveh" onClick={guardarVehiculo} className="rounded-sm bg-primary">Dar de alta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta rápida de cliente */}
      <Dialog open={cliOpen} onOpenChange={setCliOpen}>
        <DialogContent className="sm:max-w-md rounded-sm" data-testid="prestamo-cliente-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nuevo cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2"><Label className="text-xs">Nombre / Razón social *</Label><Input data-testid="cortcli-nombre" value={cliForm.nombre} onChange={(e) => setCliForm({ ...cliForm, nombre: e.target.value })} className="rounded-sm mt-1" /></div>
            <div><Label className="text-xs">NIF / CIF</Label><Input value={cliForm.nif} onChange={(e) => setCliForm({ ...cliForm, nif: e.target.value })} className="rounded-sm mt-1 font-mono-plex" /></div>
            <div><Label className="text-xs">Teléfono</Label><Input value={cliForm.telefono} onChange={(e) => setCliForm({ ...cliForm, telefono: e.target.value })} className="rounded-sm mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCliOpen(false)} className="rounded-sm">Cancelar</Button><Button data-testid="guardar-cortcli" onClick={guardarCliente} className="rounded-sm bg-primary">Dar de alta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar préstamo?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel><AlertDialogAction data-testid="confirmar-eliminar-prestamo" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
