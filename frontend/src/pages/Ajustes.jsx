import { useEffect, useState } from "react";
import { Plus, Trash, FloppyDisk, Buildings, Stack, Star } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getAjustes, updateAjustes } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPRESA_FIELDS = [
  { k: "nombre", label: "Nombre / Razón social", span: 2 },
  { k: "nif", label: "NIF / CIF", mono: true },
  { k: "telefono", label: "Teléfono" },
  { k: "direccion", label: "Dirección", span: 2 },
  { k: "codigo_postal", label: "Código postal" },
  { k: "ciudad", label: "Ciudad" },
  { k: "email", label: "Email", span: 2 },
  { k: "iban", label: "IBAN", mono: true, span: 2 },
];

const emptySerie = (tipos) => ({
  id: "", nombre: "", por_defecto: false,
  contadores: tipos.reduce((a, t) => ({ ...a, [t]: 1 }), {}),
});

function SeriesEditor({ titulo, subtitulo, tipos, labels, series, setSeries }) {
  const cols = `1.4fr ${tipos.map(() => "1fr").join(" ")} 0.7fr 0.5fr`;
  const setField = (i, field, value) => {
    const next = [...series];
    next[i] = { ...next[i], [field]: value };
    setSeries(next);
  };
  const setContador = (i, tipo, value) => {
    const next = [...series];
    next[i] = { ...next[i], contadores: { ...next[i].contadores, [tipo]: value } };
    setSeries(next);
  };
  const setDefault = (i) => setSeries(series.map((s, idx) => ({ ...s, por_defecto: idx === i })));
  const remove = (i) => setSeries(series.filter((_, idx) => idx !== i));
  const add = () => setSeries([...series, emptySerie(tipos)]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><Stack size={18} weight="duotone" /></span>
        <div>
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900">{titulo}</h3>
          <p className="text-xs text-zinc-500">{subtitulo}</p>
        </div>
      </div>
      <div className="p-5 space-y-2">
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: "0.5rem" }} className="px-1 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
          <div>Serie</div>
          {tipos.map((t) => <div key={t} className="text-right">Próx. {labels[t]}</div>)}
          <div className="text-center">Defecto</div>
          <div />
        </div>
        {series.length === 0 && <p className="text-sm text-zinc-400 py-3 text-center">Sin series. Añade la primera.</p>}
        {series.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: cols, gap: "0.5rem" }} className="items-center" data-testid={`serie-row-${titulo}-${i}`}>
            <Input data-testid={`serie-nombre-${i}`} value={s.nombre} onChange={(e) => setField(i, "nombre", e.target.value.toUpperCase())} placeholder="Ej. A" className="h-9 rounded-md font-mono-plex text-sm" />
            {tipos.map((t) => (
              <Input key={t} type="number" min={1} value={s.contadores?.[t] ?? 1} onChange={(e) => setContador(i, t, e.target.value)} className="h-9 rounded-md text-sm text-right" />
            ))}
            <div className="flex justify-center">
              <button type="button" data-testid={`serie-default-${i}`} onClick={() => setDefault(i)} title="Marcar como serie por defecto"
                className={s.por_defecto ? "text-amber-500" : "text-zinc-300 hover:text-amber-400"}>
                <Star size={20} weight={s.por_defecto ? "fill" : "regular"} />
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" data-testid={`serie-delete-${i}`} onClick={() => remove(i)} className="text-zinc-400 hover:text-red-500 p-1"><Trash size={16} /></button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} className="rounded-md mt-2" data-testid={`add-serie-${titulo}`}>
          <Plus size={15} className="mr-1" /> Añadir serie
        </Button>
      </div>
    </div>
  );
}

export default function Ajustes() {
  const [empresa, setEmpresa] = useState({});
  const [seriesVenta, setSeriesVenta] = useState([]);
  const [seriesCompra, setSeriesCompra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAjustes().then((d) => {
      setEmpresa(d.empresa || {});
      setSeriesVenta(d.series_venta || []);
      setSeriesCompra(d.series_compra || []);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    if (seriesVenta.some((s) => !s.nombre.trim())) return toast.error("Todas las series de venta necesitan un nombre");
    if (seriesCompra.some((s) => !s.nombre.trim())) return toast.error("Todas las series de compra necesitan un nombre");
    setSaving(true);
    try {
      const d = await updateAjustes({ empresa, series_venta: seriesVenta, series_compra: seriesCompra });
      setEmpresa(d.empresa || {});
      setSeriesVenta(d.series_venta || []);
      setSeriesCompra(d.series_compra || []);
      toast.success("Ajustes guardados");
    } catch { toast.error("Error al guardar ajustes"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-zinc-400">Cargando ajustes...</div>;

  return (
    <div className="p-8 max-w-[1100px]" data-testid="ajustes-page">
      <PageHeader title="Ajustes" subtitle="Configura los datos de tu empresa y la numeración de series de compra y venta">
        <Button data-testid="guardar-ajustes-button" onClick={save} disabled={saving} className="rounded-md bg-primary hover:bg-indigo-700">
          <FloppyDisk size={16} className="mr-1.5" weight="fill" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"><Buildings size={18} weight="duotone" /></span>
            <div>
              <h3 className="font-heading font-semibold tracking-tight text-zinc-900">Datos de empresa</h3>
              <p className="text-xs text-zinc-500">Aparecerán en tus documentos y facturas</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            {EMPRESA_FIELDS.map((f) => (
              <div key={f.k} className={f.span === 2 ? "col-span-2" : ""}>
                <Label className="text-xs">{f.label}</Label>
                <Input
                  data-testid={`empresa-${f.k}`}
                  value={empresa[f.k] || ""}
                  onChange={(e) => setEmpresa({ ...empresa, [f.k]: e.target.value })}
                  className={`rounded-md mt-1 ${f.mono ? "font-mono-plex" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>

        <SeriesEditor
          titulo="Series de venta"
          subtitulo="Numeración de facturas, pedidos y albaranes emitidos"
          tipos={["facturas", "pedidos", "albaranes"]}
          labels={{ facturas: "Factura", pedidos: "Pedido", albaranes: "Albarán" }}
          series={seriesVenta}
          setSeries={setSeriesVenta}
        />

        <SeriesEditor
          titulo="Series de compra"
          subtitulo="Numeración interna de pedidos y albaranes recibidos"
          tipos={["pedidos", "albaranes"]}
          labels={{ pedidos: "Pedido", albaranes: "Albarán" }}
          series={seriesCompra}
          setSeries={setSeriesCompra}
        />
      </div>
    </div>
  );
}
