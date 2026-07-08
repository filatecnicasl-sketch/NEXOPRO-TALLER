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
            <Route path="/pedidos" element={<Documentos entidad="pedidos" key="pedidos" />} />
            <Route path="/albaranes" element={<Documentos entidad="albaranes" key="albaranes" />} />
            <Route path="/facturas-emitidas" element={<FacturasEmitidas />} />
            <Route path="/facturas-recibidas" element={<FacturasRecibidas />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
