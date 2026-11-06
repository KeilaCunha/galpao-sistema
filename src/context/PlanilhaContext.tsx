import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, checarBanco } from "../api/http";
import { idsPendentes, limparPendente, marcarPendente, ouvirSync, registrarVersao } from "../api/sync";
import type { DestinoEntrada, EntradaLancamento, LinhaPlanilha, SaidaLancamento } from "../types";
import {
  migrarSaidasParaDestinos,
  montarLinhas,
  resumoDoDia,
  saidasDerivadas,
  sobrasPorDia,
} from "../utils/alocacao";
import { toISODate } from "../utils/format";
import { generateId } from "../utils/id";
import { loadFromStorage, saveToStorage } from "../utils/storage";

interface PlanilhaContextValue {
  entradas: EntradaLancamento[];
  dataInicial: string;
  usandoBanco: boolean;
  getLinhas: (data: string) => LinhaPlanilha[];
  getSaidasDoDia: (data: string) => SaidaLancamento[];
  addEntrada: (dados: Omit<EntradaLancamento, "id">) => string;
  updateEntrada: (id: string, patch: Partial<Omit<EntradaLancamento, "id">>) => void;
  removeEntrada: (id: string) => void;
  addDestino: (entradaId: string, destino: Omit<DestinoEntrada, "id">) => void;
  updateDestino: (entradaId: string, destinoId: string, patch: Partial<Omit<DestinoEntrada, "id">>) => void;
  removeDestino: (entradaId: string, destinoId: string) => void;
  garantirLinhasDoDia: (data: string, minimo?: number) => void;
  resumo: (data: string) => ReturnType<typeof resumoDoDia>;
  sobras: () => ReturnType<typeof sobrasPorDia>;
}

const LINHAS_PADRAO = 5;

function criarEntradasVazias(data: string, quantidade: number): EntradaLancamento[] {
  return Array.from({ length: quantidade }, () => ({
    id: generateId("ent"),
    data,
    produtor: "",
    mercadoria: "",
    qtd: 0,
    preco: null,
    precoFraco: null,
    destinos: [],
  }));
}

function estadoInicialEntradas(): EntradaLancamento[] {
  const v5 = loadFromStorage<EntradaLancamento[] | null>("lancamentos-entradas-v5", null);
  if (v5 && Array.isArray(v5) && v5.length > 0) {
    return v5.map((entrada) => ({ ...entrada, destinos: entrada.destinos ?? [] }));
  }
  const v4e = loadFromStorage<EntradaLancamento[]>("lancamentos-entradas-v4", []);
  const v4s = loadFromStorage<SaidaLancamento[]>("lancamentos-saidas-v4", []);
  if (v4e.length > 0 || v4s.length > 0) {
    return migrarSaidasParaDestinos(v4e, v4s);
  }
  return criarEntradasVazias(toISODate(), LINHAS_PADRAO);
}

function entradaPersistivel(entrada: EntradaLancamento): boolean {
  return Boolean(
    entrada.produtor.trim() ||
      entrada.mercadoria.trim() ||
      entrada.qtd > 0 ||
      (entrada.preco != null && entrada.preco > 0) ||
      (entrada.precoFraco != null && entrada.precoFraco > 0) ||
      (entrada.destinos?.length ?? 0) > 0,
  );
}

function mesclarEntradas(
  local: EntradaLancamento[],
  remoto: EntradaLancamento[],
  pendentes: Set<string>,
): EntradaLancamento[] {
  const porId = new Map(remoto.map((entrada) => [entrada.id, entrada]));
  for (const id of pendentes) {
    const localEntrada = local.find((entrada) => entrada.id === id);
    if (localEntrada) porId.set(id, localEntrada);
  }
  const vazias = local.filter((entrada) => !entradaPersistivel(entrada) && !porId.has(entrada.id));
  return [...porId.values(), ...vazias];
}

const PlanilhaContext = createContext<PlanilhaContextValue | undefined>(undefined);

