import { useEffect } from "react";

import { NavLink, Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  UsersThree, Truck, Package, ClipboardText, FileText, Receipt, FileArrowDown,
  ShieldCheck, Gear, FileDashed, Wrench, Car, MagnifyingGlass, CalendarCheck, Gauge,
  SignOut, UserCircle, Buildings, Stack, BellRinging, Certificate, Printer,
} from "@phosphor-icons/react";
import { useAppAuth } from "@/lib/appAuth";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

const TONES = {
  indigo:  { chip: "bg-indigo-100 text-indigo-600",   solid: "bg-indigo-600 text-white",  txt: "text-indigo-600",  ring: "ring-indigo-200" },
  violet:  { chip: "bg-violet-100 text-violet-600",   solid: "bg-violet-600 text-white",  txt: "text-violet-600",  ring: "ring-violet-200" },
  emerald: { chip: "bg-emerald-100 text-emerald-600", solid: "bg-emerald-600 text-white", txt: "text-emerald-600", ring: "ring-emerald-200" },
  blue:    { chip: "bg-blue-100 text-blue-600",       solid: "bg-blue-600 text-white",    txt: "text-blue-600",    ring: "ring-blue-200" },
  amber:   { chip: "bg-amber-100 text-amber-600",     solid: "bg-amber-500 text-white",   txt: "text-amber-600",   ring: "ring-amber-200" },
  orange:  { chip: "bg-orange-100 text-orange-600",   solid: "bg-orange-500 text-white",  txt: "text-orange-600",  ring: "ring-orange-200" },
  cyan:    { chip: "bg-cyan-100 text-cyan-600",       solid: "bg-cyan-600 text-white",    txt: "text-cyan-600",    ring: "ring-cyan-200" },
  teal:    { chip: "bg-teal-100 text-teal-600",       solid: "bg-teal-600 text-white",    txt: "text-teal-600",    ring: "ring-teal-200" },
  rose:    { chip: "bg-rose-100 text-rose-600",       solid: "bg-rose-600 text-white",    txt: "text-rose-600",    ring: "ring-rose-200" },
  slate:   { chip: "bg-slate-200 text-slate-600",     solid: "bg-slate-600 text-white",   txt: "text-slate-600",   ring: "ring-slate-200" },
};

const MODULES = [
  {
    id: "articulos", label: "Artículos", icon: Package, tone: "violet",
    items: [
      { to: "/articulos", label: "Artículos", icon: Package, tone: "violet", testid: "nav-articulos" },
    ],
  },
  {
    id: "ventas", label: "Ventas", icon: Receipt, tone: "emerald",
    items: [
      { to: "/clientes", label: "Clientes", icon: UsersThree, tone: "emerald", testid: "nav-clientes" },
      { to: "/ventas/presupuestos", label: "Presupuestos", icon: FileDashed, tone: "cyan", testid: "nav-presupuestos" },
      { to: "/ventas/pedidos", label: "Pedidos", icon: ClipboardText, tone: "blue", testid: "nav-pedidos-venta" },
      { to: "/ventas/albaranes", label: "Albaranes", icon: FileText, tone: "teal", testid: "nav-albaranes-venta" },
      { to: "/facturas-emitidas", label: "Facturas", icon: Receipt, tone: "indigo", testid: "nav-facturas-emitidas" },
    ],
  },
  {
    id: "compras", label: "Compras", icon: Truck, tone: "amber",
    items: [
      { to: "/proveedores", label: "Proveedores", icon: Truck, tone: "amber", testid: "nav-proveedores" },
      { to: "/compras/pedidos", label: "Pedidos", icon: ClipboardText, tone: "blue", testid: "nav-pedidos-compra" },
      { to: "/compras/albaranes", label: "Albaranes", icon: FileText, tone: "teal", testid: "nav-albaranes-compra" },
      { to: "/facturas-recibidas", label: "Facturas", icon: FileArrowDown, tone: "orange", testid: "nav-facturas-recibidas" },
    ],
  },
  {
    id: "taller", label: "Taller", icon: Wrench, tone: "blue",
    items: [
      { to: "/taller", label: "Panel", icon: Gauge, tone: "indigo", testid: "nav-taller-panel", end: true },
      { to: "/taller/vehiculos", label: "Vehículos", icon: Car, tone: "blue", testid: "nav-taller-vehiculos" },
      { to: "/taller/ordenes", label: "Órdenes de trabajo", icon: Wrench, tone: "violet", testid: "nav-taller-ordenes" },
      { to: "/taller/peritajes", label: "Valoraciones", icon: MagnifyingGlass, tone: "amber", testid: "nav-taller-peritajes" },
      { to: "/taller/citas", label: "Citas", icon: CalendarCheck, tone: "emerald", testid: "nav-taller-citas" },
      { to: "/taller/cortesia", label: "Cortesía", icon: Car, tone: "rose", testid: "nav-taller-cortesia" },
    ],
  },
  {
    id: "ajustes", label: "Ajustes", icon: Gear, tone: "slate",
    items: [
      { to: "/ajustes", label: "Datos de empresa", icon: Buildings, tone: "slate", testid: "nav-ajustes-empresa", end: true },
      { to: "/ajustes/series", label: "Series", icon: Stack, tone: "indigo", testid: "nav-ajustes-series" },
      { to: "/ajustes/notificaciones", label: "Notificaciones", icon: BellRinging, tone: "amber", testid: "nav-ajustes-notificaciones" },
      { to: "/ajustes/certificado", label: "Certificado / FACe", icon: Certificate, tone: "emerald", testid: "nav-ajustes-certificado" },
      { to: "/ajustes/impresion", label: "Formatos", icon: Printer, tone: "blue", testid: "nav-ajustes-formatos" },
      { to: "/usuarios", label: "Usuarios", icon: UsersThree, tone: "violet", testid: "nav-ajustes-usuarios" },
    ],
  },
];

