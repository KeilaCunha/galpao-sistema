import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FieldWrapper } from "./FormField";

interface AutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  sugestoes: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
}

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function Autocomplete({
  label,
  value,
  onChange,
  sugestoes,
  placeholder,
  required,
  error,
  hint,
  disabled,
  compact,
  autoFocus,
}: AutocompleteProps) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const termo = value.trim();
  const busca = semAcento(termo);
  const filtradas = busca
    ? sugestoes
        .filter((item) => {
          const nome = semAcento(item);
          return nome.includes(busca) && nome !== busca;
        })
        .sort((a, b) => {
          const aComeca = semAcento(a).startsWith(busca) ? 0 : 1;
          const bComeca = semAcento(b).startsWith(busca) ? 0 : 1;
          return aComeca - bComeca || a.localeCompare(b, "pt-BR");
        })
        .slice(0, 10)
    : [];

  const mostrar = aberto && filtradas.length > 0;

  useLayoutEffect(() => {
    if (!mostrar) return;
    const atualizar = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPosicao({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
    };
    atualizar();
    window.addEventListener("scroll", atualizar, true);
    window.addEventListener("resize", atualizar);
    return () => {
      window.removeEventListener("scroll", atualizar, true);
      window.removeEventListener("resize", atualizar);
    };
  }, [mostrar, value]);

  const campo = (
    <div className="relative">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        autoComplete="off"
        className={
          compact
            ? "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300"
            : "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        }
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => {
          if (value.trim()) setAberto(true);
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {mostrar &&
        posicao &&
        createPortal(
          <div
            className="fixed z-[80] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
            style={{ top: posicao.top, left: posicao.left, width: posicao.width }}
          >
            {filtradas.map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item);
                  setAberto(false);
                }}
                className="flex w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-brand-50"
              >
                {item}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );

  if (compact || !label) return campo;

  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint}>
      {campo}
    </FieldWrapper>
  );
}
