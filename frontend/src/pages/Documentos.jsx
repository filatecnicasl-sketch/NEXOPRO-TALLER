import { useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, Sparkle, FileText } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getDocumentos, createDocumento, updateDocumento, deleteDocumento, getContactos, getArticulos, getAjustes, eur,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Initials from "@/components/Initials";
import Pill from "@/components/Pill";
import LineasEditor, { calcTotales } from "@/components/LineasEditor";
import ImportPdfDialog from "@/components/ImportPdfDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CFG = {
  pedidos: {
    label: "Pedido", plural: "Pedidos", sub: "Gestiona pedidos de compra y de venta",
    tabs: [{ key: "compra", label: "De compra" }, { key: "venta", label: "De venta" }],
  },
  albaranes: {
    label: "Albarán", plural: "Albaranes", sub: "Albaranes recibidos (entrada) y emitidos (salida)",
    tabs: [{ key: "compra", label: "Recibidos" }, { key: "venta", label: "Emitidos" }],
  },
};

const ESTADOS = ["borrador", "confirmado", "entregado", "facturado"];
const estadoTone = (e) => ({
  borrador: "neutral",
  confirmado: "info",
  entregado: "success",
  facturado: "violet",
}[e] || "neutral");

const emptyForm = (tipo) => ({
  tipo_operacion: tipo, serie: "", contacto_id: "", contacto_nombre: "", contacto_nif: "",
  fecha: new Date().toISOString().slice(0, 10), estado: "borrador", lineas: [], notas: "",
});

