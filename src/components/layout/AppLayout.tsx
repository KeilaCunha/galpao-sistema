import { Leaf, Settings } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { SessaoTopo } from "../auth/SessaoTopo";

export function AppLayout() {
  const { pathname } = useLocation();
  const naFolha = pathname === "/";

  return (
    <div className="min-h-screen bg-neutral-100">
      {!naFolha && (
        <div className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex w-full max-w-[2400px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Leaf size={16} />
              </span>
              <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
                Voltar à folha
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {pathname !== "/configuracoes" && (
                <Link
                  to="/configuracoes"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  <Settings size={14} />
                  Administração
                </Link>
              )}
              <SessaoTopo />
            </div>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
