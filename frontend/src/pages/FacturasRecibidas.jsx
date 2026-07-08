import { useEffect, useState } from "react";
import { Plus, ArrowUUpLeft, Sparkle, FileArrowDown, Robot } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getFacturasRecibidas, createFacturaRecibida, rectificarFacturaRecibida, estadoFacturaRecibida, getContactos, getArticulos, getConsumoIA, eur, eurCoste,
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

const emptyForm = () => ({
  numero_proveedor: "", proveedor_id: "", proveedor_nombre: "", proveedor_nif: "",
  fecha: new Date().toISOString().slice(0, 10), estado: "pendiente", origen: "manual", forma_pago: "Transferencia", lineas: [], notas: "",
});
const FORMA_PAGO = ["Transferencia", "Efectivo", "Tarjeta", "Domiciliación", "Recibo", "Confirming", "Otro"];

export default function FacturasRecibidas() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [rectId, setRectId] = useState(null);
  const [consumoIA, setConsumoIA] = useState(null);

  const load = () => { setLoading(true); getFacturasRecibidas().then((d) => { setItems(d); setLoading(false); }); getConsumoIA().then(setConsumoIA).catch(() => {}); };
  useEffect(() => { load(); getContactos("proveedor").then(setProveedores); getArticulos().then(setArticulos); }, []);

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const onProveedor = (id) => {
    const p = proveedores.find((x) => x.id === id);
    setForm({ ...form, proveedor_id: id, proveedor_nombre: p?.nombre || "", proveedor_nif: p?.nif || "" });
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
      numero_proveedor: datos.numero || "",
      proveedor_id: prov?.id || "",
      proveedor_nombre: prov?.nombre || datos.proveedor?.nombre || "",
      proveedor_nif: prov?.nif || datos.proveedor?.nif || "",
      fecha: datos.fecha || new Date().toISOString().slice(0, 10),
      estado: "pendiente",
      origen: "ai_pdf",
      forma_pago: "Transferencia",
      lineas: (datos.lineas || []).map((l) => ({
        descripcion: l.descripcion, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
        descuento: l.descuento || 0, tipo_iva: l.tipo_iva ?? 21,
      })),
      notas: "",
    });
    setOpen(true);
  };

  const totales = calcTotales(form.lineas);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="facturas-recibidas-page">
      <PageHeader title="Facturas Recibidas" subtitle="Registra facturas de proveedores manualmente o automáticamente desde un PDF" chip={`${items.length} ${items.length === 1 ? "factura" : "facturas"}`}>
        <Button data-testid="importar-ia-button" onClick={() => setImportOpen(true)} className="rounded-md bg-primary hover:bg-indigo-700">
          <Sparkle size={16} className="mr-1.5" weight="fill" /> Importar PDF con IA
        </Button>
        <Button data-testid="nueva-recibida-button" variant="outline" onClick={openNew} className="rounded-md">
          <Plus size={16} className="mr-1.5" /> Manual
        </Button>
      </PageHeader>

      {consumoIA && consumoIA.num_lecturas > 0 && (
        <div className="mb-4 bg-white border border-zinc-200 rounded-lg shadow-sm px-4 py-3 flex flex-wrap items-center gap-6 text-sm" data-testid="consumo-ia-resumen">
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><Robot size={15} /></span>
            <span className="text-[11px] uppercase tracking-widest">Consumo IA acumulado</span>
          </div>
          <div><span className="text-zinc-400">Lecturas</span> <span className="font-medium ml-1 text-zinc-800">{consumoIA.num_lecturas}</span></div>
          <div><span className="text-zinc-400">Tokens</span> <span className="font-medium ml-1 font-mono-plex text-zinc-800">{consumoIA.total_tokens.toLocaleString("es-ES")}</span></div>
          <div><span className="text-zinc-400">Coste estimado</span> <span className="font-semibold text-primary ml-1">{eurCoste(consumoIA.coste_total_eur)}</span></div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200 [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-zinc-500 [&>th]:font-semibold">
              <TableHead>Nº Proveedor</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Origen</TableHead>
              <TableHead className="text-right">Base</TableHead>
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
                  {f.origen === "ai_pdf"
                    ? <Pill tone="indigo"><Robot size={12} /> IA</Pill>
                    : <Pill tone="neutral">Manual</Pill>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-zinc-600">{eur(f.base_total)}</TableCell>
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
        <DialogContent className="sm:max-w-3xl rounded-lg max-h-[90vh] overflow-y-auto" data-testid="recibida-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight flex items-center gap-2">
              {form.origen === "ai_pdf" && <Sparkle size={18} weight="fill" className="text-primary" />}
              {form.origen === "ai_pdf" ? "Revisar factura extraída por IA" : "Nueva factura recibida"}
            </DialogTitle>
          </DialogHeader>
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
          <LineasEditor lineas={form.lineas} setLineas={(l) => setForm({ ...form, lineas: l })} articulos={articulos} />
          <DialogFooter className="mt-2">
            <div className="mr-auto text-sm text-zinc-500">Total: <span className="font-semibold text-primary">{eur(totales.total)}</span></div>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-md">Cancelar</Button>
            <Button data-testid="guardar-recibida-button" onClick={save} className="rounded-md bg-primary hover:bg-indigo-700">Registrar</Button>
          </DialogFooter>
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
    </div>
  );
}
