import { CalendarDays, ChevronDown, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getRouteInfo } from "../../routes";

const hoje = new Date();
const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(hoje);

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Header() {
  const location = useLocation();
  const route = getRouteInfo(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-neutral-200 bg-white/90 px-6 backdrop-blur">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-800">{route.title}</p>
        <p className="truncate text-xs text-neutral-400">{route.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 md:flex">
          <CalendarDays size={15} className="text-brand-600" />
          {capitalize(dataFormatada)}
        </div>

        <div className="h-8 w-px bg-neutral-200" />

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-100"
          aria-label="Perfil do usuário"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <User size={16} strokeWidth={2.2} />
          </span>
          <ChevronDown size={15} className="hidden text-neutral-400 sm:block" />
        </button>
      </div>
    </header>
  );
}
