import { useEffect, useState } from "react";

const PREFIX = "galpao:";

/** Lê um valor salvo no navegador (localStorage). Retorna o valor padrão se não existir ou der erro. */
export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Salva um valor no navegador (localStorage). Falha silenciosamente (ex.: modo privado, sem espaço). */
export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível — os dados continuam funcionando normalmente em memória.
  }
}

/** Apaga chaves do navegador. Usado quando o sistema passa a ler só o banco. */
export function removeFromStorage(...keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of keys) window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* modo privado */
  }
}

/**
 * Como `useState`, mas carrega o valor inicial do navegador (se existir) e salva automaticamente
 * a cada alteração. Assim, os dados sobrevivem a recarregar a página ou fechar e abrir o navegador —
 * sem precisar de nenhum servidor, API ou banco de dados.
 */
export function useLocalStorageState<T>(key: string, inicial: T | (() => T)) {
  const [state, setState] = useState<T>(() => {
    const valorPadrao = typeof inicial === "function" ? (inicial as () => T)() : inicial;
    return loadFromStorage<T>(key, valorPadrao);
  });

  useEffect(() => {
    saveToStorage(key, state);
  }, [key, state]);

  return [state, setState] as const;
}
