import { useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, Sparkle, FileText } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getDocumentos, createDocumento, updateDocumento, deleteDocumento, getContactos, getArticulos, eur,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
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
const estadoColor = (e) => ({
  borrador: "bg-slate-100 text-slate-600",
  confirmado: "bg-blue-50 text-blue-600",
  entregado: "bg-emerald-50 text-emerald-600",
  facturado: "bg-violet-50 text-violet-600",
}[e] || "bg-slate-100 text-slate-600");

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
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(emptyForm("compra"));
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const load = () => { setLoading(true); getDocumentos(entidad).then((d) => { setItems(d); setLoading(false); }); };
  useEffect(() => { load(); getContactos().then(setContactos); getArticulos().then(setArticulos); }, [entidad]);

  const visibles = items.filter((d) => d.tipo_operacion === tab);
  const esRecibido = tab === "compra";
  const contactosForm = contactos.filter((c) => (form.tipo_operacion === "venta" ? c.tipo === "cliente" : c.tipo === "proveedor"));

  const openNew = () => { setForm(emptyForm(tab)); setEditId(null); setOpen(true); };
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
      <PageHeader title={cfg.plural} subtitle={cfg.sub}>
        {esRecibido && (
          <Button data-testid="importar-ia-button" variant="outline" onClick={() => setImportOpen(true)} className="rounded-sm">
            <Sparkle size={16} className="mr-1 text-primary" /> Importar PDF (IA)
          </Button>
        )}
        <Button data-testid="nuevo-documento-button" onClick={openNew} className="rounded-sm bg-primary">
          <Plus size={16} className="mr-1" /> Nuevo {cfg.label.toLowerCase()}
        </Button>
      </PageHeader>

      <div className="inline-flex border border-slate-200 rounded-sm bg-white p-0.5 mb-4">
        {cfg.tabs.map((t) => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-sm transition-colors ${tab === t.key ? "bg-primary text-white font-medium" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Número</TableHead>
              <TableHead>{esRecibido ? "Proveedor" : "Cliente"}</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">Cargando...</TableCell></TableRow>}
            {!loading && visibles.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-16 text-center">
                <FileText size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">No hay {cfg.plural.toLowerCase()} {esRecibido ? "recibidos" : "emitidos"} todavía</p>
                {esRecibido && <Button variant="link" onClick={() => setImportOpen(true)} className="text-primary">Importar desde un PDF</Button>}
              </TableCell></TableRow>
            )}
            {visibles.map((d, i) => (
              <TableRow key={d.id} className="animate-row" style={{ animationDelay: `${i * 25}ms` }} data-testid={`documento-row-${d.id}`}>
                <TableCell className="font-mono-plex text-xs font-medium text-slate-800">{d.numero}</TableCell>
                <TableCell className="text-slate-700">{d.contacto_nombre || "—"}</TableCell>
                <TableCell className="text-slate-600">{d.fecha}</TableCell>
                <TableCell><span className={`text-xs px-2 py-1 rounded-sm capitalize ${estadoColor(d.estado)}`}>{d.estado}</span></TableCell>
                <TableCell className="text-right font-medium tabular-nums">{eur(d.total)}</TableCell>
                <TableCell className="text-right">
                  <button data-testid={`editar-${d.id}`} onClick={() => openEdit(d)} className="text-slate-400 hover:text-primary p-1.5"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-${d.id}`} onClick={() => setDelId(d.id)} className="text-slate-400 hover:text-red-500 p-1.5"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-sm max-h-[90vh] overflow-y-auto" data-testid="documento-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editId ? `Editar ${cfg.label.toLowerCase()}` : `Nuevo ${cfg.label.toLowerCase()} ${form.tipo_operacion === "compra" ? "recibido" : "emitido"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">{form.tipo_operacion === "venta" ? "Cliente" : "Proveedor"}</Label>
              <select data-testid="select-contacto" value={form.contacto_id} onChange={(e) => onContacto(e.target.value)}
                className="w-full h-10 mt-1 border border-input rounded-sm bg-white px-2 text-sm">
                <option value="">{form.tipo_operacion === "venta" ? "— Nuevo cliente / escribir abajo —" : (form.contacto_nombre || "— Selecciona —")}</option>
                {contactosForm.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {form.tipo_operacion === "venta" && (
              <>
                <div>
                  <Label className="text-xs">Serie</Label>
                  <Input data-testid="input-serie-doc" value={form.serie}
                    onChange={(e) => setForm({ ...form, serie: e.target.value.toUpperCase() })}
                    className="rounded-sm mt-1 font-mono-plex" placeholder="Ej. A (opcional)" />
                </div>
                <div>
                  <Label className="text-xs">Nombre cliente</Label>
                  <Input data-testid="input-contacto-nombre" value={form.contacto_nombre}
                    onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value, contacto_id: "" })}
                    className="rounded-sm mt-1" placeholder="Se dará de alta si es nuevo" />
                </div>
                <div>
                  <Label className="text-xs">NIF / CIF</Label>
                  <Input data-testid="input-contacto-nif" value={form.contacto_nif}
                    onChange={(e) => setForm({ ...form, contacto_nif: e.target.value })}
                    className="rounded-sm mt-1 font-mono-plex" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" data-testid="input-fecha" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="w-full h-10 mt-1 border border-input rounded-sm bg-white px-2 text-sm capitalize">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <LineasEditor lineas={form.lineas} setLineas={(l) => setForm({ ...form, lineas: l })} articulos={articulos} />
          <DialogFooter className="mt-2">
            <div className="mr-auto text-sm text-slate-500">Total: <span className="font-semibold text-primary">{eur(totales.total)}</span></div>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-documento-button" onClick={save} className="rounded-sm bg-primary">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} onExtracted={onExtracted}
        titulo={`Importar ${cfg.label.toLowerCase()} recibido con IA`} />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {cfg.label.toLowerCase()}?</AlertDialogTitle>
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
