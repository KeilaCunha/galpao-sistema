import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  tipoItem?: "fornecedor" | "produto" | "cliente";
}

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function acharCadastrado(texto: string, lista: string[]): string | undefined {
  const chave = semAcento(texto);
  if (!chave) return undefined;
  return lista.find((item) => semAcento(item) === chave);
}

function mensagemNaoCadastrado(nome: string, tipo?: AutocompleteProps["tipoItem"]): string {
  if (tipo === "produto") return `Produto "${nome}" não está cadastrado`;
  if (tipo === "cliente") return `Cliente "${nome}" não está cadastrado`;
  if (tipo === "fornecedor") return `Fornecedor "${nome}" não está cadastrado`;
  return `"${nome}" não está cadastrado`;
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
  tipoItem,
}: AutocompleteProps) {
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const [rascunho, setRascunho] = useState(value);
  const [aviso, setAviso] = useState("");
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const escolheuRef = useRef(false);

  useEffect(() => {
    setRascunho(value);
    if (sugestoes.length > 0 && value.trim() && !acharCadastrado(value, sugestoes)) {
      setAviso(mensagemNaoCadastrado(value.trim(), tipoItem));
    }
  }, [value, sugestoes, tipoItem]);

  const termo = rascunho.trim();
  const busca = semAcento(termo);
  const filtradas = busca
    ? sugestoes
        .filter((item) => semAcento(item).includes(busca))
        .sort((a, b) => {
          const aComeca = semAcento(a).startsWith(busca) ? 0 : 1;
          const bComeca = semAcento(b).startsWith(busca) ? 0 : 1;
          return aComeca - bComeca || a.localeCompare(b, "pt-BR");
        })
        .slice(0, 10)
    : [];

  const cadastrado = acharCadastrado(termo, sugestoes);
  const semCadastro = Boolean(busca && !cadastrado && filtradas.length === 0);
  const mostrar = aberto && (filtradas.length > 0 || semCadastro);
  const erro = error || aviso;

  useEffect(() => {
    setIndice(-1);
  }, [busca]);

  useLayoutEffect(() => {
    if (!mostrar) return;
    const ativo = listaRef.current?.children[indice] as HTMLElement | undefined;
    ativo?.scrollIntoView({ block: "nearest" });
  }, [indice, mostrar]);

  function escolher(item: string) {
    escolheuRef.current = true;
    setRascunho(item);
    setAviso("");
    onChange(item);
    setAberto(false);
  }

  function avisarEReverter(mensagem: string) {
    setAviso(mensagem);
    setRascunho(value);
    setAberto(false);
  }

  function limparCampo() {
    setAviso("");
    setRascunho("");
    if (value) onChange("");
    setAberto(false);
  }

  function confirmarComEnter() {
    if (!termo) {
      limparCampo();
      return;
    }
    if (cadastrado) {
      escolher(cadastrado);
      return;
    }
    const escolhido = indice >= 0 ? filtradas[indice] : filtradas[0];
    if (escolhido) {
      escolher(escolhido);
      return;
    }
    avisarEReverter(mensagemNaoCadastrado(termo, tipoItem));
  }

  function aoSair() {
    if (escolheuRef.current) {
      escolheuRef.current = false;
      return;
    }
    if (!termo) {
      limparCampo();
      return;
    }
    if (cadastrado) {
      escolher(cadastrado);
      return;
    }
    if (indice >= 0 && filtradas[indice]) {
      escolher(filtradas[indice]);
      return;
    }
    if (filtradas.length > 0) {
      avisarEReverter("Selecione um cadastro da lista");
      return;
    }
    avisarEReverter(mensagemNaoCadastrado(termo, tipoItem));
  }

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
  }, [mostrar, rascunho]);

  const campo = (
    <div className="relative">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        autoComplete="off"
        className={
          compact
            ? erro
              ? "h-9 w-full rounded-md bg-danger-50 px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:ring-2 focus:ring-danger-300"
              : "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300"
            : erro
              ? "h-10 w-full rounded-lg border border-danger-400 bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none transition focus:border-danger-400 focus:ring-4 focus:ring-danger-100"
              : "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        }
        value={rascunho}
        onChange={(e) => {
          escolheuRef.current = false;
          setRascunho(e.target.value);
          setAviso("");
          setAberto(true);
        }}
        onFocus={() => {
          if (rascunho.trim()) setAberto(true);
        }}
        onBlur={() => setTimeout(aoSair, 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setRascunho(value);
            setAviso("");
            setAberto(false);
            return;
          }
          if (!mostrar && e.key !== "Enter") return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (filtradas.length === 0) return;
            setIndice((atual) => (atual < 0 ? 0 : Math.min(atual + 1, filtradas.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (filtradas.length === 0) return;
            setIndice((atual) => (atual <= 0 ? filtradas.length - 1 : atual - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            confirmarComEnter();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {aviso && compact && (
        <p className="px-2 pt-0.5 text-[11px] font-medium leading-tight text-danger-500">{aviso}</p>
      )}
      {mostrar &&
        posicao &&
        createPortal(
          <div
            ref={listaRef}
            className="fixed z-[80] max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-xl"
            style={{ top: posicao.top, left: posicao.left, width: posicao.width }}
          >
            {semCadastro ? (
              <p className="px-3 py-2 text-sm font-medium text-danger-600">
                {mensagemNaoCadastrado(termo, tipoItem)}
              </p>
            ) : (
              filtradas.map((item, i) => (
                <button
                  key={item}
                  type="button"
                  onMouseEnter={() => setIndice(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(item);
                  }}
                  className={
                    i === indice
                      ? "flex w-full bg-brand-50 px-3 py-2 text-left text-sm text-neutral-800"
                      : "flex w-full px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-brand-50"
                  }
                >
                  {item}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );

  if (compact || !label) {
    if (compact || !aviso) return campo;
    return (
      <div>
        {campo}
        <p className="mt-1 text-xs font-medium text-danger-500">{aviso}</p>
      </div>
    );
  }

  return (
    <FieldWrapper label={label} required={required} error={erro} hint={hint}>
      {campo}
    </FieldWrapper>
  );
}
