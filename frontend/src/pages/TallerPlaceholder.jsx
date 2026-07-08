import PageHeader from "@/components/PageHeader";
import { Wrench } from "@phosphor-icons/react";

export default function TallerPlaceholder({ title, subtitle }) {
  return (
    <div className="p-8 max-w-[1400px]" data-testid="taller-placeholder">
      <PageHeader title={title} subtitle={subtitle} chip="Taller" />
      <div className="bg-white border border-dashed border-zinc-300 rounded-lg p-16 flex flex-col items-center justify-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4">
          <Wrench size={28} weight="duotone" />
        </span>
        <h3 className="font-heading text-lg font-semibold text-zinc-800">Módulo en construcción</h3>
        <p className="text-sm text-zinc-500 mt-1.5 max-w-md">
          Esta sección del módulo de Taller se activará en cuanto definamos el formato del formulario.
        </p>
      </div>
    </div>
  );
}
