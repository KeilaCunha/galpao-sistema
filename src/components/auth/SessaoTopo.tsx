import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function SessaoTopo() {
  const { usuario, logout } = useAuth();
  if (!usuario) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-1 pr-1 pl-3">
      <p className="text-sm font-semibold text-neutral-800">
        Olá, {usuario.nome}
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <LogOut size={14} />
        Sair
      </button>
    </div>
  );
}
