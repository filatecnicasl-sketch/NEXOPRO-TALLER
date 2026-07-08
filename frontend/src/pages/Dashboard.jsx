import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendUp, TrendDown, UsersThree, Truck, Receipt, FileArrowDown, Package } from "@phosphor-icons/react";
import { getResumen, eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const Kpi = ({ label, value, sub, icon: Icon, accent = "text-indigo-600", accentBg = "bg-indigo-50" }) => (
  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-5 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200" data-testid={`kpi-${label}`}>
    <div className="flex items-start justify-between">
      <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</span>
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${accentBg} ${accent}`}><Icon size={16} weight="duotone" /></span>
    </div>
    <div className="mt-3 font-heading text-2xl font-bold tracking-tight text-zinc-900 tabular-nums">{value}</div>
    {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getResumen().then(setData).catch(() => setData(null));
  }, []);

  if (!data)
    return (
      <div className="p-8 max-w-[1400px]">
        <PageHeader title="Panel de control" subtitle="Resumen de tu actividad" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    );

  return (
    <div className="p-8 max-w-[1400px]" data-testid="dashboard-page">
      <PageHeader title="Panel de control" subtitle="Resumen de tu actividad comercial y financiera" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Kpi label="Facturado" value={eur(data.total_facturado)} sub={`${data.num_facturas_emitidas} facturas emitidas`} icon={TrendUp} accent="text-emerald-600" accentBg="bg-emerald-50" />
        <Kpi label="Pendiente cobro" value={eur(data.pendiente_cobro)} sub="Facturas sin cobrar" icon={Receipt} accent="text-amber-600" accentBg="bg-amber-50" />
        <Kpi label="Gastos" value={eur(data.total_gastos)} sub={`${data.num_facturas_recibidas} facturas recibidas`} icon={TrendDown} accent="text-red-500" accentBg="bg-red-50" />
        <Kpi label="Pendiente pago" value={eur(data.pendiente_pago)} sub="Facturas sin pagar" icon={FileArrowDown} accent="text-blue-600" accentBg="bg-blue-50" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Kpi label="Clientes" value={data.clientes} icon={UsersThree} />
        <Kpi label="Proveedores" value={data.proveedores} icon={Truck} />
        <Kpi label="Artículos" value={data.articulos ?? 0} icon={Package} />
        <Kpi label="Pedidos" value={data.pedidos} icon={Receipt} />
        <Kpi label="Albaranes" value={data.albaranes} icon={FileArrowDown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900 mb-4">Facturación mensual</h3>
          {data.grafico_facturacion.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-zinc-400">Aún no hay facturas emitidas</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.grafico_facturacion}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => eur(v)} cursor={{ fill: "#f4f4f5" }} contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 13 }} />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
          <h3 className="font-heading font-semibold tracking-tight text-zinc-900 mb-4">Últimas facturas emitidas</h3>
          <div className="space-y-3">
            {data.ultimas_emitidas.length === 0 && <p className="text-sm text-zinc-400">Sin datos</p>}
            {data.ultimas_emitidas.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-sm border-b border-zinc-100 pb-2 last:border-0">
                <div>
                  <div className="font-medium text-zinc-800 font-mono-plex text-xs">{f.numero_completo}</div>
                  <div className="text-xs text-zinc-400 truncate max-w-[140px]">{f.cliente_nombre || "—"}</div>
                </div>
                <div className="tabular-nums font-semibold text-zinc-900">{eur(f.total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
