import { useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const filtradas = value.trim()
    ? sugestoes.filter((item) => item.toLowerCase().includes(value.toLowerCase())).slice(0, 10)
    : sugestoes.slice(0, 10);

  const campo = (
    <div className="relative">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
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
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {aberto && filtradas.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
          {filtradas.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={() => {
                onChange(item);
                setAberto(false);
              }}
              className="flex w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-brand-50"
            >
              {item}
            </button>
          ))}
        </div>
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
