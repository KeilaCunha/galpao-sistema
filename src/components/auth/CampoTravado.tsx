import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export function CampoTravado({
  travado,
  onLiberar,
  children,
}: {
  travado: boolean;
  onLiberar: () => void;
  children: ReactNode;
}) {
  if (!travado) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-70">{children}</div>
      <button
        type="button"
        onClick={onLiberar}
        className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/70 text-neutral-500 transition hover:bg-brand-50/80 hover:text-brand-700"
        title="Já gravado. Clique para o responsável liberar."
      >
        <Lock size={13} />
      </button>
    </div>
  );
}
