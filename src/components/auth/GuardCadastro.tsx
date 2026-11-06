import { Shield } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function GuardCadastro({ children }: { children: ReactNode }) {
  const { pode } = useAuth();
  if (pode("cadastros")) return <>{children}</>;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Shield className="mx-auto mb-3 text-neutral-300" size={36} />
      <p className="text-sm font-medium text-neutral-600">Você não tem acesso aos cadastros.</p>
      <p className="mt-1 text-xs text-neutral-400">Peça para o responsável liberar essa parte em Configurações.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
        Voltar à folha
      </Link>
    </div>
  );
}
