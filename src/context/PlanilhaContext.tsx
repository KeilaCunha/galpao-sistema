import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, checarBanco, consumirLiberacao, ErroApi, tokenLiberacao } from "../api/http";
import { idsPendentes, limparPendente, marcarPendente, ouvirSync, registrarVersao } from "../api/sync";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import type { DestinoEntrada, EntradaLancamento, LinhaPlanilha, PedidoCliente, SaidaLancamento } from "../types";
import {
  destinosDaFolhaNoDia,
  destinosDoEstoqueNoDia,
  migrarSaidasParaDestinos,
  montarLinhas,
  resumoDoDia,
  saidasDerivadas,
  sobrasPorDia,
  tipoPadraoDestino,
} from "../utils/alocacao";
import { destinoPersistivel } from "../utils/destino";
import { pedidoExistente, pedidoPersistivel } from "../utils/pedido";
import { toISODate } from "../utils/format";
import { generateId } from "../utils/id";
import { loadFromStorage, saveToStorage } from "../utils/storage";

export type StatusBanco = "conectando" | "vivo" | "local";

interface PlanilhaContextValue {
  entradas: EntradaLancamento[];
  pedidos: PedidoCliente[];
  dataInicial: string;
  usandoBanco: boolean;
  statusBanco: StatusBanco;
  entradaGravada: (id: string) => EntradaLancamento | undefined;
  getLinhas: (data: string) => LinhaPlanilha[];
  getSaidasDoDia: (data: string) => SaidaLancamento[];
  addEntrada: (dados: Omit<EntradaLancamento, "id">) => string;
  updateEntrada: (id: string, patch: Partial<Omit<EntradaLancamento, "id">>) => void;
  removeEntrada: (id: string) => void;
  addPedido: (dados: Omit<PedidoCliente, "id">) => string;
  removePedido: (id: string) => void;
  addDestino: (entradaId: string, destino: Omit<DestinoEntrada, "id">) => void;
  updateDestino: (entradaId: string, destinoId: string, patch: Partial<Omit<DestinoEntrada, "id">>) => void;
  removeDestino: (entradaId: string, destinoId: string) => void;
  garantirLinhasDoDia: (data: string, minimo?: number) => void;
  garantirDestinosDoDia: (
    entradaId: string,
    data: string,
    origem: "folha" | "estoque",
    minimo?: number,
  ) => void;
  resumo: (data: string) => ReturnType<typeof resumoDoDia>;
  sobras: () => ReturnType<typeof sobrasPorDia>;
}

const LINHAS_PADRAO = 12;
const LINHAS_DESTINO_PADRAO = 6;

function criarDestinosVazios(
  quantidade: number,
  data: string,
  origem: "folha" | "estoque",
  tipo: string,
): DestinoEntrada[] {
  return Array.from({ length: quantidade }, () => ({
    id: generateId("dest"),
    cliente: "",
    data,
    origem,
    tipo,
    boa: null,
    fraca: null,
    perda: null,
  }));
}

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
      (entrada.destinos ?? []).some(destinoPersistivel),
  );
}

function paraApi(entrada: EntradaLancamento): EntradaLancamento {
  return { ...entrada, destinos: (entrada.destinos ?? []).filter(destinoPersistivel) };
}

