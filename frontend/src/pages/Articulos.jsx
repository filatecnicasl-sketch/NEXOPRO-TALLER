import { useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, MagnifyingGlass, Package } from "@phosphor-icons/react";
import Barcode from "react-barcode";
import { toast } from "sonner";
import { getArticulos, createArticulo, updateArticulo, deleteArticulo, eur } from "@/lib/api";
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

const IVA = [21, 10, 4, 0];
const EMPTY = { nombre: "", descripcion: "", precio: 0, tipo_iva: 21, unidad: "ud", codigo_proveedor: "", codigo_barras: "", notas: "" };

function BarcodePreview({ value }) {
  try {
    return <Barcode value={String(value)} height={48} fontSize={12} margin={4} />;
  } catch {
    return <span className="text-xs text-slate-400">Código no válido para código de barras</span>;
  }
}

export default function Articulos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const load = () => { setLoading(true); getArticulos().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(load, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (a) => { setForm(a); setEditId(a.id); setOpen(true); };

  const save = async () => {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    try {
      const payload = { ...form, precio: Number(form.precio), tipo_iva: Number(form.tipo_iva) };
      if (editId) { await updateArticulo(editId, payload); toast.success("Artículo actualizado"); }
      else { await createArticulo(payload); toast.success("Artículo creado"); }
      setOpen(false); load();
    } catch { toast.error("Error al guardar"); }
  };

  const remove = async () => { await deleteArticulo(delId); setDelId(null); toast.success("Artículo eliminado"); load(); };

  const filtered = items.filter(
    (a) => a.nombre.toLowerCase().includes(search.toLowerCase())
      || (a.referencia || "").toLowerCase().includes(search.toLowerCase())
      || (a.codigo_proveedor || "").toLowerCase().includes(search.toLowerCase())
      || (a.codigo_barras || "").toLowerCase().includes(search.toLowerCase())
      || (a.codigo_barras || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1400px]" data-testid="articulos-page">
      <PageHeader title="Artículos" subtitle="Catálogo de productos y servicios para usar en tus documentos">
        <Button data-testid="nuevo-articulo-button" onClick={openNew} className="rounded-sm bg-primary">
          <Plus size={16} className="mr-1" /> Nuevo artículo
        </Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input data-testid="buscar-articulo-input" placeholder="Buscar por nombre, referencia o código..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-sm" />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Referencia</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Cód. prov.</TableHead>
              <TableHead>Cód. barras/QR</TableHead>
              <TableHead>Origen (documentos)</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center text-slate-400 py-8">Cargando...</TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-16 text-center">
                <Package size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">No hay artículos todavía</p>
                <Button variant="link" onClick={openNew} className="text-primary">Añadir el primero</Button>
              </TableCell></TableRow>
            )}
            {filtered.map((a, i) => (
              <TableRow key={a.id} className="animate-row" style={{ animationDelay: `${i * 25}ms` }} data-testid={`articulo-row-${a.id}`}>
                <TableCell className="font-mono-plex text-xs text-slate-600">{a.referencia || "—"}</TableCell>
                <TableCell className="font-medium text-slate-800">
                  {a.nombre}
                  {a.auto && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary bg-accent px-1.5 py-0.5 rounded-sm">auto</span>}
                </TableCell>
                <TableCell className="font-mono-plex text-xs text-slate-600">{a.codigo_proveedor || "—"}</TableCell>
                <TableCell className="font-mono-plex text-xs text-slate-600">{a.codigo_barras || "—"}</TableCell>
                <TableCell>
                  {(a.origenes && a.origenes.length > 0) ? (
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {a.origenes.slice(0, 3).map((o, k) => (
                        <span key={k} className="text-[11px] font-mono-plex bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm" title={`${o.tipo} · ${o.proveedor || ""} · ${o.fecha || ""}`}>
                          {o.documento_numero}
                        </span>
                      ))}
                      {a.origenes.length > 3 && <span className="text-[11px] text-slate-400">+{a.origenes.length - 3}</span>}
                    </div>
                  ) : <span className="text-slate-300 text-xs">—</span>}
                </TableCell>
                <TableCell className="text-slate-600">{a.unidad}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(a.precio)}</TableCell>
                <TableCell className="text-right text-slate-600">{a.tipo_iva}%</TableCell>
                <TableCell className="text-right">
                  <button data-testid={`editar-${a.id}`} onClick={() => openEdit(a)} className="text-slate-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-${a.id}`} onClick={() => setDelId(a.id)} className="text-slate-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-sm" data-testid="articulo-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editId ? "Editar artículo" : "Nuevo artículo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs">Referencia (automática)</Label>
              <Input data-testid="input-referencia" value={editId ? (form.referencia || "") : "Se generará automáticamente"} disabled className="rounded-sm mt-1 font-mono-plex bg-slate-50 text-slate-500" />
            </div>
            <div>
              <Label className="text-xs">Unidad</Label>
              <Input value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Nombre *</Label>
              <Input data-testid="input-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="rounded-sm mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Precio (sin IVA)</Label>
              <Input data-testid="input-precio" type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo IVA</Label>
              <select value={form.tipo_iva} onChange={(e) => setForm({ ...form, tipo_iva: Number(e.target.value) })}
                className="w-full h-10 mt-1 border border-input rounded-sm bg-white px-2 text-sm">
                {IVA.map((v) => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Código proveedor</Label>
              <Input data-testid="input-codigo-proveedor" value={form.codigo_proveedor} onChange={(e) => setForm({ ...form, codigo_proveedor: e.target.value })} className="rounded-sm mt-1 font-mono-plex" placeholder="Ref. del proveedor" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Código de barras / QR</Label>
              <Input data-testid="input-codigo-barras" value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} className="rounded-sm mt-1 font-mono-plex" placeholder="Ej. 8412345678901" />
              {form.codigo_barras && (
                <div className="mt-3 flex justify-center bg-white border border-slate-200 rounded-sm p-3" data-testid="codigo-barras-preview">
                  <BarcodePreview value={form.codigo_barras} />
                </div>
              )}
            </div>
          </div>
          {editId && form.origenes && form.origenes.length > 0 && (
            <div className="border border-slate-200 rounded-sm p-3" data-testid="articulo-origenes">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Aparece en estos documentos de entrada</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {form.origenes.map((o, k) => (
                  <div key={k} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0">
                    <span className="font-mono-plex text-slate-700">{o.documento_numero}</span>
                    <span className="text-slate-400">{o.tipo === "factura_recibida" ? "Factura" : "Albarán"} · {o.proveedor || "—"} · {o.fecha || "—"}</span>
                    <span className="tabular-nums text-slate-600">{eur(o.precio)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-articulo-button" onClick={save} className="rounded-sm bg-primary">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar artículo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
