import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { planilhaHojeMock } from "../data/mockData";
import type { LinhaPlanilha } from "../types";
import { addDays, toISODate } from "../utils/format";
import { generateId } from "../utils/id";
import { useLocalStorageState } from "../utils/storage";

const LINHAS_VAZIAS_PADRAO = 10;

function criarLinhaVazia(): LinhaPlanilha {
  return {
    id: generateId("linha"),
    produtor: "",
    qtd: null,
    mercadoria: "",
    preco: null,
    destinos: [],
  };
}

function criarLinhasVazias(quantidade: number): LinhaPlanilha[] {
  return Array.from({ length: Math.max(quantidade, 0) }, criarLinhaVazia);
}

interface SincronizarSobraParams {
  dataOrigem: string;
  linhaOrigemId: string;
  produtor: string;
  mercadoria: string;
  preco: number | null;
  /** Quantidade restante (0 quando não há mais sobra para esta linha) */
  sobra: number;
}

interface PlanilhaContextValue {
  getLinhas: (data: string) => LinhaPlanilha[];
  /** Lista (em ordem crescente) todas as datas que já têm alguma planilha carregada. */
  listarDatas: () => string[];
  garantirData: (data: string) => void;
  updateLinha: (data: string, id: string, patch: Partial<Omit<LinhaPlanilha, "id">>) => void;
  addLinha: (data: string) => void;
  removeLinha: (data: string, id: string) => void;
  /**
   * Mantém automaticamente, no dia seguinte, uma linha com a sobra (quantidade ainda
   * sem destino) de uma linha de origem. Cria, atualiza ou remove essa linha conforme
   * a sobra muda — sem exigir nenhuma ação manual do funcionário.
   */
  sincronizarSobra: (params: SincronizarSobraParams) => void;
}

const PlanilhaContext = createContext<PlanilhaContextValue | undefined>(undefined);

const hojeISO = toISODate();

export function PlanilhaProvider({ children }: { children: ReactNode }) {
  const [planilhas, setPlanilhas] = useLocalStorageState<Record<string, LinhaPlanilha[]>>("planilhas", () => ({
    [hojeISO]: [
      ...planilhaHojeMock,
      ...criarLinhasVazias(LINHAS_VAZIAS_PADRAO - planilhaHojeMock.length),
    ],
  }));

  const value = useMemo<PlanilhaContextValue>(
    () => ({
      getLinhas: (data) => planilhas[data] ?? [],
      listarDatas: () => Object.keys(planilhas).sort(),
      garantirData: (data) => {
        setPlanilhas((prev) => (prev[data] ? prev : { ...prev, [data]: criarLinhasVazias(LINHAS_VAZIAS_PADRAO) }));
      },
      updateLinha: (data, id, patch) => {
        setPlanilhas((prev) => {
          const linhas = prev[data] ?? criarLinhasVazias(LINHAS_VAZIAS_PADRAO);
          return {
            ...prev,
            [data]: linhas.map((linha) => (linha.id === id ? { ...linha, ...patch } : linha)),
          };
        });
      },
      addLinha: (data) => {
        setPlanilhas((prev) => {
          const linhas = prev[data] ?? criarLinhasVazias(LINHAS_VAZIAS_PADRAO);
          return { ...prev, [data]: [...linhas, criarLinhaVazia()] };
        });
      },
      removeLinha: (data, id) => {
        setPlanilhas((prev) => {
          const linhas = prev[data] ?? criarLinhasVazias(LINHAS_VAZIAS_PADRAO);
          return { ...prev, [data]: linhas.filter((linha) => linha.id !== id) };
        });
      },
      sincronizarSobra: ({ dataOrigem, linhaOrigemId, produtor, mercadoria, preco, sobra }) => {
        setPlanilhas((prev) => {
          const dataDestino = addDays(dataOrigem, 1);
          const linhasDestino = prev[dataDestino] ?? criarLinhasVazias(LINHAS_VAZIAS_PADRAO);
          const indiceExistente = linhasDestino.findIndex((linha) => linha.origemLinhaId === linhaOrigemId);

          // Não há mais sobra: remove a linha automática do dia seguinte,
          // mas só se o funcionário ainda não começou a preenchê-la (evita apagar trabalho).
          if (sobra <= 0) {
            if (indiceExistente === -1) return prev;
            const existente = linhasDestino[indiceExistente];
            const aindaIntocada = existente.destinos.length === 0;
            if (!aindaIntocada) return prev;
            return {
              ...prev,
              [dataDestino]: linhasDestino.filter((_, i) => i !== indiceExistente),
            };
          }

          // Ainda há sobra: cria (se não existir) ou atualiza a linha automática do dia seguinte.
          let linhasAtualizadas: LinhaPlanilha[];
          if (indiceExistente === -1) {
            const novaLinha: LinhaPlanilha = {
              ...criarLinhaVazia(),
              produtor,
              mercadoria,
              preco,
              qtd: sobra,
              origemSobraDe: dataOrigem,
              origemLinhaId: linhaOrigemId,
            };
            linhasAtualizadas = [...linhasDestino, novaLinha];
          } else {
            const existente = linhasDestino[indiceExistente];
            const semMudanca =
              existente.qtd === sobra && existente.produtor === produtor && existente.mercadoria === mercadoria;
            linhasAtualizadas = semMudanca
              ? linhasDestino
              : linhasDestino.map((linha, i) =>
                  i === indiceExistente ? { ...linha, produtor, mercadoria, preco, qtd: sobra } : linha,
                );
          }

          // Garante que toda linha de sobra automática fique sempre antes das demais linhas
          // (inclusive reordenando linhas já existentes, para quem tinha dados salvos de antes),
          // e que, havendo mais de uma sobra, elas apareçam da data mais antiga para a mais nova.
          const sobras = linhasAtualizadas
            .filter((linha) => linha.origemSobraDe)
            .sort((a, b) => (a.origemSobraDe as string).localeCompare(b.origemSobraDe as string));
          const semSobra = linhasAtualizadas.filter((linha) => !linha.origemSobraDe);
          const comSobraNoTopo = [...sobras, ...semSobra];

          const mudouAlgo =
            comSobraNoTopo.length !== linhasDestino.length ||
            comSobraNoTopo.some((linha, i) => linha !== linhasDestino[i]);

          if (!mudouAlgo) return prev;

          return { ...prev, [dataDestino]: comSobraNoTopo };
        });
      },
    }),
    [planilhas],
  );

  return <PlanilhaContext.Provider value={value}>{children}</PlanilhaContext.Provider>;
}

export function usePlanilha(): PlanilhaContextValue {
  const ctx = useContext(PlanilhaContext);
  if (!ctx) throw new Error("usePlanilha deve ser usado dentro de PlanilhaProvider");
  return ctx;
}

/** Garante que a data informada tenha linhas inicializadas assim que o componente montar/alterar. */
export function useGarantirDataPlanilha(data: string) {
  const { garantirData } = usePlanilha();
  useEffect(() => {
    garantirData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
}
