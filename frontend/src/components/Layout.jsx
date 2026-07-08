import { NavLink, Outlet, Link } from "react-router-dom";
import {
  UsersThree, Truck, Package, ClipboardText, FileText, Receipt, FileArrowDown,
  ShieldCheck, Gear, FileDashed, House,
} from "@phosphor-icons/react";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

const GROUPS = [
  {
    label: null,
    items: [
      { to: "/", label: "Panel", icon: House, testid: "nav-dashboard", end: true },
      { to: "/articulos", label: "Artículos", icon: Package, testid: "nav-articulos" },
    ],
  },
  {
    label: "Ventas",
    items: [
      { to: "/clientes", label: "Clientes", icon: UsersThree, testid: "nav-clientes" },
      { to: "/ventas/presupuestos", label: "Presupuestos", icon: FileDashed, testid: "nav-presupuestos" },
      { to: "/ventas/pedidos", label: "Pedidos", icon: ClipboardText, testid: "nav-pedidos-venta" },
      { to: "/ventas/albaranes", label: "Albaranes", icon: FileText, testid: "nav-albaranes-venta" },
      { to: "/facturas-emitidas", label: "Facturas", icon: Receipt, testid: "nav-facturas-emitidas" },
    ],
  },
  {
    label: "Compras",
    items: [
      { to: "/proveedores", label: "Proveedores", icon: Truck, testid: "nav-proveedores" },
      { to: "/compras/pedidos", label: "Pedidos", icon: ClipboardText, testid: "nav-pedidos-compra" },
      { to: "/compras/albaranes", label: "Albaranes", icon: FileText, testid: "nav-albaranes-compra" },
      { to: "/facturas-recibidas", label: "Facturas", icon: FileArrowDown, testid: "nav-facturas-recibidas" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/ajustes", label: "Ajustes", icon: Gear, testid: "nav-ajustes" },
    ],
  },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-zinc-200 flex flex-col z-30" data-testid="sidebar">
        <Link to="/" data-testid="logo-home" className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-100 shrink-0">
          <img src={LOGO} alt="NexoPro" className="h-8 w-8 object-contain" />
          <div className="leading-none">
            <div className="font-heading font-bold text-[16px] text-zinc-900">NexoPro</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 mt-0.5">ERP · Verifactu</div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {GROUPS.map((g, gi) => (
            <div key={g.label || `g-${gi}`}>
              {g.label && <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{g.label}</div>}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      data-testid={item.testid}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
                          isActive
                            ? "bg-accent text-primary font-medium"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={18} weight={isActive ? "fill" : "regular"} className={isActive ? "text-primary" : "text-zinc-400 group-hover:text-zinc-600"} />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-zinc-100">
          <div className="flex items-center gap-2 text-[11px] text-emerald-600">
            <ShieldCheck size={15} weight="fill" />
            <span className="text-zinc-500">Compatible <span className="text-zinc-700 font-medium">Verifactu</span></span>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
