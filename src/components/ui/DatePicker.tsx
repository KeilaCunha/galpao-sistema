import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDate, toISODate } from "../../utils/format";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function partes(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano: ano || 2026, mes: (mes || 1) - 1, dia: dia || 1 };
}

function parseDataBr(valor: string): string | null {
  const match = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const dia = match[1].padStart(2, "0");
  const mes = match[2].padStart(2, "0");
  const ano = match[3];
  const iso = `${ano}-${mes}-${dia}`;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return toISODate(data) === iso ? iso : null;
}

export function DatePicker({
  label,
  value,
  onChange,
  children,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  children?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(() => formatDate(value));
  const [visao, setVisao] = useState(() => partes(value));
  const caixa = useRef<HTMLDivElement>(null);
  const hoje = toISODate();

  useEffect(() => {
    setTexto(formatDate(value));
  }, [value]);

  useEffect(() => {
    if (aberto) setVisao(partes(value));
  }, [aberto, value]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const primeiro = new Date(visao.ano, visao.mes, 1).getDay();
  const diasNoMes = new Date(visao.ano, visao.mes + 1, 0).getDate();

  function escolher(dia: number) {
    onChange(toISODate(new Date(visao.ano, visao.mes, dia)));
    setAberto(false);
  }

  function mudarMes(delta: number) {
    const proxima = new Date(visao.ano, visao.mes + delta, 1);
    setVisao({ ano: proxima.getFullYear(), mes: proxima.getMonth(), dia: 1 });
  }

  return (
    <div ref={caixa} className="relative">
      {label && (
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      )}
      {children ? (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="min-w-[190px] rounded-lg px-2 py-1 text-center hover:bg-neutral-50"
        >
          {children}
        </button>
      ) : (
        <div className="flex h-10 w-[10.5rem] items-center rounded-lg border border-neutral-200 bg-white focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <input
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-neutral-700 outline-none"
            inputMode="numeric"
            placeholder="01/11/2026"
            value={texto}
            onChange={(e) => {
              const valor = e.target.value;
              setTexto(valor);
              const parsed = parseDataBr(valor);
              if (parsed) onChange(parsed);
            }}
            onBlur={() => setTexto(formatDate(value))}
            onFocus={() => setAberto(false)}
          />
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="grid h-full w-9 place-items-center text-neutral-400 hover:text-brand-700"
            aria-label="Abrir calendário"
          >
            <CalendarDays size={16} />
          </button>
        </div>
      )}

      {aberto && (
        <div className={`absolute z-30 mt-2 w-[17.5rem] rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl ${children ? "left-1/2 -translate-x-1/2" : "left-0"}`}>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => mudarMes(-1)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="text-sm font-semibold capitalize text-neutral-800">
              {MESES[visao.mes]} {visao.ano}
            </p>
            <button
              type="button"
              onClick={() => mudarMes(1)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Próximo mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-neutral-400">
            {SEMANA.map((dia, i) => (
              <span key={`${dia}-${i}`} className="py-1">
                {dia}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 text-center text-sm">
            {Array.from({ length: primeiro }, (_, i) => (
              <span key={`vazio-${i}`} />
            ))}
            {Array.from({ length: diasNoMes }, (_, i) => {
              const dia = i + 1;
              const iso = toISODate(new Date(visao.ano, visao.mes, dia));
              const selecionado = iso === value;
              const ehHoje = iso === hoje;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => escolher(dia)}
                  className={`mx-auto my-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
                    selecionado
                      ? "bg-brand-600 font-semibold text-white"
                      : ehHoje
                        ? "font-semibold text-brand-700 ring-1 ring-brand-300"
                        : "text-neutral-700 hover:bg-brand-50"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(hoje);
              setAberto(false);
            }}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            Hoje
          </button>
        </div>
      )}
    </div>
  );
}
