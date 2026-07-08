export const TIPOS_TRABAJO = [
  { value: "chapa", label: "Chapa" },
  { value: "pintura", label: "Pintura" },
  { value: "mecanica", label: "Mecánica" },
];

export const ESTADOS_OT = [
  { value: "recepcion", label: "Recepción", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "en_curso", label: "En curso", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "finalizado", label: "Finalizado", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { value: "entregado", label: "Entregado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
];

export function EstadoOTBadge({ estado }) {
  const e = ESTADOS_OT.find((x) => x.value === estado) || ESTADOS_OT[0];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${e.cls}`} data-testid={`estado-badge-${estado}`}>
      {e.label}
    </span>
  );
}
