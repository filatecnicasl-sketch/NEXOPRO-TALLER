import { NavLink, Outlet, Link } from "react-router-dom";

const LOGO = "https://customer-assets.emergentagent.com/job_invoice-hub-861/artifacts/7wiurgv7_favicom.png";

const NAV = [
  { to: "/clientes", label: "Clientes", testid: "nav-clientes" },
  { to: "/proveedores", label: "Proveedores", testid: "nav-proveedores" },
  { to: "/articulos", label: "Artículos", testid: "nav-articulos" },
  { to: "/pedidos", label: "Pedidos", testid: "nav-pedidos" },
  { to: "/albaranes", label: "Albaranes", testid: "nav-albaranes" },
  { to: "/facturas-emitidas", label: "Facturas Emitidas", testid: "nav-facturas-emitidas" },
  { to: "/facturas-recibidas", label: "Facturas Recibidas", testid: "nav-facturas-recibidas" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200" data-testid="topbar">
        <div className="max-w-[1500px] mx-auto px-6">
          <div className="flex items-center h-16 gap-8">
            <Link to="/" data-testid="logo-home" className="flex items-center gap-2.5 shrink-0">
              <img src={LOGO} alt="NexoPro" className="h-9 w-9 object-contain" />
              <div className="leading-none">
                <div className="font-heading font-bold text-[17px] text-slate-900">NexoPro</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">ERP · Verifactu</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" data-testid="main-nav">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  data-testid={item.testid}
                  className={({ isActive }) =>
                    `whitespace-nowrap px-3 py-2 rounded-sm text-sm transition-colors duration-150 ${
                      isActive
                        ? "bg-accent text-primary font-medium"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Compatible Verifactu
            </div>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