export function PlanilhaProvider({ children }: { children: ReactNode }) {
  const [entradas, setEntradas] = useState<EntradaLancamento[]>(estadoInicialEntradas);
  const [usandoBanco, setUsandoBanco] = useState(false);
  const timers = useRef(new Map<string, number>());
  const bancoRef = useRef(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const ok = await checarBanco();
      if (cancelado) return;
      if (!ok) {
        bancoRef.current = false;
        setUsandoBanco(false);
        return;
      }
      try {
        const dados = await api.get<{ versao: number; entradas: EntradaLancamento[] }>("/sync");
        if (cancelado) return;
        bancoRef.current = true;
        registrarVersao(dados.versao);
        const doBanco = dados.entradas ?? [];
        const locais = estadoInicialEntradas().filter(entradaPersistivel);
        if (doBanco.length === 0 && locais.length > 0) {
          await Promise.all(locais.map((entrada) => api.put(`/entradas/${entrada.id}`, entrada)));
          if (!cancelado) setEntradas(locais);
        } else {
          setEntradas(doBanco);
        }
        if (!cancelado) setUsandoBanco(true);
      } catch {
        bancoRef.current = false;
        setUsandoBanco(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!usandoBanco) return;
    return ouvirSync((pacote) => {
      setEntradas((local) => mesclarEntradas(local, pacote.entradas, idsPendentes()));
    });
  }, [usandoBanco]);

  useEffect(() => {
    if (!usandoBanco) saveToStorage("lancamentos-entradas-v5", entradas);
  }, [entradas, usandoBanco]);

  function agendarSalvar(entrada: EntradaLancamento) {
    if (!bancoRef.current) return;
    marcarPendente(entrada.id);
    const atual = timers.current.get(entrada.id);
    if (atual) window.clearTimeout(atual);
    if (!entradaPersistivel(entrada)) {
      void api.delete(`/entradas/${entrada.id}`).finally(() => limparPendente(entrada.id));
      return;
    }
    timers.current.set(
      entrada.id,
      window.setTimeout(() => {
        void api.put(`/entradas/${entrada.id}`, entrada).finally(() => limparPendente(entrada.id));
      }, 300),
    );
  }

  const saidas = useMemo(() => saidasDerivadas(entradas), [entradas]);

  const value = useMemo<PlanilhaContextValue>(
    () => ({
      entradas,
      dataInicial: toISODate(),
      usandoBanco,
      getLinhas: (data) => montarLinhas(entradas, data),
      getSaidasDoDia: (data) => saidas.filter((saida) => saida.data === data),
      addEntrada: (dados) => {
        const id = generateId("ent");
        const entrada: EntradaLancamento = { destinos: [], ...dados, id };
        setEntradas((prev) => [...prev, entrada]);
        agendarSalvar(entrada);
        return id;
      },
      updateEntrada: (id, patch) => {
        setEntradas((prev) => {
          const proxima = prev.map((entrada) => (entrada.id === id ? { ...entrada, ...patch } : entrada));
          const atualizada = proxima.find((entrada) => entrada.id === id);
          if (atualizada) agendarSalvar(atualizada);
          return proxima;
        });
      },
      removeEntrada: (id) => {
        const timer = timers.current.get(id);
        if (timer) window.clearTimeout(timer);
        timers.current.delete(id);
        setEntradas((prev) => prev.filter((entrada) => entrada.id !== id));
        if (bancoRef.current) {
          marcarPendente(id);
          void api.delete(`/entradas/${id}`).finally(() => limparPendente(id));
        }
      },
      addDestino: (entradaId, destino) => {
        const novo = { ...destino, id: generateId("dest") };
        setEntradas((prev) => {
          const proxima = prev.map((entrada) =>
            entrada.id === entradaId
              ? { ...entrada, destinos: [...(entrada.destinos ?? []), novo] }
              : entrada,
          );
          const atualizada = proxima.find((entrada) => entrada.id === entradaId);
          if (atualizada) agendarSalvar(atualizada);
          return proxima;
        });
      },
      updateDestino: (entradaId, destinoId, patch) => {
        setEntradas((prev) => {
          const proxima = prev.map((entrada) =>
            entrada.id === entradaId
              ? {
                  ...entrada,
                  destinos: (entrada.destinos ?? []).map((destino) =>
                    destino.id === destinoId ? { ...destino, ...patch } : destino,
                  ),
                }
              : entrada,
          );
          const atualizada = proxima.find((entrada) => entrada.id === entradaId);
          if (atualizada) agendarSalvar(atualizada);
          return proxima;
        });
      },
      removeDestino: (entradaId, destinoId) => {
        setEntradas((prev) => {
          const proxima = prev.map((entrada) =>
            entrada.id === entradaId
              ? { ...entrada, destinos: (entrada.destinos ?? []).filter((destino) => destino.id !== destinoId) }
              : entrada,
          );
          const atualizada = proxima.find((entrada) => entrada.id === entradaId);
          if (atualizada) agendarSalvar(atualizada);
          return proxima;
        });
      },
      garantirLinhasDoDia: (data, minimo = LINHAS_PADRAO) => {
        setEntradas((prev) => {
          const doDia = prev.filter((entrada) => entrada.data === data).length;
          if (doDia >= minimo) return prev;
          return [...prev, ...criarEntradasVazias(data, minimo - doDia)];
        });
      },
      resumo: (data) => resumoDoDia(entradas, data),
      sobras: () => sobrasPorDia(entradas),
    }),
    [entradas, saidas, usandoBanco],
  );

  return <PlanilhaContext.Provider value={value}>{children}</PlanilhaContext.Provider>;
}

export function usePlanilha(): PlanilhaContextValue {
  const ctx = useContext(PlanilhaContext);
  if (!ctx) throw new Error("usePlanilha deve ser usado dentro de PlanilhaProvider");
  return ctx;
}
