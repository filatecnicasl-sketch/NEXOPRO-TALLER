import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Wrench, MagnifyingGlass, CalendarBlank, Clock, ArrowRight, CircleNotch } from "@phosphor-icons/react";
import { getTallerResumen, eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

const OT_ESTADOS = [
  { key: "recepcion", label: "Recepción", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  { key: "en_curso", label: "En curso", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  { key: "finalizado", label: "Finalizado", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { key: "entregado", label: "Entregado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
];
const fmtHora = (iso) => (iso && iso.includes("T") ? iso.split("T")[1].slice(0, 5) : "—");
const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—");

function Kpi({ icon: Icon, label, value, tone, to, nav, testid }) {
  return (
    <button data-testid={testid} onClick={() => to && nav(to)}
      className="text-left bg-white border border-zinc-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon size={20} weight="duotone" /></span>
        <ArrowRight size={16} className="text-zinc-300 group-hover:text-primary transition-colors" />
      </div>
      <div className="mt-3 text-3xl font-heading font-bold text-zinc-900 tabular-nums">{value}</div>
      <div className="text-sm text-zinc-500 mt-0.5">{label}</div>
    </button>
  );
}

export default function TallerDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { getTallerResumen().then(setData).catch(() => setData({})); }, []);

  if (!data) return (
    <div className="p-8 flex items-center gap-2 text-zinc-400"><CircleNotch size={18} className="animate-spin" /> Cargando panel…</div>
  );

  const pe = data.ordenes_por_estado || {};
  const hoyISO = new Date().toISOString().slice(0, 10);
  const esVencida = (p) => p.fecha_devolucion_prevista && p.fecha_devolucion_prevista < hoyISO;
  const vencidas = (data.cortesias_activas || []).filter(esVencida).length;

  return (
    <div className="p-8 max-w-[1300px]" data-testid="taller-dashboard">
      <PageHeader title="Panel del taller" subtitle="Visión operativa del día a día" chip="Taller" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi testid="kpi-vehiculos" icon={Car} label="Vehículos" value={data.total_vehiculos || 0} tone="bg-indigo-50 text-indigo-600" to="/taller/vehiculos" nav={nav} />
        <Kpi testid="kpi-ordenes" icon={Wrench} label="Órdenes abiertas" value={data.ordenes_abiertas || 0} tone="bg-blue-50 text-blue-600" to="/taller/ordenes" nav={nav} />
        <Kpi testid="kpi-peritajes" icon={MagnifyingGlass} label="Peritajes pendientes" value={data.peritajes_pendientes || 0} tone="bg-amber-50 text-amber-600" to="/taller/peritajes" nav={nav} />
        <Kpi testid="kpi-cortesias" icon={Car} label="Cortesías activas" value={(data.cortesias_activas || []).length} tone="bg-emerald-50 text-emerald-600" to="/taller/cortesia" nav={nav} />
      </div>

      {/* Órdenes por estado */}
      <div className="mt-6">
        <h3 className="font-heading font-semibold text-zinc-900 text-sm mb-3">Órdenes de trabajo por estado</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {OT_ESTADOS.map((e) => (
            <div key={e.key} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm" data-testid={`ot-estado-${e.key}`}>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${e.cls}`}>{e.label}</span>
              <div className="mt-2 text-2xl font-heading font-bold text-zinc-900 tabular-nums">{pe[e.key] || 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Citas de hoy */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid="citas-hoy-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-zinc-900 text-sm flex items-center gap-2"><CalendarBlank size={16} weight="duotone" className="text-primary" /> Citas de hoy</h3>
            <button onClick={() => nav("/taller/citas")} className="text-xs text-primary hover:underline">Ver agenda</button>
          </div>
          {(data.citas_hoy || []).length === 0 ? <p className="text-sm text-zinc-400 py-4 text-center">No hay citas para hoy.</p>
            : (
              <div className="divide-y divide-zinc-100">
                {data.citas_hoy.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="font-mono-plex text-zinc-900 w-12 flex items-center gap-1"><Clock size={13} className="text-zinc-400" />{fmtHora(c.fecha)}</span>
                    <span className="font-mono-plex text-zinc-700">{c.vehiculo_matricula || "—"}</span>
                    <span className="text-zinc-500 truncate flex-1">{c.cliente_nombre || ""}{c.motivo ? ` · ${c.motivo}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          {(data.proximas_citas || []).length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-100">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">Próximas</div>
              {data.proximas_citas.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-1 text-sm text-zinc-500">
                  <span className="w-16 text-zinc-600">{fmtFecha(c.fecha)} {fmtHora(c.fecha)}</span>
                  <span className="font-mono-plex text-zinc-700">{c.vehiculo_matricula || "—"}</span>
                  <span className="truncate">{c.motivo || ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas órdenes */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5" data-testid="ultimas-ordenes-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-zinc-900 text-sm flex items-center gap-2"><Wrench size={16} weight="duotone" className="text-primary" /> Últimas órdenes</h3>
            <button onClick={() => nav("/taller/ordenes")} className="text-xs text-primary hover:underline">Ver todas</button>
          </div>
          {(data.ultimas_ordenes || []).length === 0 ? <p className="text-sm text-zinc-400 py-4 text-center">Sin órdenes todavía.</p>
            : (
              <div className="divide-y divide-zinc-100">
                {data.ultimas_ordenes.map((o) => {
                  const est = OT_ESTADOS.find((e) => e.key === o.estado) || OT_ESTADOS[0];
                  return (
                    <div key={o.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="font-mono-plex text-xs text-zinc-500">{o.numero}</span>
                      <span className="font-mono-plex text-zinc-700">{o.vehiculo_matricula || "—"}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${est.cls}`}>{est.label}</span>
                      <span className="ml-auto tabular-nums font-medium text-zinc-900">{eur(o.total)}</span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Cortesías activas */}
      {(data.cortesias_activas || []).length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 mt-6" data-testid="cortesias-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-zinc-900 text-sm flex items-center gap-2"><Car size={16} weight="duotone" className="text-emerald-600" /> Vehículos de cortesía prestados
              {vencidas > 0 && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 ring-1 ring-red-200">{vencidas} vencida{vencidas > 1 ? "s" : ""}</span>}
            </h3>
            <button onClick={() => nav("/taller/cortesia")} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          <div className="divide-y divide-zinc-100">
            {data.cortesias_activas.map((p) => {
              const vencida = esVencida(p);
              return (
                <div key={p.id} className={`flex items-center gap-3 py-2 text-sm ${vencida ? "text-red-600" : ""}`} data-testid={`cortesia-item${vencida ? "-vencida" : ""}`}>
                  <span className="font-mono-plex font-medium">{p.vehiculo_matricula || "—"}</span>
                  <span className={`flex-1 truncate ${vencida ? "text-red-500" : "text-zinc-500"}`}>{p.cliente_nombre || "—"}</span>
                  {vencida && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 ring-1 ring-red-200">Vencida</span>}
                  <span className={`text-xs ${vencida ? "text-red-500 font-medium" : "text-zinc-400"}`}>Devolución: {p.fecha_devolucion_prevista || "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
