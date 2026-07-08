import { useMemo, useState } from "react";
import { Plus, Trash, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { eur } from "@/lib/api";

const IVA_OPCIONES = [21, 10, 4, 0];
const GRID = { display: "grid", gridTemplateColumns: "1.9fr 3.4fr 1.1fr 1fr 1.6fr 1.1fr 1.4fr 1.8fr 0.8fr", gap: "0.5rem" };

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

const inputCls = "h-9 text-sm rounded-md border-zinc-200 focus-visible:ring-indigo-600";

const articuloToLinea = (a) => ({
  codigo_proveedor: a.codigo_proveedor || a.referencia || "",
  descripcion: a.nombre || "",
  cantidad: 1, unidad: a.unidad || "ud", precio_unitario: a.precio || 0, descuento: 0, tipo_iva: a.tipo_iva ?? 21,
});

export default function LineasEditor({ lineas, setLineas, articulos = [] }) {
  const [buscadorOpen, setBuscadorOpen] = useState(false);
  const [target, setTarget] = useState(null); // null = nueva línea; i = reemplaza línea i
  const [q, setQ] = useState("");

  const update = (i, field, value) => {
    const next = [...lineas];
    next[i] = { ...next[i], [field]: value };
    setLineas(next);
  };
  const add = () =>
    setLineas([...lineas, { codigo_proveedor: "", descripcion: "", cantidad: 1, unidad: "ud", precio_unitario: 0, descuento: 0, tipo_iva: 21 }]);
  const remove = (i) => setLineas(lineas.filter((_, idx) => idx !== i));

  const abrirBuscador = (i = null) => { setTarget(i); setQ(""); setBuscadorOpen(true); };
  const elegir = (a) => {
    const nl = articuloToLinea(a);
    if (target == null) setLineas([...lineas, nl]);
    else { const next = [...lineas]; next[target] = { ...next[target], ...nl }; setLineas(next); }
    setBuscadorOpen(false); setQ("");
  };

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return articulos.slice(0, 50);
    return articulos.filter((a) =>
      [a.referencia, a.nombre, a.codigo_proveedor, a.codigo_barras].join(" ").toLowerCase().includes(t)
    ).slice(0, 50);
  }, [q, articulos]);

  const totales = calcTotales(lineas);

  return (
    <div className="space-y-3" data-testid="lineas-editor">
      <div className="border border-zinc-200 rounded-lg overflow-hidden">
        <div style={GRID} className="bg-zinc-50 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
          <div>Cód.</div>
          <div>Descripción</div>
          <div className="text-right">Cant.</div>
          <div>Ud.</div>
          <div className="text-right">Precio</div>
          <div className="text-right">Dto%</div>
          <div className="text-right">IVA%</div>
          <div className="text-right">Total</div>
          <div />
        </div>
        {lineas.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-zinc-400">Sin líneas. Añade la primera.</div>
        )}
        {lineas.map((l, i) => {
          const b = Number(l.cantidad || 0) * Number(l.precio_unitario || 0) * (1 - Number(l.descuento || 0) / 100);
          const total = b * (1 + Number(l.tipo_iva || 0) / 100);
          return (
            <div key={i} style={GRID} className="px-3 py-2 border-t border-zinc-100 items-center hover:bg-zinc-50/50 transition-colors">
              <Input data-testid={`linea-codprov-${i}`} className={`${inputCls} font-mono-plex`} value={l.codigo_proveedor || ""} onChange={(e) => update(i, "codigo_proveedor", e.target.value)} placeholder="Ref." />
              <div className="relative">
                <Input data-testid={`linea-descripcion-${i}`} className={`${inputCls} pr-9`} value={l.descripcion} onChange={(e) => update(i, "descripcion", e.target.value)} placeholder="Concepto" />
                <button
                  type="button"
                  data-testid={`linea-buscar-${i}`}
                  onClick={() => abrirBuscador(i)}
                  title="Buscar artículo"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-primary p-1 rounded"
                >
                  <MagnifyingGlass size={15} />
                </button>
              </div>
              <Input data-testid={`linea-cantidad-${i}`} type="number" className={`${inputCls} text-right`} value={l.cantidad} onChange={(e) => update(i, "cantidad", e.target.value)} />
              <Input data-testid={`linea-unidad-${i}`} className={inputCls} value={l.unidad || "ud"} onChange={(e) => update(i, "unidad", e.target.value)} placeholder="ud" />
              <Input data-testid={`linea-precio-${i}`} type="number" className={`${inputCls} text-right`} value={l.precio_unitario} onChange={(e) => update(i, "precio_unitario", e.target.value)} />
              <Input type="number" className={`${inputCls} text-right`} value={l.descuento} onChange={(e) => update(i, "descuento", e.target.value)} />
              <select className={`${inputCls} text-right border border-input bg-white px-1`} value={l.tipo_iva} onChange={(e) => update(i, "tipo_iva", Number(e.target.value))}>
                {IVA_OPCIONES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <div className="text-right text-sm font-medium tabular-nums text-zinc-900 self-center">{eur(total)}</div>
              <div className="flex justify-end self-center">
                <button data-testid={`linea-eliminar-${i}`} onClick={() => remove(i)} className="text-zinc-400 hover:text-red-500 transition-colors"><Trash size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button data-testid="add-linea-button" variant="outline" size="sm" onClick={add} className="rounded-md">
            <Plus size={15} className="mr-1" /> Añadir línea
          </Button>
          <Button data-testid="buscar-articulo-button" variant="outline" size="sm" onClick={() => abrirBuscador(null)} className="rounded-md" disabled={articulos.length === 0}>
            <MagnifyingGlass size={15} className="mr-1" /> Buscar artículo
          </Button>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="text-zinc-500">Base <span className="text-zinc-900 font-medium tabular-nums ml-1">{eur(totales.base)}</span></div>
          <div className="text-zinc-500">IVA <span className="text-zinc-900 font-medium tabular-nums ml-1">{eur(totales.iva)}</span></div>
          <div className="text-zinc-900 font-semibold">Total <span className="tabular-nums ml-1 text-primary">{eur(totales.total)}</span></div>
        </div>
      </div>

      {/* Buscador de artículos */}
      <Dialog open={buscadorOpen} onOpenChange={setBuscadorOpen}>
        <DialogContent className="sm:max-w-2xl rounded-sm" data-testid="buscador-articulo-dialog">
          <DialogHeader><DialogTitle className="font-heading">Buscar artículo</DialogTitle></DialogHeader>
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input autoFocus data-testid="buscador-articulo-input" placeholder="Referencia, nombre, código de barras o cód. proveedor…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-md" />
          </div>
          <div className="max-h-[50vh] overflow-y-auto border border-zinc-200 rounded-md divide-y divide-zinc-100">
            {resultados.length === 0 && <div className="px-3 py-8 text-center text-sm text-zinc-400">Sin resultados.</div>}
            {resultados.map((a) => (
              <button
                key={a.id}
                type="button"
                data-testid={`buscador-articulo-item-${a.id}`}
                onClick={() => elegir(a)}
                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50/60 transition-colors flex items-center gap-3"
              >
                <span className="font-mono-plex text-xs text-zinc-500 w-28 shrink-0 truncate">{a.referencia || a.codigo_proveedor || "—"}</span>
                <span className="text-sm text-zinc-800 flex-1 truncate">{a.nombre}</span>
                <span className="text-sm tabular-nums font-medium text-zinc-900">{eur(a.precio || 0)}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">Se muestran hasta 50 resultados. Escribe para filtrar.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
