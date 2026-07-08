import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import LicenseGate from "@/components/LicenseGate";
import Dashboard from "@/pages/Dashboard";
import Contactos from "@/pages/Contactos";
import Articulos from "@/pages/Articulos";
import Documentos from "@/pages/Documentos";
import FacturasEmitidas from "@/pages/FacturasEmitidas";
import FacturasRecibidas from "@/pages/FacturasRecibidas";
import Ajustes from "@/pages/Ajustes";
import TallerPlaceholder from "@/pages/TallerPlaceholder";
import Vehiculos from "@/pages/Vehiculos";
import OrdenesTrabajo from "@/pages/OrdenesTrabajo";
import Peritajes from "@/pages/Peritajes";
import SubirFotos from "@/pages/SubirFotos";
import AdminLogin from "@/pages/AdminLogin";
import AdminPanel from "@/pages/AdminPanel";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Panel central (solo administrador) — fuera del gate de licencia */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminPanel />} />

          {/* Subida de fotos desde el móvil (pública, vía QR) — fuera del gate */}
          <Route path="/subir/:token" element={<SubirFotos />} />

          {/* Aplicación cliente — protegida por licencia */}
          <Route
            element={
              <LicenseGate>
                <Layout />
              </LicenseGate>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Contactos tipo="cliente" key="cliente" />} />
            <Route path="/proveedores" element={<Contactos tipo="proveedor" key="proveedor" />} />
            <Route path="/articulos" element={<Articulos />} />
            <Route path="/ventas/presupuestos" element={<Documentos entidad="presupuestos" operacion="venta" key="presupuestos-venta" />} />
            <Route path="/ventas/pedidos" element={<Documentos entidad="pedidos" operacion="venta" key="pedidos-venta" />} />
            <Route path="/ventas/albaranes" element={<Documentos entidad="albaranes" operacion="venta" key="albaranes-venta" />} />
            <Route path="/compras/pedidos" element={<Documentos entidad="pedidos" operacion="compra" key="pedidos-compra" />} />
            <Route path="/compras/albaranes" element={<Documentos entidad="albaranes" operacion="compra" key="albaranes-compra" />} />
            <Route path="/facturas-emitidas" element={<FacturasEmitidas />} />
            <Route path="/facturas-recibidas" element={<FacturasRecibidas />} />
            <Route path="/ajustes" element={<Ajustes />} />

            {/* Módulo Taller (sectorial) */}
            <Route path="/taller/vehiculos" element={<Vehiculos />} />
            <Route path="/taller/ordenes" element={<OrdenesTrabajo />} />
            <Route path="/taller/peritajes" element={<Peritajes />} />
            <Route path="/taller/citas" element={<TallerPlaceholder title="Citas" subtitle="Agenda de citas por vehículo" />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
