import { useEffect, useState } from "react";
import { Plus, ArrowUUpLeft, Sparkle, FileArrowDown, Robot, Printer, CheckCircle, XCircle, FilePdf, Paperclip, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getFacturasRecibidas, createFacturaRecibida, rectificarFacturaRecibida, estadoFacturaRecibida,
  getContactos, getArticulos, getAjustes, getAlbaranesCompraPendientes, uploadArchivo, archivoUrl, eur,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const emptyForm = () => ({
  numero_proveedor: "", proveedor_id: "", proveedor_nombre: "", proveedor_nif: "",
  fecha: new Date().toISOString().slice(0, 10), estado: "pendiente", origen: "manual",
  forma_pago: "Transferencia", lineas: [], albaranes_ids: [], pdf_path: "", pdf_filename: "", notas: "",
});
const FORMA_PAGO = ["Transferencia", "Efectivo", "Tarjeta", "Domiciliación", "Recibo", "Confirming", "Otro"];

export default function FacturasRecibidas() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [empresa, setEmpresa] = useState({});
  const [albaranesPend, setAlbaranesPend] = useState([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [rectId, setRectId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [cotejo, setCotejo] = useState(true);

  const load = () => { setLoading(true); getFacturasRecibidas().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(() => {
    load();
    getContactos("proveedor").then(setProveedores);
    getArticulos().then(setArticulos);
    getAjustes().then((a) => setEmpresa(a.empresa || {}));
  }, []);

  const cargarAlbaranes = (prov) => {
    if (!prov?.nombre && !prov?.id) { setAlbaranesPend([]); return; }
    getAlbaranesCompraPendientes({ proveedor_id: prov?.id || "", proveedor_nombre: prov?.nombre || "" })
      .then(setAlbaranesPend).catch(() => setAlbaranesPend([]));
  };

  const openNew = () => { setForm(emptyForm()); setAlbaranesPend([]); setOpen(true); };
  const onProveedor = (id) => {
    const p = proveedores.find((x) => x.id === id);
    setForm({ ...form, proveedor_id: id, proveedor_nombre: p?.nombre || "", proveedor_nif: p?.nif || "", albaranes_ids: [] });
    cargarAlbaranes(p);
  };

  const toggleAlb = (albId) => {
    const has = form.albaranes_ids.includes(albId);
    setForm({ ...form, albaranes_ids: has ? form.albaranes_ids.filter((x) => x !== albId) : [...form.albaranes_ids, albId] });
  };

  const save = async () => {
    if (!form.proveedor_nombre) return toast.error("Indica el proveedor");
    if (form.lineas.length === 0) return toast.error("Añade al menos una línea");
    try {
      await createFacturaRecibida(form);
      toast.success("Factura recibida registrada");
      setOpen(false); load();
    } catch { toast.error("Error al guardar"); }
  };

  const toggleEstado = async (f) => {
    const nuevo = f.estado === "pagada" ? "pendiente" : "pagada";
    await estadoFacturaRecibida(f.id, nuevo);
    toast.success(nuevo === "pagada" ? "Marcada como pagada" : "Marcada como pendiente");
    load();
  };

  const rectificar = async () => {
    try {
      await rectificarFacturaRecibida(rectId);
      toast.success("Rectificativa (abono) registrada");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo rectificar");
    }
    setRectId(null); load();
  };

  const onExtracted = (datos) => {
    const prov = datos.proveedor_existente;
    setForm({
      numero_proveedor: datos.numero || "", proveedor_id: prov?.id || "",
      proveedor_nombre: prov?.nombre || datos.proveedor?.nombre || "",
      proveedor_nif: prov?.nif || datos.proveedor?.nif || "",
      fecha: datos.fecha || new Date().toISOString().slice(0, 10),
      estado: "pendiente", origen: "ai_pdf", forma_pago: "Transferencia",
      lineas: (datos.lineas || []).map((l) => ({
        descripcion: l.descripcion, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
        descuento: l.descuento || 0, tipo_iva: l.tipo_iva ?? 21,
      })),
      albaranes_ids: [], pdf_path: datos.pdf_path || "", pdf_filename: datos.pdf_filename || "", notas: "",
    });
    cargarAlbaranes(prov || { nombre: datos.proveedor?.nombre });
    setOpen(true);
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
  const sumaSel = albaranesPend.filter((a) => form.albaranes_ids.includes(a.id)).reduce((s, a) => s + Number(a.total || 0), 0);
  const coincide = Math.abs(sumaSel - totales.total) < 0.01;

  const printRecibida = (f) => imprimirDocumento({
    empresa, tipoLabel: f.tipo_factura === "rectificativa" ? "Factura recibida (rectif.)" : "Factura recibida", familia: "compra",
    numero: f.numero_proveedor || f.id.slice(0, 8), fecha: f.fecha,
    contactoLabel: "Proveedor", contacto: { nombre: f.proveedor_nombre, nif: f.proveedor_nif },
    lineas: f.lineas, base: f.base_total, iva: f.iva_total, total: f.total, forma_pago: f.forma_pago, notas: f.notas,
    footer: f.conciliacion ? `Conciliada con albaranes: ${f.conciliacion.albaranes.map((a) => a.numero).join(", ")} · ${f.conciliacion.coincide ? "COINCIDE ✓" : "NO COINCIDE ✗"}` : "",
  });

  const printList = () => imprimirListado({
    empresa, titulo: "Facturas Recibidas", familia: "compra",
    columnas: [{ label: "Nº Prov." }, { label: "Proveedor" }, { label: "Fecha" }, { label: "Estado" }, { label: "Total", align: "right" }],
    filas: items.map((f) => [f.numero_proveedor || "—", f.proveedor_nombre, f.fecha, f.estado, eur(f.total)]),
  });

  return (
    <div className="p-8 max-w-[1400px]" data-testid="facturas-recibidas-page">
      <PageHeader title="Facturas Recibidas" subtitle="Registra facturas de proveedores manualmente, desde un PDF o conciliando albaranes" chip={`${items.length} ${items.length === 1 ? "factura" : "facturas"}`}>
        <Button data-testid="imprimir-listado-button" variant="outline" onClick={printList} className="rounded-md">
          <Printer size={16} className="mr-1.5" /> Imprimir
        </Button>
        <Button data-testid="importar-ia-button" onClick={() => setImportOpen(true)} className="rounded-md bg-primary hover:bg-indigo-700">
          <Sparkle size={16} className="mr-1.5" weight="fill" /> Importar PDF con IA
        </Button>
        <Button data-testid="nueva-recibida-button" variant="outline" onClick={openNew} className="rounded-md">
          <Plus size={16} className="mr-1.5" /> Manual
        </Button>
      </PageHeader>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200 [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-zinc-500 [&>th]:font-semibold">
              <TableHead>Nº Proveedor</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Origen</TableHead>
              <TableHead className="text-center">Conciliación</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-zinc-400 py-10">Cargando...</TableCell></TableRow>}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-16 text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                  <FileArrowDown size={26} className="text-zinc-400" />
                </div>
                <p className="text-zinc-700 text-sm font-medium">No hay facturas recibidas</p>
                <p className="text-zinc-400 text-xs mt-0.5">Impórtalas automáticamente desde un PDF con IA.</p>
                <Button onClick={() => setImportOpen(true)} className="mt-4 rounded-md bg-primary hover:bg-indigo-700"><Sparkle size={15} weight="fill" className="mr-1.5" /> Importar desde un PDF</Button>
              </TableCell></TableRow>
            )}
            {items.map((f, i) => (
              <TableRow key={f.id} className="animate-row border-zinc-100 hover:bg-zinc-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`factura-recibida-row-${f.id}`}>
                <TableCell className="py-2.5 font-mono-plex text-xs text-zinc-800">
                  <div className="flex items-center gap-2">
                    {f.numero_proveedor || "—"}
                    {f.tipo_factura === "rectificativa" && <Pill tone="orange" className="text-[10px]">Rectificativa</Pill>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Initials name={f.proveedor_nombre} size={30} />
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 truncate">{f.proveedor_nombre}</div>
                      {f.proveedor_nif && <div className="text-xs text-zinc-400 font-mono-plex">{f.proveedor_nif}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-600 text-sm">{f.fecha}</TableCell>
                <TableCell className="text-center">
                  {f.origen === "ai_pdf" ? <Pill tone="indigo"><Robot size={12} /> IA</Pill>
                    : f.origen === "albaran" ? <Pill tone="info">Albarán</Pill>
                    : <Pill tone="neutral">Manual</Pill>}
                </TableCell>
                <TableCell className="text-center">
                  {f.conciliacion
                    ? (f.conciliacion.coincide
                        ? <Pill tone="success"><CheckCircle size={12} weight="fill" /> Coincide</Pill>
                        : <Pill tone="danger"><XCircle size={12} weight="fill" /> Revisar</Pill>)
                    : <span className="text-zinc-300 text-xs">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-zinc-900">{eur(f.total)}</TableCell>
                <TableCell className="text-center">
                  {f.estado === "rectificada" ? (
                    <Pill tone="orange">Rectificada</Pill>
                  ) : (
                    <button data-testid={`toggle-estado-${f.id}`} onClick={() => toggleEstado(f)}>
                      <Pill tone={f.estado === "pagada" ? "success" : "warning"} className="cursor-pointer hover:opacity-80 transition-opacity">
                        {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                      </Pill>
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {f.pdf_path && (
                    <button data-testid={`preview-${f.id}`} onClick={() => setPreview({ path: f.pdf_path, filename: f.pdf_filename })} title="Vista previa del original" className="text-zinc-400 hover:text-rose-500 p-1.5 transition-colors"><FilePdf size={16} weight="fill" /></button>
                  )}
                  <button data-testid={`imprimir-${f.id}`} onClick={() => printRecibida(f)} title="Imprimir" className="text-zinc-400 hover:text-primary p-1.5 transition-colors"><Printer size={16} /></button>
                  {f.tipo_factura !== "rectificativa" && f.estado !== "rectificada" && (
                    <button data-testid={`rectificar-${f.id}`} onClick={() => setRectId(f.id)} title="Registrar rectificativa (abono)" className="text-zinc-400 hover:text-orange-500 p-1.5 transition-colors"><ArrowUUpLeft size={16} /></button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ImportPdfDialog open={importOpen} onOpenChange={setImportOpen} onExtracted={onExtracted}
        titulo="Importar factura de proveedor con IA" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${form.pdf_path && cotejo ? "sm:max-w-6xl" : "sm:max-w-3xl"} rounded-lg max-h-[90vh] overflow-y-auto`} data-testid="recibida-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight flex items-center gap-2">
              {form.origen === "ai_pdf" && <Sparkle size={18} weight="fill" className="text-primary" />}
              {form.origen === "ai_pdf" ? "Revisar factura extraída por IA" : "Nueva factura recibida"}
              {form.pdf_path && (
                <button type="button" data-testid="toggle-cotejo" onClick={() => setCotejo((v) => !v)}
                  className="ml-auto mr-6 text-xs font-normal text-primary hover:underline inline-flex items-center gap-1">
                  <FilePdf size={14} weight="fill" className="text-rose-500" /> {cotejo ? "Ocultar original" : "Cotejar con original"}
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className={form.pdf_path && cotejo ? "grid grid-cols-[1fr_1.15fr] gap-5 items-start" : ""}>
            {form.pdf_path && cotejo && (
              <div className="sticky top-0" data-testid="cotejo-panel">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Documento original</div>
                <iframe title="Original" src={archivoUrl(form.pdf_path)} className="w-full h-[74vh] rounded-md border border-zinc-200 bg-zinc-50" data-testid="cotejo-frame" />
              </div>
            )}
            <div className="min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Proveedor (de tu base)</Label>
              <select data-testid="select-proveedor" value={form.proveedor_id} onChange={(e) => onProveedor(e.target.value)}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm">
                <option value="">{form.proveedor_nombre || "— Selecciona —"}</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Nombre proveedor</Label>
              <Input data-testid="input-proveedor-nombre" value={form.proveedor_nombre} onChange={(e) => setForm({ ...form, proveedor_nombre: e.target.value })} className="rounded-md mt-1" />
            </div>
            <div>
              <Label className="text-xs">NIF/CIF</Label>
              <Input value={form.proveedor_nif} onChange={(e) => setForm({ ...form, proveedor_nif: e.target.value })} className="rounded-md mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Nº factura proveedor</Label>
              <Input data-testid="input-numero-proveedor" value={form.numero_proveedor} onChange={(e) => setForm({ ...form, numero_proveedor: e.target.value })} className="rounded-md mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-md mt-1" />
            </div>
            <div>
              <Label className="text-xs">Forma de pago</Label>
              <select data-testid="select-forma-pago" value={form.forma_pago} onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
                className="w-full h-10 mt-1 border border-input rounded-md bg-white px-2 text-sm">
                {FORMA_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

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

          {form.proveedor_nombre && albaranesPend.length > 0 && (
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50" data-testid="conciliacion-albaranes">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Conciliar con albaranes de compra pendientes</div>
                {form.albaranes_ids.length > 0 && (
                  coincide
                    ? <Pill tone="success"><CheckCircle size={12} weight="fill" /> Coincide</Pill>
                    : <Pill tone="danger"><XCircle size={12} weight="fill" /> No coincide</Pill>
                )}
              </div>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {albaranesPend.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-white cursor-pointer">
                    <Checkbox data-testid={`alb-check-${a.id}`} checked={form.albaranes_ids.includes(a.id)} onCheckedChange={() => toggleAlb(a.id)} />
                    <span className="font-mono-plex text-xs text-zinc-700">{a.numero}</span>
                    <span className="text-zinc-400 text-xs">{a.fecha}</span>
                    <span className="ml-auto tabular-nums text-zinc-800">{eur(a.total)}</span>
                  </label>
                ))}
              </div>
              {form.albaranes_ids.length > 0 && (
                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-zinc-200">
                  <span className="text-zinc-500">Suma albaranes: <b className="text-zinc-800">{eur(sumaSel)}</b></span>
                  <span className="text-zinc-500">Total factura: <b className="text-zinc-800">{eur(totales.total)}</b></span>
                </div>
              )}
            </div>
          )}

          <LineasEditor lineas={form.lineas} setLineas={(l) => setForm({ ...form, lineas: l })} articulos={articulos} />
          <DialogFooter className="mt-2">
            <div className="mr-auto text-sm text-zinc-500">Total: <span className="font-semibold text-primary">{eur(totales.total)}</span></div>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-md">Cancelar</Button>
            <Button data-testid="guardar-recibida-button" onClick={save} className="rounded-md bg-primary hover:bg-indigo-700">Registrar</Button>
          </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rectId} onOpenChange={(o) => !o && setRectId(null)}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar factura rectificativa</AlertDialogTitle>
            <AlertDialogDescription>
              Según Verifactu, las facturas no se eliminan. Se registrará una <b>rectificativa (abono)</b> que anula los importes de la original y la marca como rectificada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-rectificar-button" onClick={rectificar} className="rounded-md bg-orange-500 hover:bg-orange-600">Registrar rectificativa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PdfPreview open={!!preview} onOpenChange={(o) => !o && setPreview(null)} path={preview?.path} filename={preview?.filename} />
    </div>
  );
}
