import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, PencilSimple, Trash, Sparkle, FileText, FileDashed, ClipboardText,
  Printer, ArrowBendDownRight, CaretDown, CheckCircle, FilePdf, Paperclip, Eye,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getDocumentos, createDocumento, updateDocumento, deleteDocumento, convertirDocumento,
  getContactos, getArticulos, getAjustes, uploadArchivo, getVehiculos, eur,
} from "@/lib/api";
import { imprimirDocumento, imprimirListado } from "@/lib/print";
import PdfPreview from "@/components/PdfPreview";
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CFG = {
  presupuestos: { label: "Presupuesto", plural: "Presupuestos", icon: FileDashed,
    venta: { sub: "Presupuestos y ofertas enviados a clientes" } },
  pedidos: { label: "Pedido", plural: "Pedidos", icon: ClipboardText,
    venta: { sub: "Pedidos de tus clientes" }, compra: { sub: "Pedidos que haces a proveedores" } },
  albaranes: { label: "Albarán", plural: "Albaranes", icon: FileText,
    venta: { sub: "Albaranes de salida (entregas a clientes)" }, compra: { sub: "Albaranes recibidos de proveedores" } },
};

// destinos de conversión permitidos por tipo de documento
const CONV = {
  presupuestos: [{ d: "pedidos", label: "Pedido" }, { d: "albaranes", label: "Albarán" }],
  pedidos: [{ d: "albaranes", label: "Albarán" }],
  albaranes: [{ d: "factura", label: "Factura" }],
};

const ESTADOS = ["borrador", "confirmado", "entregado", "facturado"];
const estadoTone = (e) => ({
  borrador: "neutral", confirmado: "info", entregado: "success", facturado: "violet",
}[e] || "neutral");

const emptyForm = (op) => ({
  tipo_operacion: op, serie: "", contacto_id: "", contacto_nombre: "", contacto_nif: "",
  fecha: new Date().toISOString().slice(0, 10), estado: "borrador", lineas: [], pdf_path: "", pdf_filename: "", vehiculo_id: "", vehiculo_matricula: "", notas: "",
});

