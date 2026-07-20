import MiCuentaCard from "@/components/MiCuentaCard";
import PageHeader from "@/components/PageHeader";

export default function MiCuenta() {
  return (
    <div className="p-8 max-w-[900px]" data-testid="mi-cuenta-page">
      <PageHeader title="Mi cuenta" subtitle="Gestiona tu contraseña y la verificación en dos pasos" />
      <MiCuentaCard />
    </div>
  );
}