const matchItem = (pathname, item) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");

function UserMenu() {
  const { user, logout } = useAppAuth();
  const ROLE_LABEL = { admin: "Administrador", recepcion: "Recepción", operario: "Mecánico" };
  if (!user) return null;
  return (
    <div className="flex items-center gap-2" data-testid="user-menu">
      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-xs font-semibold text-zinc-800">{user.nombre || user.email}</span>
        <span className="text-[10px] text-zinc-400">{ROLE_LABEL[user.role] || user.role}</span>
      </div>
      <Link to="/mi-cuenta" data-testid="mi-cuenta-link" title="Mi cuenta" className="text-zinc-400 hover:text-primary transition-colors">
        <UserCircle size={26} weight="duotone" />
      </Link>
      <button data-testid="logout-button" onClick={logout} title="Cerrar sesión"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-500 border border-zinc-200 rounded-md px-2 py-1.5 transition-colors">
        <SignOut size={15} /> <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}


export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAppAuth();
  const isAdmin = user?.es_admin || user?.role === "admin";
  const allowed = isAdmin ? MODULES.map((m) => m.id) : (user?.permisos || []);
  const visibleModules = MODULES.filter((m) => isAdmin || (m.id !== "ajustes" && allowed.includes(m.id)));
  const homeRoute = visibleModules[0] ? visibleModules[0].items[0].to : "/mi-cuenta";
  const activeModule = MODULES.find((m) => m.items.some((it) => matchItem(pathname, it)));
  const ribbonModule = activeModule || visibleModules[0] || MODULES[0];

  // Control de acceso por permisos: redirige si el usuario abre un módulo no autorizado.
  useEffect(() => {
    if (!user || isAdmin) return;
    if (pathname === "/mi-cuenta") return;
    if (pathname === "/") { navigate(homeRoute, { replace: true }); return; }
    let modId;
    if (pathname.startsWith("/usuarios") || pathname.startsWith("/ajustes")) modId = "ajustes";
    else modId = MODULES.find((m) => m.items.some((it) => matchItem(pathname, it)))?.id;
    if (modId && !allowed.includes(modId)) navigate(homeRoute, { replace: true });
  }, [pathname, user, isAdmin]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 inset-x-0 z-30 bg-white border-b border-zinc-200 shadow-sm" data-testid="topbar">
        {/* Fila 1: marca + módulos */}
        <div className="flex items-center h-14 px-4 gap-6">
          <Link to="/" data-testid="logo-home" title="Ir al Panel" className="flex items-center gap-2.5 shrink-0">
            <img src={LOGO} alt="NexoPro" className="h-8 w-8 object-contain" />
            <div className="leading-none hidden sm:block">
              <div className="font-heading font-bold text-[16px] text-zinc-900">NexoPro</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 mt-0.5">ERP · Verifactu</div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto" data-testid="module-tabs">
            {visibleModules.map((m) => {
              const Icon = m.icon;
              const isActive = activeModule?.id === m.id;
              const tone = TONES[m.tone] || TONES.indigo;
              return (
                <button
                  key={m.id}
                  data-testid={`module-tab-${m.id}`}
                  onClick={() => navigate(m.items[0].to)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Icon size={19} weight={isActive ? "fill" : "duotone"} className={isActive ? "" : tone.txt} />
                  {m.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-[11px]">
              <ShieldCheck size={15} weight="fill" className="text-emerald-600" />
              <span className="text-zinc-500">Compatible <span className="text-zinc-700 font-medium">Verifactu</span></span>
            </div>
            <UserMenu />
          </div>
        </div>

        {/* Fila 2: ribbon de iconos del módulo activo */}
        <div className="bg-zinc-50 border-t border-zinc-100 px-3">
          <div className="flex items-stretch gap-1.5 py-2 overflow-x-auto" data-testid={`ribbon-${ribbonModule.id}`}>
            {ribbonModule.items.map((item) => {
              const Icon = item.icon;
              const tone = TONES[item.tone] || TONES.indigo;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-testid={item.testid}
                  className={({ isActive }) =>
                    `group flex flex-col items-center justify-center gap-1.5 min-w-[104px] px-3 py-1.5 rounded-xl transition-all duration-150 ${
                      isActive ? `bg-white shadow-sm ring-1 ${tone.ring}` : "hover:bg-white/70"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors duration-150 ${isActive ? `${tone.solid} shadow` : `${tone.chip} group-hover:brightness-95`}`}>
                        <Icon size={32} weight="duotone" />
                      </span>
                      <span className={`text-xs font-semibold leading-tight text-center ${isActive ? tone.txt : "text-zinc-600"}`}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </header>

      <main className="pt-[10.75rem] min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