function completarLinhasVazias(
  lista: EntradaLancamento[],
  data: string,
  minimo = LINHAS_PADRAO,
): EntradaLancamento[] {
  const doDia = lista.filter((entrada) => entrada.data === data).length;
  if (doDia >= minimo) return lista;
  return [...lista, ...criarEntradasVazias(data, minimo - doDia)];
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

function mesclarPedidos(
  local: PedidoCliente[],
  remoto: PedidoCliente[],
  pendentes: Set<string>,
): PedidoCliente[] {
  const porId = new Map(remoto.map((pedido) => [pedido.id, pedido]));
  for (const id of pendentes) {
    const localPedido = local.find((pedido) => pedido.id === id);
    if (localPedido) porId.set(id, localPedido);
  }
  return [...porId.values()];
}

const PlanilhaContext = createContext<PlanilhaContextValue | undefined>(undefined);

export function PlanilhaProvider({ children }: { children: ReactNode }) {
  const { showError } = useToast();
  const { encerrarLiberacao } = useAuth();
  const [entradas, setEntradas] = useState<EntradaLancamento[]>(estadoInicialEntradas);
  const [pedidos, setPedidos] = useState<PedidoCliente[]>(() => loadFromStorage("pedidos-v1", []));
  const [statusBanco, setStatusBanco] = useState<StatusBanco>("conectando");
  const [gravadas, setGravadas] = useState<Record<string, EntradaLancamento>>({});
  const timers = useRef(new Map<string, number>());
  const bancoRef = useRef(false);
  const entradasRef = useRef(entradas);
  const pedidosRef = useRef(pedidos);
  const gravadasRef = useRef(gravadas);
  entradasRef.current = entradas;
  pedidosRef.current = pedidos;
  gravadasRef.current = gravadas;
  const usandoBanco = statusBanco === "vivo";

  function registrarGravadas(lista: EntradaLancamento[]) {
    const mapa: Record<string, EntradaLancamento> = {};
    for (const entrada of lista) {
      if (entradaPersistivel(entrada)) mapa[entrada.id] = paraApi(entrada);
    }
    setGravadas(mapa);
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const ok = await checarBanco();
      if (cancelado) return;
      if (!ok) {
        bancoRef.current = false;
        setStatusBanco("local");
        return;
      }
      try {
        const dados = await api.get<{ versao: number; entradas: EntradaLancamento[]; pedidos?: PedidoCliente[] }>(
          "/sync",
        );
        if (cancelado) return;
        bancoRef.current = true;
        registrarVersao(dados.versao);
        const doBanco = dados.entradas ?? [];
        const pedidosBanco = dados.pedidos ?? [];
        if (!cancelado) {
          setEntradas(completarLinhasVazias(doBanco, toISODate()));
          setPedidos(pedidosBanco);
          registrarGravadas(doBanco);
          setStatusBanco("vivo");
        }
      } catch {
        bancoRef.current = false;
        setStatusBanco("local");
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
      setPedidos((local) => mesclarPedidos(local, pacote.pedidos ?? [], idsPendentes()));
      setGravadas((prev) => {
        const next = { ...prev };
        const pendentes = idsPendentes();
        for (const entrada of pacote.entradas) {
          if (!pendentes.has(entrada.id) && entradaPersistivel(entrada)) next[entrada.id] = paraApi(entrada);
        }
        return next;
      });
    });
  }, [usandoBanco]);

  useEffect(() => {
    if (!usandoBanco) saveToStorage("lancamentos-entradas-v5", entradas);
  }, [entradas, usandoBanco]);

  useEffect(() => {
    if (!usandoBanco) saveToStorage("pedidos-v1", pedidos.filter(pedidoPersistivel));
  }, [pedidos, usandoBanco]);

  function agendarSalvar(entrada: EntradaLancamento) {
    if (!bancoRef.current) return;
    marcarPendente(entrada.id);
    const atual = timers.current.get(entrada.id);
    if (atual) window.clearTimeout(atual);
    if (!entradaPersistivel(entrada)) {
      void api
        .delete(`/entradas/${entrada.id}`)
        .then(() => {
          setGravadas((prev) => {
            const { [entrada.id]: _apagada, ...resto } = prev;
            return resto;
          });
        })
        .catch((erro) => {
          if (erro instanceof ErroApi && erro.status === 403) {
            const anterior = gravadasRef.current[entrada.id];
            if (anterior) setEntradas((prev) => prev.map((item) => (item.id === entrada.id ? anterior : item)));
            showError(erro.message);
          }
        })
        .finally(() => limparPendente(entrada.id));
      return;
    }
    timers.current.set(
      entrada.id,
      window.setTimeout(() => {
        const autorizacaoToken = tokenLiberacao(entrada.id);
        void api
          .put(`/entradas/${entrada.id}`, { ...paraApi(entrada), autorizacaoToken })
          .then(() => {
            if (autorizacaoToken) {
              consumirLiberacao(entrada.id);
              encerrarLiberacao(entrada.id);
            }
            setGravadas((prev) => ({ ...prev, [entrada.id]: paraApi(entrada) }));
          })
          .catch((erro) => {
            if (erro instanceof ErroApi && (erro.status === 403 || erro.status === 401)) {
              const anterior = gravadasRef.current[entrada.id];
              if (anterior) setEntradas((prev) => prev.map((item) => (item.id === entrada.id ? anterior : item)));
              showError(erro.message);
            }
          })
          .finally(() => limparPendente(entrada.id));
      }, 300),
    );
  }

  function agendarSalvarPedido(pedido: PedidoCliente) {
    if (!bancoRef.current) return;
    marcarPendente(pedido.id);
    const atual = timers.current.get(pedido.id);
    if (atual) window.clearTimeout(atual);
    if (!pedidoPersistivel(pedido)) {
      void api.delete(`/pedidos/${pedido.id}`).finally(() => limparPendente(pedido.id));
      return;
    }
    timers.current.set(
      pedido.id,
      window.setTimeout(() => {
        void api
          .put(`/pedidos/${pedido.id}`, pedido)
          .catch((erro) => {
            if (erro instanceof ErroApi) showError(erro.message);
          })
          .finally(() => limparPendente(pedido.id));
      }, 300),
    );
  }

  const saidas = useMemo(() => saidasDerivadas(entradas), [entradas]);

  const value = useMemo<PlanilhaContextValue>(
    () => ({
      entradas,
      pedidos,
      dataInicial: toISODate(),
      usandoBanco,
      statusBanco,
      entradaGravada: (id) => gravadas[id],
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
        const snapshot = gravadasRef.current[id];
        setEntradas((prev) => prev.filter((entrada) => entrada.id !== id));
        if (bancoRef.current) {
          marcarPendente(id);
          void api
            .delete(`/entradas/${id}`)
            .then(() => {
              setGravadas((prev) => {
                const { [id]: _apagada, ...resto } = prev;
                return resto;
              });
            })
            .catch((erro) => {
              if (snapshot) setEntradas((prev) => [...prev, snapshot]);
              if (erro instanceof ErroApi) showError(erro.message);
            })
            .finally(() => limparPendente(id));
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
      addPedido: (dados) => {
        const existente = pedidoExistente(
          pedidosRef.current,
          dados.data,
          dados.cliente,
          dados.mercadoria,
          dados.tipo,
        );
        if (existente) {
          const atualizado = { ...existente, qtd: existente.qtd + dados.qtd };
          setPedidos((prev) => prev.map((pedido) => (pedido.id === existente.id ? atualizado : pedido)));
          agendarSalvarPedido(atualizado);
          return existente.id;
        }
        const id = generateId("ped");
        const pedido: PedidoCliente = { ...dados, id };
        setPedidos((prev) => [...prev, pedido]);
        agendarSalvarPedido(pedido);
        return id;
      },
      removePedido: (id) => {
        const timer = timers.current.get(id);
        if (timer) window.clearTimeout(timer);
        timers.current.delete(id);
        setPedidos((prev) => prev.filter((pedido) => pedido.id !== id));
        if (bancoRef.current) {
          marcarPendente(id);
          void api.delete(`/pedidos/${id}`).finally(() => limparPendente(id));
        }
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
      garantirDestinosDoDia: (entradaId, data, origem, minimo = LINHAS_DESTINO_PADRAO) => {
        setEntradas((prev) => {
          const entrada = prev.find((item) => item.id === entradaId);
          if (!entrada) return prev;
          const atuais =
            origem === "estoque"
              ? destinosDoEstoqueNoDia(entrada, data)
              : destinosDaFolhaNoDia(entrada, data);
          const faltam = minimo - atuais.length;
          if (faltam <= 0) return prev;
          return prev.map((item) =>
            item.id === entradaId
              ? {
                  ...item,
                  destinos: [
                    ...(item.destinos ?? []),
                    ...criarDestinosVazios(faltam, data, origem, tipoPadraoDestino(item.mercadoria, origem, item)),
                  ],
                }
              : item,
          );
        });
      },
      resumo: (data) => resumoDoDia(entradas, data),
      sobras: () => sobrasPorDia(entradas),
    }),
    [entradas, pedidos, saidas, usandoBanco, statusBanco, gravadas],
  );

  return <PlanilhaContext.Provider value={value}>{children}</PlanilhaContext.Provider>;
}

export function usePlanilha(): PlanilhaContextValue {
  const ctx = useContext(PlanilhaContext);
  if (!ctx) throw new Error("usePlanilha deve ser usado dentro de PlanilhaProvider");
  return ctx;
}
