import { Moon, Sun } from "lucide-react";
import { useTema } from "../../context/TemaContext";

export function BotaoTema() {
  const { tema, definirTema } = useTema();

  return (
    <div
      className="inline-flex shrink-0 items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
      role="group"
      aria-label="Tema da tela"
    >
      <button
        type="button"
        onClick={() => definirTema("claro")}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition ${
          tema === "claro"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-neutral-500 hover:text-neutral-800"
        }`}
        aria-pressed={tema === "claro"}
        title="Tema claro"
      >
        <Sun size={13} strokeWidth={2.2} />
        Claro
      </button>
      <button
        type="button"
        onClick={() => definirTema("escuro")}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition ${
          tema === "escuro"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-neutral-500 hover:text-neutral-800"
        }`}
        aria-pressed={tema === "escuro"}
        title="Tema escuro"
      >
        <Moon size={13} strokeWidth={2.2} />
        Escuro
      </button>
    </div>
  );
}
