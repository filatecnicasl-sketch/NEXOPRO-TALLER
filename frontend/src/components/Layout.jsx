import { NavLink, Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  UsersThree, Truck, Package, ClipboardText, FileText, Receipt, FileArrowDown,
  ShieldCheck, Gear, FileDashed, Wrench, Car, MagnifyingGlass, CalendarCheck,
} from "@phosphor-icons/react";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

const MODULES = [
  {
    id: "articulos",
    label: "Artículos",
    icon: Package,
    items: [
      { to: "/articulos", label: "Artículos", icon: Package, testid: "nav-articulos" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: Receipt,
    items: [
      { to: "/clientes", label: "Clientes", icon: UsersThree, testid: "nav-clientes" },
      { to: "/ventas/presupuestos", label: "Presupuestos", icon: FileDashed, testid: "nav-presupuestos" },
      { to: "/ventas/pedidos", label: "Pedidos", icon: ClipboardText, testid: "nav-pedidos-venta" },
      { to: "/ventas/albaranes", label: "Albaranes", icon: FileText, testid: "nav-albaranes-venta" },
      { to: "/facturas-emitidas", label: "Facturas", icon: Receipt, testid: "nav-facturas-emitidas" },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icon: Truck,
    items: [
      { to: "/proveedores", label: "Proveedores", icon: Truck, testid: "nav-proveedores" },
      { to: "/compras/pedidos", label: "Pedidos", icon: ClipboardText, testid: "nav-pedidos-compra" },
      { to: "/compras/albaranes", label: "Albaranes", icon: FileText, testid: "nav-albaranes-compra" },
      { to: "/facturas-recibidas", label: "Facturas", icon: FileArrowDown, testid: "nav-facturas-recibidas" },
    ],
  },
  {
    id: "taller",
    label: "Taller",
    icon: Wrench,
    items: [
      { to: "/taller/vehiculos", label: "Vehículos", icon: Car, testid: "nav-taller-vehiculos" },
      { to: "/taller/ordenes", label: "Órdenes de trabajo", icon: Wrench, testid: "nav-taller-ordenes" },
      { to: "/taller/peritajes", label: "Peritajes", icon: MagnifyingGlass, testid: "nav-taller-peritajes" },
      { to: "/taller/citas", label: "Citas", icon: CalendarCheck, testid: "nav-taller-citas" },
      { to: "/taller/cortesia", label: "Cortesía", icon: Car, testid: "nav-taller-cortesia" },
    ],
  },
  {
    id: "ajustes",
    label: "Ajustes",
    icon: Gear,
    items: [
      { to: "/ajustes", label: "Ajustes", icon: Gear, testid: "nav-ajustes" },
    ],
  },
];

const matchItem = (pathname, item) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeModule = MODULES.find((m) => m.items.some((it) => matchItem(pathname, it)));
  const ribbonModule = activeModule || MODULES[0];

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
            {MODULES.map((m) => {
              const Icon = m.icon;
              const isActive = activeModule?.id === m.id;
              return (
                <button
                  key={m.id}
                  data-testid={`module-tab-${m.id}`}
                  onClick={() => navigate(m.items[0].to)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Icon size={17} weight={isActive ? "fill" : "regular"} />
                  {m.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2 text-[11px] shrink-0">
            <ShieldCheck size={15} weight="fill" className="text-emerald-600" />
            <span className="text-zinc-500">Compatible <span className="text-zinc-700 font-medium">Verifactu</span></span>
          </div>
        </div>

        {/* Fila 2: ribbon de iconos del módulo activo */}
        <div className="bg-zinc-50 border-t border-zinc-100 px-3">
          <div className="flex items-stretch gap-1 py-1.5 overflow-x-auto" data-testid={`ribbon-${ribbonModule.id}`}>
            {ribbonModule.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-testid={item.testid}
                  className={({ isActive }) =>
                    `group flex flex-col items-center justify-center gap-1 min-w-[80px] px-3 py-1.5 rounded-md transition-colors duration-150 ${
                      isActive
                        ? "bg-white text-primary shadow-sm ring-1 ring-indigo-100"
                        : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={22} weight={isActive ? "fill" : "regular"} className={isActive ? "text-primary" : "text-zinc-400 group-hover:text-zinc-600"} />
                      <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </header>

      <main className="pt-[7.25rem] min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
