import { createContext, useContext, useMemo, type ReactNode } from "react";
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
import { loadFromStorage, useLocalStorageState } from "../utils/storage";

interface PlanilhaContextValue {
  entradas: EntradaLancamento[];
  dataInicial: string;
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

const PlanilhaContext = createContext<PlanilhaContextValue | undefined>(undefined);

export function PlanilhaProvider({ children }: { children: ReactNode }) {
  const [entradas, setEntradas] = useLocalStorageState<EntradaLancamento[]>(
    "lancamentos-entradas-v5",
    estadoInicialEntradas,
  );

  const saidas = useMemo(() => saidasDerivadas(entradas), [entradas]);

  const value = useMemo<PlanilhaContextValue>(
    () => ({
      entradas,
      dataInicial: toISODate(),
      getLinhas: (data) => montarLinhas(entradas, data),
      getSaidasDoDia: (data) => saidas.filter((saida) => saida.data === data),
      addEntrada: (dados) => {
        const id = generateId("ent");
        setEntradas((prev) => [...prev, { destinos: [], ...dados, id }]);
        return id;
      },
      updateEntrada: (id, patch) => {
        setEntradas((prev) => prev.map((entrada) => (entrada.id === id ? { ...entrada, ...patch } : entrada)));
      },
      removeEntrada: (id) => setEntradas((prev) => prev.filter((entrada) => entrada.id !== id)),
      addDestino: (entradaId, destino) => {
        setEntradas((prev) =>
          prev.map((entrada) =>
            entrada.id === entradaId
              ? { ...entrada, destinos: [...(entrada.destinos ?? []), { ...destino, id: generateId("dest") }] }
              : entrada,
          ),
        );
      },
      updateDestino: (entradaId, destinoId, patch) => {
        setEntradas((prev) =>
          prev.map((entrada) =>
            entrada.id === entradaId
              ? {
                  ...entrada,
                  destinos: (entrada.destinos ?? []).map((destino) =>
                    destino.id === destinoId ? { ...destino, ...patch } : destino,
                  ),
                }
              : entrada,
          ),
        );
      },
      removeDestino: (entradaId, destinoId) => {
        setEntradas((prev) =>
          prev.map((entrada) =>
            entrada.id === entradaId
              ? { ...entrada, destinos: (entrada.destinos ?? []).filter((destino) => destino.id !== destinoId) }
              : entrada,
          ),
        );
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
    [entradas, saidas],
  );

  return <PlanilhaContext.Provider value={value}>{children}</PlanilhaContext.Provider>;
}

export function usePlanilha(): PlanilhaContextValue {
  const ctx = useContext(PlanilhaContext);
  if (!ctx) throw new Error("usePlanilha deve ser usado dentro de PlanilhaProvider");
  return ctx;
}
