import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Plus, ArrowUUpLeft, Eye, Receipt, ShieldCheck, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getFacturasEmitidas, createFacturaEmitida, rectificarFacturaEmitida, estadoFacturaEmitida, getContactos, getArticulos, eur,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import LineasEditor, { calcTotales } from "@/components/LineasEditor";
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

const FORMA_PAGO = ["Transferencia", "Efectivo", "Tarjeta", "Domiciliación", "Recibo", "Confirming", "Otro"];

const emptyForm = () => ({
  serie: "A", cliente_id: "", cliente_nombre: "", cliente_nif: "",
  fecha_expedicion: new Date().toISOString().slice(0, 10), estado: "emitida", forma_pago: "Transferencia", lineas: [], notas: "",
});

export default function FacturasEmitidas() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [detalle, setDetalle] = useState(null);
  const [rectId, setRectId] = useState(null);

  const load = () => { setLoading(true); getFacturasEmitidas().then((d) => { setItems(d); setLoading(false); }); };
  useEffect(() => { load(); getContactos("cliente").then(setClientes); getArticulos().then(setArticulos); }, []);

  const openNew = () => { setForm(emptyForm()); setOpen(true); };
  const onCliente = (id) => {
    const c = clientes.find((x) => x.id === id);
    setForm({ ...form, cliente_id: id, cliente_nombre: c?.nombre || "", cliente_nif: c?.nif || "" });
  };

  const save = async () => {
    if (!form.cliente_nombre) return toast.error("Selecciona un cliente");
    if (form.lineas.length === 0) return toast.error("Añade al menos una línea");
    try {
      await createFacturaEmitida(form);
      toast.success("Factura emitida y registrada en Verifactu");
      setOpen(false); load(); getContactos("cliente").then(setClientes);
    } catch { toast.error("Error al emitir la factura"); }
  };

  const toggleEstado = async (f) => {
    const nuevo = f.estado === "cobrada" ? "emitida" : "cobrada";
    await estadoFacturaEmitida(f.id, nuevo);
    toast.success(nuevo === "cobrada" ? "Marcada como cobrada" : "Marcada como pendiente");
    load();
  };

  const rectificar = async () => {
    try {
      await rectificarFacturaEmitida(rectId);
      toast.success("Factura rectificativa (abono) emitida");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo rectificar");
    }
    setRectId(null); load();
  };
  const totales = calcTotales(form.lineas);

  return (
    <div className="p-8 max-w-[1400px]" data-testid="facturas-emitidas-page">
      <PageHeader title="Facturas Emitidas" subtitle="Facturas de venta con registro compatible Verifactu">
        <Button data-testid="nueva-factura-button" onClick={openNew} className="rounded-sm bg-primary">
          <Plus size={16} className="mr-1" /> Nueva factura
        </Button>
      </PageHeader>

      <div className="bg-white border border-slate-200 rounded-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Verifactu</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center text-slate-400 py-8">Cargando...</TableCell></TableRow>}
            {!loading && items.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-16 text-center">
                <Receipt size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">Aún no has emitido facturas</p>
              </TableCell></TableRow>
            )}
            {items.map((f, i) => (
              <TableRow key={f.id} className="animate-row" style={{ animationDelay: `${i * 25}ms` }} data-testid={`factura-emitida-row-${f.id}`}>
                <TableCell className="font-mono-plex text-xs font-medium text-slate-800">
                  {f.numero_completo}
                  {f.tipo_factura === "rectificativa" && <Badge className="ml-2 rounded-sm bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px]">Rectificativa</Badge>}
                  {f.rectifica_a && <div className="text-[10px] text-slate-400">rectifica {f.rectifica_a}</div>}
                </TableCell>
                <TableCell className="text-slate-700">{f.cliente_nombre}</TableCell>
                <TableCell className="text-slate-600">{f.fecha_expedicion}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(f.base_total)}</TableCell>
                <TableCell className="text-right tabular-nums text-slate-500">{eur(f.iva_total)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{eur(f.total)}</TableCell>
                <TableCell>
                  {f.estado === "rectificada" ? (
                    <span className="text-xs px-2 py-1 rounded-sm bg-orange-50 text-orange-600">Rectificada</span>
                  ) : (
                    <button data-testid={`toggle-estado-${f.id}`} onClick={() => toggleEstado(f)}
                      className={`text-xs px-2 py-1 rounded-sm ${f.estado === "cobrada" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {f.estado === "cobrada" ? "Cobrada" : "Pendiente"}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <ShieldCheck size={14} weight="fill" /> Registrada
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <button data-testid={`ver-${f.id}`} onClick={() => setDetalle(f)} title="Ver" className="text-slate-400 hover:text-primary p-1.5"><Eye size={16} /></button>
                  {f.tipo_factura !== "rectificativa" && f.estado !== "rectificada" && (
                    <button data-testid={`rectificar-${f.id}`} onClick={() => setRectId(f.id)} title="Emitir rectificativa (abono)" className="text-slate-400 hover:text-orange-500 p-1.5"><ArrowUUpLeft size={16} /></button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Crear factura */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-sm max-h-[90vh] overflow-y-auto" data-testid="factura-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nueva factura de venta</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            <div>
              <Label className="text-xs">Serie</Label>
              <Input data-testid="input-serie" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value.toUpperCase() })} className="rounded-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Cliente existente (opcional)</Label>
              <select data-testid="select-cliente" value={form.cliente_id} onChange={(e) => onCliente(e.target.value)}
                className="w-full h-10 mt-1 border border-input rounded-sm bg-white px-2 text-sm">
                <option value="">— Nuevo cliente / escribir abajo —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Nombre cliente *</Label>
              <Input data-testid="input-cliente-nombre" value={form.cliente_nombre}
                onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value, cliente_id: "" })}
                className="rounded-sm mt-1" placeholder="Se dará de alta si es nuevo" />
            </div>
            <div>
              <Label className="text-xs">NIF / CIF</Label>
              <Input data-testid="input-cliente-nif" value={form.cliente_nif}
                onChange={(e) => setForm({ ...form, cliente_nif: e.target.value })}
                className="rounded-sm mt-1 font-mono-plex" />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.fecha_expedicion} onChange={(e) => setForm({ ...form, fecha_expedicion: e.target.value })} className="rounded-sm mt-1" />
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
            <Button data-testid="emitir-factura-button" onClick={save} className="rounded-sm bg-primary">Emitir factura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle Verifactu */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="sm:max-w-2xl rounded-sm" data-testid="detalle-factura-dialog">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center justify-between pr-6">
                  Factura {detalle.numero_completo}
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-normal">
                    <CheckCircle size={16} weight="fill" /> Verifactu
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-3 text-sm">
                  <div><span className="text-slate-400 text-xs uppercase tracking-wide">Cliente</span><div className="font-medium">{detalle.cliente_nombre}</div><div className="font-mono-plex text-xs text-slate-500">{detalle.cliente_nif}</div></div>
                  <div className="border border-slate-200 rounded-sm">
                    {detalle.lineas.map((l, i) => (
                      <div key={i} className="flex justify-between px-3 py-2 border-b border-slate-100 last:border-0 text-sm">
                        <span className="text-slate-700">{l.descripcion} <span className="text-slate-400">x{l.cantidad} {l.unidad || "ud"}</span></span>
                        <span className="tabular-nums">{eur(l.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-6 text-sm">
                    <span className="text-slate-500">Base {eur(detalle.base_total)}</span>
                    <span className="text-slate-500">IVA {eur(detalle.iva_total)}</span>
                    <span className="font-semibold text-primary">Total {eur(detalle.total)}</span>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-sm p-3 flex flex-col items-center justify-center text-center" data-testid="verifactu-qr">
                  <QRCodeSVG value={detalle.verifactu?.qr_data || ""} size={120} level="M" />
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-2">QR Verifactu</div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-sm p-3 mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Forma de pago</div>
                  <div className="text-sm text-slate-700">{detalle.forma_pago || "—"}</div>
                </div>
                {detalle.rectifica_a && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Rectifica a</div>
                    <div className="text-sm text-orange-600 font-mono-plex">{detalle.rectifica_a}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Huella (SHA-256)</div>
                  <div className="font-mono-plex text-[11px] text-slate-600 break-all">{detalle.verifactu?.huella}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rectId} onOpenChange={(o) => !o && setRectId(null)}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir factura rectificativa</AlertDialogTitle>
            <AlertDialogDescription>
              Según Verifactu, las facturas no se pueden eliminar. Se emitirá una <b>factura rectificativa (abono)</b> que anula los importes de la original y la marca como rectificada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction data-testid="confirmar-rectificar-button" onClick={rectificar} className="rounded-sm bg-orange-500 hover:bg-orange-600">Emitir rectificativa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
