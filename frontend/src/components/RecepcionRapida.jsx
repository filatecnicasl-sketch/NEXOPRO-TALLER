import { useState } from "react";
import { Lightning, Plus, Printer, Check, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  getVehiculos, getContactos, createVehiculo, createContacto, createOrden, getOrdenes,
  guardarFirmaOrden, mediaUrl, hojaEntradaHtmlUrl, imprimirDocumento,
} from "@/lib/api";
import { TIPOS_TRABAJO } from "@/lib/taller";
import { getPlantillaHojaEntrada, printTemplateWithData, mapOrdenToFormData } from "@/formatos/printTemplate";
import FotosGaleria from "@/components/FotosGaleria";
import SignaturePad from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const selectCls = "h-10 w-full text-sm rounded-md border border-input bg-white px-3 mt-1";
const hoy = () => new Date().toISOString().slice(0, 10);
const EMPTY = { matricula: "", marca: "", modelo: "", cliente_id: "", nuevoNombre: "", nuevoTel: "", motivo: "", tipos: [] };

export default function RecepcionRapida({ open, onOpenChange, vehiculos, clientes, empresa, onCreated }) {
  const [paso, setPaso] = useState("datos");
  const [form, setForm] = useState(EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [orden, setOrden] = useState(null);
  const [veh, setVeh] = useState(null);
  const [cli, setCli] = useState(null);

  const reset = () => { setPaso("datos"); setForm(EMPTY); setOrden(null); setVeh(null); setCli(null); };
  const cerrar = () => { onOpenChange(false); setTimeout(reset, 200); };

  const toggleTipo = (t) => setForm((f) => ({ ...f, tipos: f.tipos.includes(t) ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] }));

  const crear = async () => {
    const mat = form.matricula.trim().toUpperCase();
    if (!mat) return toast.error("Indica la matrícula del vehículo");
    setGuardando(true);
    try {
      // Vehículo: reutiliza si ya existe por matrícula, si no lo crea
      let vehiculo = (vehiculos || []).find((v) => (v.matricula || "").toUpperCase() === mat);
      if (!vehiculo) {
        vehiculo = await createVehiculo({ matricula: mat, marca: form.marca, modelo: form.modelo, cliente_id: form.cliente_id, tipo: "cliente" });
      }
      // Cliente: existente seleccionado, o alta rápida por nombre
      let cliente = (clientes || []).find((c) => c.id === (form.cliente_id || vehiculo.cliente_id)) || null;
      let cliente_id = form.cliente_id || vehiculo.cliente_id || "";
      if (!cliente_id && form.nuevoNombre.trim()) {
        cliente = await createContacto({ nombre: form.nuevoNombre.trim(), telefono: form.nuevoTel.trim(), tipo: "cliente" });
        cliente_id = cliente.id;
      }
      const nueva = await createOrden({
        vehiculo_id: vehiculo.id, cliente_id, tipos_trabajo: form.tipos,
        descripcion: form.motivo, fecha_entrada: hoy(), estado: "recepcion", lineas: [],
      });
      setVeh(vehiculo); setCli(cliente || { nombre: nueva.cliente_nombre || "" }); setOrden(nueva);
      setPaso("recepcion");
      onCreated && onCreated();
      toast.success(`Recepción creada · ${nueva.numero || ""}`);
    } catch { toast.error("No se pudo crear la recepción"); }
    finally { setGuardando(false); }
  };

  const refetch = async () => {
    const d = await getOrdenes();
    const o = d.find((x) => x.id === orden?.id);
    if (o) setOrden(o);
  };
  const firmar = async (dataURL) => {
    setFirmando(true);
    try { const r = await guardarFirmaOrden(orden.id, dataURL); setOrden((o) => ({ ...o, firma_cliente_path: r.firma_cliente_path, firma_cliente_at: r.firma_cliente_at })); toast.success("Firma guardada"); }
    catch { toast.error("No se pudo guardar la firma"); }
    finally { setFirmando(false); }
  };
  const imprimir = async () => {
    try {
      const tpl = await getPlantillaHojaEntrada();
      if (tpl) {
        printTemplateWithData(tpl, mapOrdenToFormData(orden, veh || {}, cli || {}, empresa || {}));
      } else {
        await imprimirDocumento(hojaEntradaHtmlUrl(orden.id));
      }
    } catch { toast.error("No se pudo imprimir la hoja"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : cerrar())}>
      <DialogContent className="sm:max-w-2xl rounded-lg max-h-[92vh] overflow-y-auto" data-testid="recepcion-rapida-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Lightning size={18} weight="fill" /></span>
            Recepción rápida{orden?.numero ? ` · ${orden.numero}` : ""}
          </DialogTitle>
          <DialogDescription>Alta exprés del vehículo con fotos del estado y firma del cliente.</DialogDescription>
        </DialogHeader>

        {paso === "datos" && (
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-xs">Matrícula *</Label>
              <Input data-testid="rr-matricula" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value.toUpperCase() })} placeholder="0000XXX" className="rounded-md mt-1 font-mono-plex text-lg h-12" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="rounded-md mt-1" /></div>
              <div><Label className="text-xs">Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className="rounded-md mt-1" /></div>
            </div>
            <div>
              <Label className="text-xs">Cliente existente</Label>
              <select data-testid="rr-cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className={selectCls}>
                <option value="">— Nuevo / del vehículo —</option>
                {(clientes || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {!form.cliente_id && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nombre cliente</Label><Input data-testid="rr-nuevo-nombre" value={form.nuevoNombre} onChange={(e) => setForm({ ...form, nuevoNombre: e.target.value })} className="rounded-md mt-1" /></div>
                <div><Label className="text-xs">Teléfono</Label><Input value={form.nuevoTel} onChange={(e) => setForm({ ...form, nuevoTel: e.target.value })} className="rounded-md mt-1" /></div>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Tipo de trabajo</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {TIPOS_TRABAJO.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox data-testid={`rr-tipo-${t.value}`} checked={form.tipos.includes(t.value)} onCheckedChange={() => toggleTipo(t.value)} />
                    <span className="text-sm text-zinc-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Motivo / trabajos solicitados</Label>
              <Textarea data-testid="rr-motivo" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} rows={2} className="rounded-md mt-1" />
            </div>
          </div>
        )}

        {paso === "recepcion" && orden && (
          <div className="space-y-5 py-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
              <Check size={16} weight="bold" /> Orden <b className="font-mono-plex">{orden.numero}</b> creada para <b>{veh?.matricula}</b>. Añade fotos del estado y la firma del cliente.
            </div>
            <FotosGaleria tipo="ordenes" id={orden.id} fotos={orden.fotos || []} onChange={refetch} titulo="Fotos del estado del vehículo" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">Firma del cliente (conformidad de entrada)</Label>
                {orden.firma_cliente_path && <button type="button" onClick={() => setOrden((o) => ({ ...o, firma_cliente_path: "" }))} className="text-[11px] text-red-500 hover:underline" data-testid="rr-refirmar">Volver a firmar</button>}
              </div>
              {orden.firma_cliente_path ? (
                <div className="border border-zinc-200 rounded-lg p-3 bg-white inline-flex flex-col items-center" data-testid="rr-firma-guardada">
                  <img src={mediaUrl(orden.firma_cliente_path)} alt="Firma" className="h-24 object-contain" />
                  <span className="text-[10px] text-emerald-600 mt-1">✓ Firmado</span>
                </div>
              ) : (
                <SignaturePad onSave={firmar} saving={firmando} />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {paso === "datos" ? (
            <>
              <Button variant="outline" onClick={cerrar} className="rounded-md">Cancelar</Button>
              <Button data-testid="rr-crear" onClick={crear} disabled={guardando} className="rounded-md bg-primary">
                <Plus size={16} className="mr-1.5" /> {guardando ? "Creando…" : "Crear recepción"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={cerrar} className="rounded-md" data-testid="rr-cerrar">Cerrar sin imprimir</Button>
              <Button onClick={async () => { await imprimir(); cerrar(); }} className="rounded-md bg-emerald-600 hover:bg-emerald-700" data-testid="rr-imprimir-finalizar"><Printer size={16} className="mr-1.5" /> Imprimir hoja y finalizar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
