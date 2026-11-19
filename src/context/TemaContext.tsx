import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadFromStorage, saveToStorage } from "../utils/storage";

export type Tema = "claro" | "escuro";

type TemaContextValue = {
  tema: Tema;
  definirTema: (tema: Tema) => void;
};

const TemaContext = createContext<TemaContextValue | null>(null);
const CHAVE = "tema";

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  raiz.classList.toggle("dark", tema === "escuro");
  raiz.style.colorScheme = tema === "escuro" ? "dark" : "light";
}

export function lerTemaSalvo(): Tema {
  const salvo = loadFromStorage<Tema | null>(CHAVE, null);
  if (salvo === "escuro" || salvo === "claro") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const inicial = lerTemaSalvo();
    aplicarTema(inicial);
    return inicial;
  });

  useEffect(() => {
    aplicarTema(tema);
    saveToStorage(CHAVE, tema);
  }, [tema]);

  const valor = useMemo(() => ({ tema, definirTema: setTema }), [tema]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema precisa do TemaProvider");
  return ctx;
}