export default function Documentos({ entidad }) {
  const cfg = CFG[entidad];
  const [tab, setTab] = useState("compra");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactos, setContactos] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [seriesVenta, setSeriesVenta] = useState([]);
  const [seriesCompra, setSeriesCompra] = useState([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(emptyForm("compra"));
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const load = () => { setLoading(true); getDocumentos(entidad).then((d) => { setItems(d); setLoading(false); }); };
  useEffect(() => { load(); getContactos().then(setContactos); getArticulos().then(setArticulos); getAjustes().then((a) => { setSeriesVenta(a.series_venta || []); setSeriesCompra(a.series_compra || []); }); }, [entidad]);

  const visibles = items.filter((d) => d.tipo_operacion === tab);
  const esRecibido = tab === "compra";
  const contactosForm = contactos.filter((c) => (form.tipo_operacion === "venta" ? c.tipo === "cliente" : c.tipo === "proveedor"));
  const seriesForm = form.tipo_operacion === "venta" ? seriesVenta : seriesCompra;

  const openNew = () => {
    const lista = tab === "venta" ? seriesVenta : seriesCompra;
    const def = lista.find((s) => s.por_defecto) || lista[0];
    setForm({ ...emptyForm(tab), serie: def?.nombre || "" });
    setEditId(null); setOpen(true);
  };
  const openEdit = (d) => { setForm({ ...d, lineas: d.lineas.map((l) => ({ ...l })) }); setEditId(d.id); setOpen(true); };

  const onContacto = (id) => {
    const c = contactos.find((x) => x.id === id);
    setForm({ ...form, contacto_id: id, contacto_nombre: c?.nombre || "", contacto_nif: c?.nif || "" });
  };

  const save = async () => {
    if (form.lineas.length === 0) return toast.error("Añade al menos una línea");
    try {
      if (editId) { await updateDocumento(entidad, editId, form); toast.success(`${cfg.label} actualizado`); }
      else { await createDocumento(entidad, form); toast.success(`${cfg.label} creado`); }
      setOpen(false); load(); getContactos().then(setContactos);
    } catch { toast.error("Error al guardar"); }
  };

  const remove = async () => { await deleteDocumento(entidad, delId); setDelId(null); toast.success("Eliminado"); load(); };

  const onExtracted = (datos) => {
    const prov = datos.proveedor_existente;
    setForm({
      tipo_operacion: "compra",
      serie: "",
      contacto_id: prov?.id || "",
      contacto_nombre: prov?.nombre || datos.proveedor?.nombre || "",
      contacto_nif: prov?.nif || datos.proveedor?.nif || "",
      fecha: datos.fecha || new Date().toISOString().slice(0, 10),
      estado: "confirmado",
      lineas: (datos.lineas || []).map((l) => ({
        descripcion: l.descripcion, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
        descuento: l.descuento || 0, tipo_iva: l.tipo_iva ?? 21,
      })),
      notas: `Importado por IA. Nº origen: ${datos.numero || "—"}`,
    });
    setEditId(null);
    setOpen(true);
  };

  const totales = calcTotales(form.lineas);

  return (
    <div className="p-8 max-w-[1400px]" data-testid={`${entidad}-page`}>
      <PageHeader title={cfg.plural} subtitle={cfg.sub} chip={`${visibles.length} ${esRecibido ? "de compra" : "de venta"}`}>
        {esRecibido && (
          <Button data-testid="importar-ia-button" variant="outline" onClick={() => setImportOpen(true)} className="rounded-md">
            <Sparkle size={16} className="mr-1.5 text-primary" /> Importar PDF (IA)
          </Button>
        )}
        <Button data-testid="nuevo-documento-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700">
          <Plus size={16} className="mr-1.5" /> Nuevo {cfg.label.toLowerCase()}
        </Button>
      </PageHeader>

      <div className="inline-flex border border-zinc-200 rounded-lg bg-white p-1 mb-4 shadow-sm">
        {cfg.tabs.map((t) => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === t.key ? "bg-primary text-white font-medium" : "text-zinc-600 hover:bg-zinc-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200 [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-zinc-500 [&>th]:font-semibold">
              <TableHead>Número</TableHead>
              <TableHead>{esRecibido ? "Proveedor" : "Cliente"}</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && visibles.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-16 text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                  <FileText size={26} className="text-zinc-400" />
                </div>
                <p className="text-zinc-700 text-sm font-medium">No hay {cfg.plural.toLowerCase()} {esRecibido ? "recibidos" : "emitidos"} todavía</p>
                {esRecibido && <Button variant="link" onClick={() => setImportOpen(true)} className="text-primary mt-1">Importar desde un PDF</Button>}
              </TableCell></TableRow>
            )}
            {visibles.map((d, i) => (
              <TableRow key={d.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`documento-row-${d.id}`}>
                <TableCell className="py-2.5 font-mono-plex text-xs font-medium text-zinc-800">{d.numero}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Initials name={d.contacto_nombre || "—"} size={30} />
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 truncate">{d.contacto_nombre || "—"}</div>
                      {d.contacto_nif && <div className="text-xs text-zinc-400 font-mono-plex">{d.contacto_nif}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-600 text-sm">{d.fecha}</TableCell>
                <TableCell className="text-center"><Pill tone={estadoTone(d.estado)} className="capitalize">{d.estado}</Pill></TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-zinc-900">{eur(d.total)}</TableCell>
                <TableCell className="text-right">
                  <button data-testid={`editar-${d.id}`} onClick={() => openEdit(d)} className="text-zinc-400 hover:text-primary p-1.5 transition-colors"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-${d.id}`} onClick={() => setDelId(d.id)} className="text-zinc-400 hover:text-red-500 p-1.5 transition-colors"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-lg max-h-[90vh] overflow-y-auto" data-testid="documento-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">
              {editId ? `Editar ${cfg.label.toLowerCase()}` : `Nuevo ${cfg.label.toLowerCase()} ${form.tipo_operacion === "compra" ? "recibido" : "emitido"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">{form.tipo_operacion === "venta" ? "Cliente" : "Proveedor"}</Label>
              <select data-testid="select-contacto" value={form.contacto_id} onChange={(e) => onContacto(e.target.value)}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm">
                <option value="">{form.tipo_operacion === "venta" ? "— Nuevo cliente / escribir abajo —" : (form.contacto_nombre || "— Selecciona —")}</option>
                {contactosForm.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Serie</Label>
              <select data-testid="input-serie-doc" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm font-mono-plex">
                {seriesForm.length === 0 && <option value="">— sin serie —</option>}
                {seriesForm.map((s) => <option key={s.id || s.nombre} value={s.nombre}>{s.nombre}</option>)}
              </select>
            </div>
            {form.tipo_operacion === "venta" && (
              <>
                <div>
                  <Label className="text-xs">Nombre cliente</Label>
                  <Input data-testid="input-contacto-nombre" value={form.contacto_nombre}
                    onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value, contacto_id: "" })}
                    className="rounded-md mt-1" placeholder="Se dará de alta si es nuevo" />
                </div>
                <div>
                  <Label className="text-xs">NIF / CIF</Label>
                  <Input data-testid="input-contacto-nif" value={form.contacto_nif}
                    onChange={(e) => setForm({ ...form, contacto_nif: e.target.value })}
                    className="rounded-md mt-1 font-mono-plex" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" data-testid="input-fecha" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-md mt-1" />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm capitalize">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <LineasEditor lineas={form.lineas} setLineas={(l) => setForm({ ...form, lineas: l })} articulos={articulos} />
          <DialogFooter className="mt-2">
            <div className="mr-auto text-sm text-zinc-500">Total: <span className="font-semibold text-primary">{eur(totales.total)}</span></div>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-md">Cancelar</Button>
            <Button data-testid="guardar-documento-button" onClick={save} className="rounded-md bg-primary hover:bg-indigo-700">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} onExtracted={onExtracted}
        titulo={`Importar ${cfg.label.toLowerCase()} recibido con IA`} />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {cfg.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-eliminar-button" onClick={remove} className="rounded-md bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
