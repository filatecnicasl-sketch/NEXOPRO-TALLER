import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  SquaresFour,
  UsersThree,
  Truck,
  ClipboardText,
  Receipt,
  FileArrowDown,
  FileText,
  Sparkle,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/", label: "Dashboard", icon: SquaresFour, testid: "sidebar-dashboard" },
  { to: "/clientes", label: "Clientes", icon: UsersThree, testid: "sidebar-clientes" },
  { to: "/proveedores", label: "Proveedores", icon: Truck, testid: "sidebar-proveedores" },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardText, testid: "sidebar-pedidos" },
  { to: "/albaranes", label: "Albaranes", icon: FileText, testid: "sidebar-albaranes" },
  { to: "/facturas-emitidas", label: "Facturas Emitidas", icon: Receipt, testid: "sidebar-facturas-emitidas" },
  { to: "/facturas-recibidas", label: "Facturas Recibidas", icon: FileArrowDown, testid: "sidebar-facturas-recibidas" },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col fixed h-screen" data-testid="sidebar">
        <div className="px-6 py-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
              <Sparkle weight="fill" className="text-white" size={18} />
            </div>
            <div>
              <div className="font-heading font-bold text-[15px] leading-none text-slate-900">Núcleo ERP</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Módulo base</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors duration-150 ${
                    isActive
                      ? "bg-accent text-primary font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={19} weight={location.pathname === item.to ? "fill" : "regular"} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Compatible Verifactu
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
