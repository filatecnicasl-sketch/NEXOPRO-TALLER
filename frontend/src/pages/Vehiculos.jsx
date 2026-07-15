import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PencilSimple, Trash, MagnifyingGlass, Car, ClipboardText } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getVehiculos, createVehiculo, updateVehiculo, deleteVehiculo, getVehiculoFicha, getContactos,
} from "@/lib/api";
import { eur } from "@/lib/api";
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
import { EstadoOTBadge } from "@/lib/taller";
import FotosGaleria from "@/components/FotosGaleria";

const EMPTY = {
  matricula: "", marca: "", modelo: "", bastidor: "", color: "", kilometros: "",
  combustible: "", anio: "", cliente_id: "", tipo: "cliente", notas: "",
};
const COMBUSTIBLES = ["Gasolina", "Diésel", "Híbrido", "Eléctrico", "GLP", "GNC", "Otro"];
const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";

export default function Vehiculos() {
  const [items, setItems] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [vistaFicha, setVistaFicha] = useState("resumen");

  const eventosHistorial = (f) => {
    if (!f) return [];
    const ev = [];
    (f.presupuestos || []).forEach((p) => ev.push({ k: "pre" + p.id, fecha: p.fecha || p.created_at, tipo: "Presupuesto", label: `${p.numero} · ${p.contacto_nombre || ""}`, importe: p.total, color: "bg-indigo-500" }));
    (f.ordenes || []).forEach((o) => ev.push({ k: "ord" + o.id, fecha: o.fecha_entrada || o.created_at, tipo: "Orden", label: `${o.numero} · ${o.estado}`, importe: o.total, color: "bg-blue-500" }));
    (f.peritajes || []).forEach((p) => ev.push({ k: "per" + p.id, fecha: p.fecha || p.created_at, tipo: "Valoración", label: `${p.numero} · ${p.compania || ""}`, importe: p.importe_total, color: "bg-amber-500" }));
    (f.citas || []).forEach((c) => ev.push({ k: "cit" + c.id, fecha: c.fecha, tipo: "Cita", label: c.motivo || c.tipo_trabajo || "Cita", importe: null, color: "bg-violet-500" }));
    (f.compras || []).forEach((c) => ev.push({ k: "com" + c.tipo + c.id, fecha: c.fecha, tipo: c.tipo, label: `${c.numero || ""} · ${c.proveedor || ""}`, importe: c.total, color: "bg-zinc-400" }));
    (f.prestamos || []).forEach((p) => ev.push({ k: "prest" + p.id, fecha: p.fecha_entrega || p.created_at, tipo: "Cortesía", label: p.cliente_nombre || "Préstamo", importe: null, color: "bg-emerald-500" }));
    return ev.filter((e) => e.fecha).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  };
  const fmtFechaHist = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");

  const load = () => {
    setLoading(true);
    getVehiculos().then((d) => { setItems(d); setLoading(false); });
  };
  useEffect(load, []);
  useEffect(() => { getContactos("cliente").then(setClientes); }, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (v) => {
    setForm({ ...EMPTY, ...v, kilometros: v.kilometros ?? "", anio: v.anio ?? "" });
    setEditId(v.id); setOpen(true);
  };

  const save = async () => {
    if (!form.matricula.trim() && !form.bastidor.trim())
      return toast.error("Indica al menos la matrícula o el bastidor");
    const payload = {
      ...form,
      kilometros: form.kilometros === "" ? null : Number(form.kilometros),
      anio: form.anio === "" ? null : Number(form.anio),
    };
    try {
      if (editId) { await updateVehiculo(editId, payload); toast.success("Vehículo actualizado"); }
      else { await createVehiculo(payload); toast.success("Vehículo creado"); }
      setOpen(false); load();
    } catch { toast.error("Error al guardar el vehículo"); }
  };

  const remove = async () => {
    await deleteVehiculo(delId); setDelId(null); toast.success("Vehículo eliminado"); load();
  };

  const openFicha = async (v) => {
    setVistaFicha("resumen");
    setFicha({ loading: true, vehiculo: v, ordenes: [], peritajes: [] });
    try { const d = await getVehiculoFicha(v.id); setFicha({ loading: false, ...d }); }
    catch { setFicha(null); toast.error("No se pudo abrir la ficha"); }
  };
  const refreshFicha = async () => {
    if (!ficha?.vehiculo?.id) return;
    const d = await getVehiculoFicha(ficha.vehiculo.id);
    setFicha({ loading: false, ...d });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((v) =>
      [v.matricula, v.marca, v.modelo, v.bastidor, v.cliente_nombre].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="vehiculos-page">
      <PageHeader title="Vehículos" subtitle="Vehículos vinculados a clientes" chip={`${items.length} ${items.length === 1 ? "vehículo" : "vehículos"}`}>
        <Button data-testid="nuevo-vehiculo-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700">
          <Plus size={16} className="mr-1.5" /> Nuevo vehículo
        </Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input data-testid="buscar-vehiculo-input" placeholder="Buscar por matrícula, marca o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-md bg-white" />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              {["Matrícula", "Vehículo", "Cliente", "Tipo", "Km", "Acciones"].map((h, i) => (
                <TableHead key={h} className={`text-[11px] uppercase tracking-wider text-zinc-500 font-semibold ${i === 5 ? "text-right" : ""}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3"><Car size={26} className="text-zinc-400" /></div>
                  <p className="text-zinc-700 text-sm font-medium">No hay vehículos todavía</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Empieza dando de alta el primer vehículo.</p>
                  <Button onClick={openNew} className="mt-4 rounded-md bg-primary hover:bg-indigo-700"><Plus size={15} className="mr-1.5" /> Nuevo vehículo</Button>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((v, i) => (
              <TableRow key={v.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors cursor-pointer" style={{ animationDelay: `${i * 25}ms` }} data-testid={`vehiculo-row-${v.id}`} onClick={() => openFicha(v)}>
                <TableCell className="py-2.5 font-mono-plex font-semibold text-zinc-900">{v.matricula || "—"}</TableCell>
                <TableCell className="text-zinc-700 text-sm">{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}<div className="text-xs text-zinc-400">{v.color || ""}</div></TableCell>
                <TableCell className="text-zinc-600 text-sm">{v.cliente_nombre || "—"}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.tipo === "cortesia" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-zinc-100 text-zinc-600"}`}>
                    {v.tipo === "cortesia" ? "Cortesía" : "Cliente"}
                  </span>
                </TableCell>
                <TableCell className="text-zinc-600 text-sm tabular-nums">{v.kilometros != null ? `${v.kilometros.toLocaleString("es-ES")} km` : "—"}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <button data-testid={`ficha-${v.id}`} onClick={() => openFicha(v)} className="text-zinc-400 hover:text-primary p-1.5" title="Ver ficha"><ClipboardText size={16} /></button>
                  <button data-testid={`editar-vehiculo-${v.id}`} onClick={() => openEdit(v)} className="text-zinc-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-vehiculo-${v.id}`} onClick={() => setDelId(v.id)} className="text-zinc-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Alta / edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-sm max-h-[90vh] overflow-y-auto" data-testid="vehiculo-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editId ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs">Matrícula</Label>
              <Input data-testid="input-matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value.toUpperCase() })} className="rounded-sm mt-1 font-mono-plex" placeholder="0000 XXX" />
            </div>
            <div>
              <Label className="text-xs">Bastidor / VIN</Label>
              <Input value={form.bastidor} onChange={(e) => setForm({ ...form, bastidor: e.target.value.toUpperCase() })} className="rounded-sm mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Marca</Label>
              <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Modelo</Label>
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Año</Label>
              <Input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kilómetros</Label>
              <Input type="number" value={form.kilometros} onChange={(e) => setForm({ ...form, kilometros: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Combustible</Label>
              <select data-testid="input-combustible" value={form.combustible} onChange={(e) => setForm({ ...form, combustible: e.target.value })} className={selectCls}>
                <option value="">—</option>
                {COMBUSTIBLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Cliente</Label>
              <select data-testid="input-cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className={selectCls}>
                <option value="">— Sin asignar —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Tipo de vehículo</Label>
              <select data-testid="input-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={selectCls}>
                <option value="cliente">Del cliente</option>
                <option value="cortesia">De cortesía</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-vehiculo-button" onClick={save} className="rounded-sm bg-primary">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ficha */}
      <Dialog open={!!ficha} onOpenChange={(o) => !o && setFicha(null)}>
        <DialogContent className="sm:max-w-2xl rounded-sm max-h-[90vh] overflow-y-auto" data-testid="vehiculo-ficha-dialog">
          {ficha && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">
                  <Car size={20} weight="duotone" className="text-primary" />
                  <span className="font-mono-plex">{ficha.vehiculo.matricula || "Vehículo"}</span>
                  <span className="text-zinc-400 font-normal text-base">{[ficha.vehiculo.marca, ficha.vehiculo.modelo].filter(Boolean).join(" ")}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="flex gap-1 border-b border-zinc-100 -mt-1 mb-1">
                {[["resumen", "Resumen"], ["historial", "Historial"]].map(([v, l]) => (
                  <button key={v} data-testid={`ficha-tab-${v}`} onClick={() => setVistaFicha(v)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${vistaFicha === v ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>{l}</button>
                ))}
              </div>
              {vistaFicha === "historial" ? (
                <div className="py-2" data-testid="ficha-historial">
                  {ficha.loading ? <p className="text-sm text-zinc-400">Cargando...</p>
                    : eventosHistorial(ficha).length === 0 ? <p className="text-sm text-zinc-400 py-6 text-center">Sin actividad registrada para este vehículo todavía.</p>
                      : (
                        <ol className="relative border-l-2 border-zinc-100 ml-2 pl-5 space-y-4">
                          {eventosHistorial(ficha).map((e) => (
                            <li key={e.k} className="relative" data-testid="historial-item">
                              <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${e.color}`} />
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">{e.tipo}</span>
                                    <span className="text-xs text-zinc-400">{fmtFechaHist(e.fecha)}</span>
                                  </div>
                                  <div className="text-sm text-zinc-800 truncate">{e.label}</div>
                                </div>
                                {e.importe != null && <span className="tabular-nums text-sm font-medium text-zinc-900 shrink-0">{eur(e.importe)}</span>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                </div>
              ) : (
              <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 py-2 text-sm">
                {[
                  ["Cliente", ficha.vehiculo.cliente_nombre || "—"],
                  ["Bastidor", ficha.vehiculo.bastidor || "—"],
                  ["Color", ficha.vehiculo.color || "—"],
                  ["Año", ficha.vehiculo.anio ?? "—"],
                  ["Kilómetros", ficha.vehiculo.kilometros != null ? `${ficha.vehiculo.kilometros.toLocaleString("es-ES")} km` : "—"],
                  ["Combustible", ficha.vehiculo.combustible || "—"],
                ].map(([k, v]) => (
                  <div key={k}><div className="text-[10px] uppercase tracking-widest text-zinc-400">{k}</div><div className="text-zinc-800 font-medium">{v}</div></div>
                ))}
              </div>
              {ficha.vehiculo.notas && <p className="text-sm text-zinc-500 border-t border-zinc-100 pt-3">{ficha.vehiculo.notas}</p>}
              <div className="border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-heading font-semibold text-zinc-900 text-sm">Presupuestos</h4>
                  <button data-testid="nuevo-presupuesto-vehiculo" onClick={() => navigate(`/ventas/presupuestos?vehiculo=${ficha.vehiculo.id}`)} className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Plus size={13} /> Nuevo presupuesto</button>
                </div>
                {ficha.loading ? <p className="text-sm text-zinc-400">Cargando...</p>
                  : (ficha.presupuestos || []).length === 0 ? <p className="text-sm text-zinc-400">Sin presupuestos para este vehículo.</p>
                    : (
                      <div className="space-y-2">
                        {ficha.presupuestos.map((p) => (
                          <div key={p.id} className="flex items-center justify-between border border-zinc-100 rounded-md px-3 py-2 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono-plex text-xs text-zinc-500">{p.numero}</span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 capitalize">{p.estado}</span>
                              <span className="text-zinc-600 truncate">{p.contacto_nombre || "—"}</span>
                            </div>
                            <span className="tabular-nums font-medium text-zinc-900">{eur(p.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
              </div>
              <div className="border-t border-zinc-100 pt-4">
                <h4 className="font-heading font-semibold text-zinc-900 mb-2 text-sm">Órdenes de trabajo</h4>
                {ficha.loading ? <p className="text-sm text-zinc-400">Cargando...</p>
                  : ficha.ordenes.length === 0 ? <p className="text-sm text-zinc-400">Sin órdenes de trabajo para este vehículo.</p>
                    : (
                      <div className="space-y-2">
                        {ficha.ordenes.map((o) => (
                          <div key={o.id} className="flex items-center justify-between border border-zinc-100 rounded-md px-3 py-2 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-mono-plex text-xs text-zinc-500">{o.numero}</span>
                              <EstadoOTBadge estado={o.estado} />
                              <span className="text-zinc-600 truncate max-w-[220px]">{o.descripcion || "—"}</span>
                            </div>
                            <span className="tabular-nums font-medium text-zinc-900">{eur(o.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
              </div>
              <div className="border-t border-zinc-100 pt-4">
                <h4 className="font-heading font-semibold text-zinc-900 mb-2 text-sm">Valoraciones</h4>
                {ficha.loading ? <p className="text-sm text-zinc-400">Cargando...</p>
                  : (ficha.peritajes || []).length === 0 ? <p className="text-sm text-zinc-400">Sin valoraciones para este vehículo.</p>
                    : (
                      <div className="space-y-2">
                        {ficha.peritajes.map((p) => (
                          <div key={p.id} className="flex items-center justify-between border border-zinc-100 rounded-md px-3 py-2 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-mono-plex text-xs text-zinc-500">{p.numero}</span>
                              <span className="text-zinc-600">{p.compania || "—"}</span>
                              <span className="text-zinc-400 text-xs">{(p.fotos || []).length} foto(s)</span>
                            </div>
                            <span className="tabular-nums font-medium text-zinc-900">{eur(p.importe_total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
              </div>
              <div className="border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-heading font-semibold text-zinc-900 text-sm">Compras imputadas</h4>
                  {!ficha.loading && <span className="text-sm font-semibold text-primary tabular-nums" data-testid="coste-compras">Coste: {eur(ficha.coste_compras || 0)}</span>}
                </div>
                {ficha.loading ? <p className="text-sm text-zinc-400">Cargando...</p>
                  : (ficha.compras || []).length === 0 ? <p className="text-sm text-zinc-400">Sin compras imputadas a este vehículo.</p>
                    : (
                      <div className="space-y-2">
                        {ficha.compras.map((c) => (
                          <div key={`${c.tipo}-${c.id}`} className="flex items-center justify-between border border-zinc-100 rounded-md px-3 py-2 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 shrink-0">{c.tipo}</span>
                              <span className="font-mono-plex text-xs text-zinc-500">{c.numero || "—"}</span>
                              <span className="text-zinc-600 truncate">{c.proveedor || "—"}</span>
                            </div>
                            <span className="tabular-nums font-medium text-zinc-900">{eur(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
              </div>
              <div className="border-t border-zinc-100 pt-4">
                <FotosGaleria tipo="vehiculos" id={ficha.vehiculo.id} fotos={ficha.vehiculo.fotos || []} onChange={refreshFicha} titulo="Documentos y fotos (peritaciones, contratos…)" />
              </div>
              </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-vehiculo" onClick={remove} className="rounded-sm bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
