import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eur } from "@/lib/api";

const IVA_OPCIONES = [21, 10, 4, 0];

export function calcTotales(lineas) {
  let base = 0;
  let iva = 0;
  lineas.forEach((l) => {
    const b = Number(l.cantidad || 0) * Number(l.precio_unitario || 0) * (1 - Number(l.descuento || 0) / 100);
    base += b;
    iva += (b * Number(l.tipo_iva || 0)) / 100;
  });
  return { base: +base.toFixed(2), iva: +iva.toFixed(2), total: +(base + iva).toFixed(2) };
}

export default function LineasEditor({ lineas, setLineas, articulos = [] }) {
  const update = (i, field, value) => {
    const next = [...lineas];
    next[i] = { ...next[i], [field]: value };
    setLineas(next);
  };
  const add = () =>
    setLineas([...lineas, { codigo_proveedor: "", descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0, tipo_iva: 21 }]);
  const remove = (i) => setLineas(lineas.filter((_, idx) => idx !== i));

  const addArticulo = (id) => {
    const a = articulos.find((x) => x.id === id);
    if (!a) return;
    setLineas([...lineas, {
      codigo_proveedor: a.codigo_proveedor || "",
      descripcion: a.referencia ? `${a.referencia} · ${a.nombre}` : a.nombre,
      cantidad: 1, precio_unitario: a.precio || 0, descuento: 0, tipo_iva: a.tipo_iva ?? 21,
    }]);
  };

  const totales = calcTotales(lineas);

  return (
    <div className="space-y-3" data-testid="lineas-editor">
      <div className="border border-slate-200 rounded-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
          <div className="col-span-2">Cód. prov.</div>
          <div className="col-span-3">Descripción</div>
          <div className="col-span-1 text-right">Cant.</div>
          <div className="col-span-2 text-right">Precio</div>
          <div className="col-span-1 text-right">Dto%</div>
          <div className="col-span-1 text-right">IVA%</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1" />
        </div>
        {lineas.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-400">Sin líneas. Añade la primera.</div>
        )}
        {lineas.map((l, i) => {
          const b = Number(l.cantidad || 0) * Number(l.precio_unitario || 0) * (1 - Number(l.descuento || 0) / 100);
          const total = b * (1 + Number(l.tipo_iva || 0) / 100);
          return (
            <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-slate-100 items-center">
              <Input
                data-testid={`linea-codprov-${i}`}
                className="col-span-2 h-8 text-sm font-mono-plex"
                value={l.codigo_proveedor || ""}
                onChange={(e) => update(i, "codigo_proveedor", e.target.value)}
                placeholder="Ref."
              />
              <Input
                data-testid={`linea-descripcion-${i}`}
                className="col-span-3 h-8 text-sm"
                value={l.descripcion}
                onChange={(e) => update(i, "descripcion", e.target.value)}
                placeholder="Concepto"
              />
              <Input
                data-testid={`linea-cantidad-${i}`}
                type="number"
                className="col-span-1 h-8 text-sm text-right"
                value={l.cantidad}
                onChange={(e) => update(i, "cantidad", e.target.value)}
              />
              <Input
                data-testid={`linea-precio-${i}`}
                type="number"
                className="col-span-2 h-8 text-sm text-right"
                value={l.precio_unitario}
                onChange={(e) => update(i, "precio_unitario", e.target.value)}
              />
              <Input
                type="number"
                className="col-span-1 h-8 text-sm text-right"
                value={l.descuento}
                onChange={(e) => update(i, "descuento", e.target.value)}
              />
              <select
                className="col-span-1 h-8 text-sm text-right border border-input rounded-sm bg-white px-1"
                value={l.tipo_iva}
                onChange={(e) => update(i, "tipo_iva", Number(e.target.value))}
              >
                {IVA_OPCIONES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <div className="col-span-1 text-right text-sm font-medium tabular-nums">{eur(total)}</div>
              <div className="col-span-1 flex justify-end">
                <button
                  data-testid={`linea-eliminar-${i}`}
                  onClick={() => remove(i)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button data-testid="add-linea-button" variant="outline" size="sm" onClick={add} className="rounded-sm">
            <Plus size={15} className="mr-1" /> Añadir línea
          </Button>
          {articulos.length > 0 && (
            <select
              data-testid="select-articulo-linea"
              value=""
              onChange={(e) => { if (e.target.value) addArticulo(e.target.value); e.target.value = ""; }}
              className="h-9 text-sm border border-input rounded-sm bg-white px-2 text-slate-600"
            >
              <option value="">+ Desde artículo…</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>{a.referencia ? `${a.referencia} · ` : ""}{a.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-6 text-sm">
          <div className="text-slate-500">Base <span className="text-slate-900 font-medium tabular-nums ml-1">{eur(totales.base)}</span></div>
          <div className="text-slate-500">IVA <span className="text-slate-900 font-medium tabular-nums ml-1">{eur(totales.iva)}</span></div>
          <div className="text-slate-900 font-semibold">Total <span className="tabular-nums ml-1 text-primary">{eur(totales.total)}</span></div>
        </div>
      </div>
    </div>
  );
}
