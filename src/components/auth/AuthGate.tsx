import { Leaf } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { TelaAcesso } from "../../pages/TelaAcesso";

export function AuthGate({ children }: { children: ReactNode }) {
  const { fase } = useAuth();
  if (fase === "carregando") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-100">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Leaf size={20} className="animate-pulse" />
        </span>
        <p className="text-sm font-medium text-neutral-500">Carregando o galpão…</p>
      </div>
    );
  }
  if (fase === "login") return <TelaAcesso />;
  return <>{children}</>;
}
