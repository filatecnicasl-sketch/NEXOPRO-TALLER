import "@/App.css";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import LicenseGate from "@/components/LicenseGate";
import Dashboard from "@/pages/Dashboard";
import FormatosEditor from "@/formatos/FormatosEditor";
import { getAjustes } from "@/lib/api";
import Contactos from "@/pages/Contactos";
import Articulos from "@/pages/Articulos";
import Documentos from "@/pages/Documentos";
import FacturasEmitidas from "@/pages/FacturasEmitidas";
import FacturasRecibidas from "@/pages/FacturasRecibidas";
import Ajustes from "@/pages/Ajustes";
import Vehiculos from "@/pages/Vehiculos";
import OrdenesTrabajo from "@/pages/OrdenesTrabajo";
import Peritajes from "@/pages/Peritajes";
import TallerDashboard from "@/pages/TallerDashboard";
import Citas from "@/pages/Citas";
import Cortesia from "@/pages/Cortesia";
import SubirFotos from "@/pages/SubirFotos";
import ConfirmarCita from "@/pages/ConfirmarCita";
import AdminLogin from "@/pages/AdminLogin";
import AdminPanel from "@/pages/AdminPanel";
import Login from "@/pages/Login";
import Usuarios from "@/pages/Usuarios";
import MiCuenta from "@/pages/MiCuenta";
import ForzarCambioPassword from "@/pages/ForzarCambioPassword";
import { AppAuthProvider, useAppAuth } from "@/lib/appAuth";
import { ArrowClockwise } from "@phosphor-icons/react";

// Gate de sesión de usuario del taller: exige login para usar el ERP.
function AppAuthGate({ children }) {
  const { user } = useAppAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="auth-checking">
        <div className="flex items-center gap-2 text-slate-400 text-sm"><ArrowClockwise size={18} className="animate-spin" /> Cargando…</div>
      </div>
    );
  }
  if (user === false) return <Login />;
  if (user.must_change_password) return <ForzarCambioPassword />;
  return children;
}

// Pantalla de inicio: respeta el "módulo de inicio" de Ajustes. Redirige a Taller una sola vez
// por sesión (así el usuario puede volver al Panel principal sin quedar atrapado en el bucle).
function Inicio() {
  const [estado, setEstado] = useState("checking");
  useEffect(() => {
    let cancel = false;
    if (sessionStorage.getItem("inicio_done")) { setEstado("panel"); return; }
    getAjustes()
      .then((a) => { if (!cancel) { sessionStorage.setItem("inicio_done", "1"); setEstado(a.modulo_inicio === "taller" ? "taller" : "panel"); } })
      .catch(() => { if (!cancel) setEstado("panel"); });
    return () => { cancel = true; };
  }, []);
  if (estado === "checking") return null;
  if (estado === "taller") return <Navigate to="/taller" replace />;
  return <Dashboard />;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppAuthProvider>
        <Routes>
          {/* Panel central (solo administrador) — fuera del gate de licencia */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminPanel />} />

          {/* Subida de fotos desde el móvil (pública, vía QR) — fuera del gate */}
          <Route path="/subir/:token" element={<SubirFotos />} />

          {/* Confirmar/cancelar cita desde el recordatorio (pública) — fuera del gate */}
          <Route path="/cita/:token" element={<ConfirmarCita />} />

          {/* Editor de formatos de impresión — a pantalla completa (fuera del Layout) */}
          <Route path="/ajustes/formatos" element={<LicenseGate><AppAuthGate><FormatosEditor /></AppAuthGate></LicenseGate>} />

          {/* Aplicación cliente — protegida por licencia + login de usuario */}
          <Route
            element={
              <LicenseGate>
                <AppAuthGate>
                  <Layout />
                </AppAuthGate>
              </LicenseGate>
            }
          >
            <Route path="/" element={<Inicio />} />
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
            <Route path="/ajustes/series" element={<Ajustes />} />
            <Route path="/ajustes/notificaciones" element={<Ajustes />} />
            <Route path="/ajustes/certificado" element={<Ajustes />} />
            <Route path="/ajustes/impresion" element={<Ajustes />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/mi-cuenta" element={<MiCuenta />} />

            {/* Módulo Taller (sectorial) */}
            <Route path="/taller" element={<TallerDashboard />} />
            <Route path="/taller/vehiculos" element={<Vehiculos />} />
            <Route path="/taller/ordenes" element={<OrdenesTrabajo />} />
            <Route path="/taller/peritajes" element={<Peritajes />} />
            <Route path="/taller/citas" element={<Citas />} />
            <Route path="/taller/cortesia" element={<Cortesia />} />
          </Route>
        </Routes>
        </AppAuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
