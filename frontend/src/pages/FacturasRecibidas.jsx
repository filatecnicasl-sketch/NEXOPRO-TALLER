import { useEffect, useState } from "react";
import { Plus, ArrowUUpLeft, Sparkle, FileArrowDown, Robot } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getFacturasRecibidas, createFacturaRecibida, rectificarFacturaRecibida, estadoFacturaRecibida, getContactos, getArticulos, getConsumoIA, eur,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import LineasEditor, { calcTotales } from "@/components/LineasEditor";
import ImportPdfDialog from "@/components/ImportPdfDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
      <PageHeader title="Facturas Recibidas" subtitle="Registra facturas de proveedores manualmente o automáticamente desde un PDF">
        <Button data-testid="importar-ia-button" onClick={() => setImportOpen(true)} className="rounded-sm bg-primary">
          <Sparkle size={16} className="mr-1" weight="fill" /> Importar PDF con IA
        </Button>
        <Button data-testid="nueva-recibida-button" variant="outline" onClick={openNew} className="rounded-sm">
          <Plus size={16} className="mr-1" /> Manual
        </Button>
      </PageHeader>

      {consumoIA && consumoIA.num_lecturas > 0 && (
        <div className="mb-4 bg-white border border-slate-200 rounded-sm px-4 py-3 flex items-center gap-6 text-sm" data-testid="consumo-ia-resumen">
          <div className="flex items-center gap-2 text-slate-500">
            <Robot size={16} className="text-primary" />
            <span className="text-[11px] uppercase tracking-widest">Consumo IA acumulado</span>
          </div>
          <div><span className="text-slate-400">Lecturas</span> <span className="font-medium ml-1">{consumoIA.num_lecturas}</span></div>
          <div><span className="text-slate-400">Tokens</span> <span className="font-medium ml-1 font-mono-plex">{consumoIA.total_tokens.toLocaleString("es-ES")}</span></div>
          <div><span className="text-slate-400">Coste estimado</span> <span className="font-semibold text-primary ml-1">{eur(consumoIA.coste_total_eur)}</span></div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Nº Proveedor</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">Cargando...</TableCell></TableRow>}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-16 text-center">
                <FileArrowDown size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">No hay facturas recibidas</p>
                <Button variant="link" onClick={() => setImportOpen(true)} className="text-primary">Importar la primera desde un PDF</Button>
              </TableCell></TableRow>
            )}
            {items.map((f, i) => (
              <TableRow key={f.id} className="animate-row" style={{ animationDelay: `${i * 25}ms` }} data-testid={`factura-recibida-row-${f.id}`}>
                <TableCell className="font-mono-plex text-xs text-slate-800">
                  {f.numero_proveedor || "—"}
                  {f.tipo_factura === "rectificativa" && <Badge className="ml-2 rounded-sm bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px]">Rectificativa</Badge>}
                </TableCell>
                <TableCell className="text-slate-700">{f.proveedor_nombre}</TableCell>
                <TableCell className="text-slate-600">{f.fecha}</TableCell>
                <TableCell>
                  {f.origen === "ai_pdf"
                    ? <Badge className="rounded-sm bg-accent text-primary hover:bg-accent gap-1"><Robot size={12} /> IA</Badge>
                    : <Badge variant="outline" className="rounded-sm font-normal">Manual</Badge>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{eur(f.base_total)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{eur(f.total)}</TableCell>
                <TableCell>
                  {f.estado === "rectificada" ? (
                    <span className="text-xs px-2 py-1 rounded-sm bg-orange-50 text-orange-600">Rectificada</span>
                  ) : (
                    <button data-testid={`toggle-estado-${f.id}`} onClick={() => toggleEstado(f)}
                      className={`text-xs px-2 py-1 rounded-sm ${f.estado === "pagada" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {f.tipo_factura !== "rectificativa" && f.estado !== "rectificada" && (
                    <button data-testid={`rectificar-${f.id}`} onClick={() => setRectId(f.id)} title="Registrar rectificativa (abono)" className="text-slate-400 hover:text-orange-500 p-1.5"><ArrowUUpLeft size={16} /></button>
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
        <DialogContent className="sm:max-w-3xl rounded-sm max-h-[90vh] overflow-y-auto" data-testid="recibida-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              {form.origen === "ai_pdf" && <Sparkle size={18} weight="fill" className="text-primary" />}
              {form.origen === "ai_pdf" ? "Revisar factura extraída por IA" : "Nueva factura recibida"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Proveedor (de tu base)</Label>
              <select data-testid="select-proveedor" value={form.proveedor_id} onChange={(e) => onProveedor(e.target.value)}
                className="w-full h-10 mt-1 border border-input rounded-sm bg-white px-2 text-sm">
                <option value="">{form.proveedor_nombre || "— Selecciona —"}</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Nombre proveedor</Label>
              <Input data-testid="input-proveedor-nombre" value={form.proveedor_nombre} onChange={(e) => setForm({ ...form, proveedor_nombre: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">NIF/CIF</Label>
              <Input value={form.proveedor_nif} onChange={(e) => setForm({ ...form, proveedor_nif: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Nº factura proveedor</Label>
              <Input data-testid="input-numero-proveedor" value={form.numero_proveedor} onChange={(e) => setForm({ ...form, numero_proveedor: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Forma de pago</Label>
              <select data-testid="select-forma-pago" value={form.forma_pago} onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
                className="w-full h-10 mt-1 border border-input rounded-sm bg-white px-2 text-sm">
                {FORMA_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <LineasEditor lineas={form.lineas} setLineas={(l) => setForm({ ...form, lineas: l })} articulos={articulos} />
          <DialogFooter className="mt-2">
            <div className="mr-auto text-sm text-slate-500">Total: <span className="font-semibold text-primary">{eur(totales.total)}</span></div>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancelar</Button>
            <Button data-testid="guardar-recibida-button" onClick={save} className="rounded-sm bg-primary">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rectId} onOpenChange={(o) => !o && setRectId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar factura rectificativa</AlertDialogTitle>
            <AlertDialogDescription>
              Según Verifactu, las facturas no se eliminan. Se registrará una <b>rectificativa (abono)</b> que anula los importes de la original y la marca como rectificada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-rectificar-button" onClick={rectificar} className="rounded-sm bg-orange-500 hover:bg-orange-600">Registrar rectificativa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
