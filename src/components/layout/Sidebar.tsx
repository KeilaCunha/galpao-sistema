import {
  LayoutDashboard,
  Leaf,
  Package,
  Settings,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../utils/cn";

const NAV_ITEMS = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/estoque", label: "Estoque", icon: Warehouse },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-neutral-100 px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-900/20">
          <Leaf size={20} strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-neutral-800">Galpão</p>
          <p className="text-[11px] font-medium text-neutral-400">Gestão de hortifrúti</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-900/15"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700",
              )
            }
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-neutral-100 px-3 py-4">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-600 text-white shadow-sm shadow-brand-900/15"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700",
            )
          }
        >
          <Settings size={18} strokeWidth={2} />
          Configurações
        </NavLink>
      </div>
    </aside>
  );
}