export default function Documentos({ entidad, operacion }) {
  const cfg = CFG[entidad];
  const esCompra = operacion === "compra";
  const permiteVehiculo = esCompra || entidad === "presupuestos";
  const [searchParams] = useSearchParams();
  const permiteIA = esCompra && entidad !== "presupuestos";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactos, setContactos] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [series, setSeries] = useState([]);
  const [empresa, setEmpresa] = useState({});
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(emptyForm(operacion));
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [vehiculos, setVehiculos] = useState([]);

  const load = () => { setLoading(true); getDocumentos(entidad).then((d) => { setItems(d); setLoading(false); }); };
  useEffect(() => {
    load();
    getContactos(esCompra ? "proveedor" : "cliente").then(setContactos);
    getArticulos().then(setArticulos);
    getAjustes().then((a) => { setSeries((esCompra ? a.series_compra : a.series_venta) || []); setEmpresa(a.empresa || {}); });
    if (esCompra) getVehiculos().then(setVehiculos);
  }, [entidad, operacion]);

  const visibles = items.filter((d) => d.tipo_operacion === operacion);
  const defSerie = () => (series.find((s) => s.por_defecto) || series[0])?.nombre || "";

  const openNew = () => { setForm({ ...emptyForm(operacion), serie: defSerie() }); setEditId(null); setOpen(true); };
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
      setOpen(false); load(); getContactos(esCompra ? "proveedor" : "cliente").then(setContactos);
    } catch { toast.error("Error al guardar"); }
  };

  const remove = async () => { await deleteDocumento(entidad, delId); setDelId(null); toast.success("Eliminado"); load(); };

  const convertir = async (d, destino) => {
    try {
      const res = await convertirDocumento(entidad, d.id, destino);
      if (destino === "factura") {
        toast.success(res.tipo === "emitida" ? `Factura ${res.numero_completo} emitida` : "Factura recibida generada");
      } else {
        const lbl = destino === "pedidos" ? "Pedido" : "Albarán";
        toast.success(`${lbl} ${res.numero} creado`);
      }
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo convertir"); }
  };

  const printDoc = (d) => imprimirDocumento({
    empresa, tipoLabel: cfg.label, familia: operacion, numero: d.numero, fecha: d.fecha, serie: d.serie,
    contactoLabel: esCompra ? "Proveedor" : "Cliente",
    contacto: { nombre: d.contacto_nombre, nif: d.contacto_nif },
    lineas: d.lineas, base: d.base_total, iva: d.iva_total, total: d.total, notas: d.notas,
  });

  const printList = () => imprimirListado({
    empresa, titulo: cfg.plural, familia: operacion,
    columnas: [
      { label: "Número" }, { label: esCompra ? "Proveedor" : "Cliente" }, { label: "Fecha" },
      { label: "Estado" }, { label: "Total", align: "right" },
    ],
    filas: visibles.map((d) => [d.numero, d.contacto_nombre || "—", d.fecha, d.estado, eur(d.total)]),
  });

  const onExtracted = (datos) => {
    const prov = datos.proveedor_existente;
    setForm({
      tipo_operacion: "compra", serie: defSerie(),
      contacto_id: prov?.id || "", contacto_nombre: prov?.nombre || datos.proveedor?.nombre || "",
      contacto_nif: prov?.nif || datos.proveedor?.nif || "",
      fecha: datos.fecha || new Date().toISOString().slice(0, 10), estado: "confirmado",
      lineas: (datos.lineas || []).map((l) => ({
        descripcion: l.descripcion, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
        descuento: l.descuento || 0, tipo_iva: l.tipo_iva ?? 21,
      })),
      notas: `Importado por IA. Nº origen: ${datos.numero || "—"}`,
      pdf_path: datos.pdf_path || "", pdf_filename: datos.pdf_filename || "",
    });
    setEditId(null); setOpen(true);
  };

  const adjuntarPdf = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return toast.error("Solo se admiten archivos PDF");
    setSubiendo(true);
    try {
      const res = await uploadArchivo(file);
      setForm((f) => ({ ...f, pdf_path: res.pdf_path, pdf_filename: res.pdf_filename }));
      toast.success("PDF adjuntado");
    } catch { toast.error("No se pudo subir el PDF"); }
    finally { setSubiendo(false); }
  };

  const totales = calcTotales(form.lineas);
  const Icon = cfg.icon;
  const contactoLabel = esCompra ? "Proveedor" : "Cliente";

  return (
    <div className="p-8 max-w-[1400px]" data-testid={`${entidad}-${operacion}-page`}>
      <PageHeader title={cfg.plural} subtitle={cfg[operacion]?.sub} chip={`${visibles.length} ${esCompra ? "de compra" : "de venta"}`}>
        <Button data-testid="imprimir-listado-button" variant="outline" onClick={printList} className="rounded-md">
          <Printer size={16} className="mr-1.5" /> Imprimir
        </Button>
        {permiteIA && (
          <Button data-testid="importar-ia-button" variant="outline" onClick={() => setImportOpen(true)} className="rounded-md">
            <Sparkle size={16} className="mr-1.5 text-primary" /> Importar PDF (IA)
          </Button>
        )}
        <Button data-testid="nuevo-documento-button" onClick={openNew} className="rounded-md bg-primary hover:bg-indigo-700">
          <Plus size={16} className="mr-1.5" /> Nuevo {cfg.label.toLowerCase()}
        </Button>
      </PageHeader>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200 [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-zinc-500 [&>th]:font-semibold">
              <TableHead>Número</TableHead>
              <TableHead>{contactoLabel}</TableHead>
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
                  <Icon size={26} className="text-zinc-400" />
                </div>
                <p className="text-zinc-700 text-sm font-medium">No hay {cfg.plural.toLowerCase()} todavía</p>
                {permiteIA && <Button variant="link" onClick={() => setImportOpen(true)} className="text-primary mt-1">Importar desde un PDF</Button>}
              </TableCell></TableRow>
            )}
            {visibles.map((d, i) => {
              const facturado = d.estado === "facturado" || !!d.factura_numero;
              const convertido = !!d.convertido_a;
              return (
              <TableRow key={d.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`documento-row-${d.id}`}>
                <TableCell className="py-2.5 font-mono-plex text-xs font-medium text-zinc-800">
                  <div className="flex items-center gap-2">{d.numero}
                    {d.origen_numero && <ArrowBendDownRight size={12} className="text-zinc-300" />}
                  </div>
                  {d.origen_numero && <div className="text-[10px] text-zinc-400 mt-0.5">de {d.origen_numero}</div>}
                </TableCell>
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
                <TableCell className="text-center">
                  {facturado
                    ? <Pill tone="violet"><CheckCircle size={12} weight="fill" /> Facturado</Pill>
                    : <Pill tone={estadoTone(d.estado)} className="capitalize">{d.estado}</Pill>}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-zinc-900">{eur(d.total)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {!facturado && CONV[entidad] && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button data-testid={`convertir-${d.id}`} title="Convertir" className="inline-flex items-center gap-0.5 text-primary hover:text-indigo-700 text-xs font-medium px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                          <ArrowBendDownRight size={15} /> Convertir <CaretDown size={11} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {CONV[entidad].map((c) => (
                          <DropdownMenuItem key={c.d} data-testid={`convertir-${d.id}-${c.d}`} onClick={() => convertir(d, c.d)}>
                            <ArrowBendDownRight size={14} className="mr-2 text-zinc-400" /> Pasar a {c.d === "factura" ? (esCompra ? "factura recibida" : "factura") : c.label.toLowerCase()}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <button data-testid={`imprimir-${d.id}`} onClick={() => printDoc(d)} title="Imprimir" className="text-zinc-400 hover:text-primary p-1.5 transition-colors"><Printer size={16} /></button>
                  {d.pdf_path && (
                    <button data-testid={`preview-${d.id}`} onClick={() => setPreview({ path: d.pdf_path, filename: d.pdf_filename })} title="Vista previa del original" className="text-zinc-400 hover:text-rose-500 p-1.5 transition-colors"><FilePdf size={16} weight="fill" /></button>
                  )}
                  <button data-testid={`editar-${d.id}`} onClick={() => openEdit(d)} title="Editar" className="text-zinc-400 hover:text-primary p-1.5 transition-colors"><PencilSimple size={16} /></button>
                  <button data-testid={`eliminar-${d.id}`} onClick={() => setDelId(d.id)} title="Eliminar" className="text-zinc-400 hover:text-red-500 p-1.5 transition-colors"><Trash size={16} /></button>
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-lg max-h-[90vh] overflow-y-auto" data-testid="documento-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">
              {editId ? `Editar ${cfg.label.toLowerCase()}` : `Nuevo ${cfg.label.toLowerCase()} ${esCompra ? "de compra" : "de venta"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">{contactoLabel}</Label>
              <select data-testid="select-contacto" value={form.contacto_id} onChange={(e) => onContacto(e.target.value)}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm">
                <option value="">{esCompra ? (form.contacto_nombre || "— Selecciona —") : "— Nuevo cliente / escribir abajo —"}</option>
                {contactos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Serie</Label>
              <select data-testid="input-serie-doc" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm font-mono-plex">
                {series.length === 0 && <option value="">— sin serie —</option>}
                {series.map((s) => <option key={s.id || s.nombre} value={s.nombre}>{s.nombre}</option>)}
              </select>
            </div>
            {!esCompra && (
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
            {permiteVehiculo && (
              <div>
                <Label className="text-xs">{esCompra ? "Vehículo (imputar coste)" : "Vehículo"}</Label>
                <select data-testid="doc-vehiculo" value={form.vehiculo_id}
                  onChange={(e) => { const v = vehiculos.find((x) => x.id === e.target.value); setForm({ ...form, vehiculo_id: e.target.value, vehiculo_matricula: v?.matricula || "" }); }}
                  className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm">
                  <option value="">— Sin imputar —</option>
                  {vehiculos.map((v) => <option key={v.id} value={v.id}>{`${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}`}</option>)}
                </select>
              </div>
            )}
          </div>
          {esCompra && (
            <div className="flex items-center gap-3 flex-wrap" data-testid="adjuntar-pdf">
              <label className={`inline-flex items-center gap-2 text-sm cursor-pointer border border-zinc-200 rounded-md px-3 py-1.5 hover:bg-zinc-50 transition-colors ${subiendo ? "opacity-60 pointer-events-none" : ""}`}>
                <Paperclip size={15} /> {subiendo ? "Subiendo..." : (form.pdf_path ? "Cambiar PDF original" : "Adjuntar PDF original")}
                <input type="file" accept="application/pdf" className="hidden" data-testid="input-adjuntar-pdf" onChange={(e) => adjuntarPdf(e.target.files[0])} />
              </label>
              {form.pdf_path && (
                <>
                  <span className="text-xs text-zinc-500 inline-flex items-center gap-1"><FilePdf size={14} weight="fill" className="text-rose-500" /> {form.pdf_filename || "documento.pdf"}</span>
                  <button type="button" data-testid="preview-form-pdf" onClick={() => setPreview({ path: form.pdf_path, filename: form.pdf_filename })} className="text-xs text-primary hover:underline inline-flex items-center gap-1"><Eye size={13} /> Vista previa</button>
                </>
              )}
            </div>
          )}
          <LineasEditor lineas={form.lineas} setLineas={(l) => setForm({ ...form, lineas: l })} articulos={articulos} />
          <DialogFooter className="mt-2">
            <div className="mr-auto text-sm text-zinc-500">Total: <span className="font-semibold text-primary">{eur(totales.total)}</span></div>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-md">Cancelar</Button>
            <Button data-testid="guardar-documento-button" onClick={save} className="rounded-md bg-primary hover:bg-indigo-700">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {permiteIA && (
        <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} onExtracted={onExtracted}
          titulo={`Importar ${cfg.label.toLowerCase()} recibido con IA`} />
      )}

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
      <PdfPreview open={!!preview} onOpenChange={(o) => !o && setPreview(null)} path={preview?.path} filename={preview?.filename} />
    </div>
  );
}
