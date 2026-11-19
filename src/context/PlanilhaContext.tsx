import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, apiRemota, checarBanco, consumirLiberacao, ErroApi, tokenLiberacao } from "../api/http";
import { idsPendentes, limparPendente, marcarPendente, ouvirSync, registrarVersao } from "../api/sync";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import type {
  DestinoEntrada,
  EntradaLancamento,
  LinhaPlanilha,
  MovimentoCaixa,
  PedidoCliente,
  PrevisaoFornecedor,
  SaidaLancamento,
  TipoCaixa,
} from "../types";
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
import {
  caixaPersistivel,
  ehTipoCaixaPadrao,
  mesmaPessoa,
  mesmoTipoCaixa,
  tipoCaixaDaEntrada,
  tipoCaixaPersistivel,
} from "../utils/caixas";
import { destinoPersistivel } from "../utils/destino";
import { previsaoExistente, previsaoPersistivel } from "../utils/analise";
import { mesmaChave, pedidoExistente, pedidoPersistivel } from "../utils/pedido";
import { toISODate } from "../utils/format";
import { generateId } from "../utils/id";
import { loadFromStorage, removeFromStorage, saveToStorage } from "../utils/storage";

export type StatusBanco = "conectando" | "vivo" | "local";

interface PlanilhaContextValue {
  entradas: EntradaLancamento[];
  pedidos: PedidoCliente[];
  previsoes: PrevisaoFornecedor[];
  caixas: MovimentoCaixa[];
  tiposCaixa: TipoCaixa[];
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
  definirPedido: (
    dados: Omit<PedidoCliente, "id" | "tipo" | "qtd"> & { tipo?: string; qtd: number | null },
  ) => void;
  removePedido: (id: string) => void;
  definirPrevisao: (data: string, mercadoria: string, qtd: number, fornecedor?: string) => void;
  atualizarPrevisao: (id: string, patch: Partial<Omit<PrevisaoFornecedor, "id">>) => void;
  removePrevisao: (id: string) => void;
  definirCaixa: (data: string, fornecedor: string, tipo: string, pegou: number) => void;
  addTipoCaixa: (nome: string) => boolean;
  removeTipoCaixa: (id: string) => void;
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
  sobras: (data?: string) => ReturnType<typeof sobrasPorDia>;
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

function limparLancamentosLocais() {
  removeFromStorage(
    "lancamentos-entradas-v5",
    "lancamentos-entradas-v4",
    "lancamentos-saidas-v4",
    "pedidos-v1",
  );
}

function estadoInicialEntradas(): EntradaLancamento[] {
  if (apiRemota) {
    limparLancamentosLocais();
    return criarEntradasVazias(toISODate(), LINHAS_PADRAO);
  }
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
      entrada.observacao?.trim() ||
      entrada.feitaBoa != null ||
      entrada.feitaFraca != null ||
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

function mesclarDestinos(local: DestinoEntrada[], remoto: DestinoEntrada[]): DestinoEntrada[] {
  const remotoPorId = new Map(remoto.map((destino) => [destino.id, destino]));
  const vistos = new Set<string>();
  const resultado: DestinoEntrada[] = [];

  for (const destino of local) {
    const remota = remotoPorId.get(destino.id);
    if (remota) {
      resultado.push(remota);
      vistos.add(destino.id);
      continue;
    }
    if (!destinoPersistivel(destino)) {
      resultado.push(destino);
      vistos.add(destino.id);
    }
  }

  for (const destino of remoto) {
    if (!vistos.has(destino.id)) resultado.push(destino);
  }

  return resultado;
}

function mesmaEntrada(a: EntradaLancamento, b: EntradaLancamento): boolean {
  return (
    a.id === b.id &&
    a.data === b.data &&
    a.produtor === b.produtor &&
    a.mercadoria === b.mercadoria &&
    a.qtd === b.qtd &&
    a.preco === b.preco &&
    a.precoFraco === b.precoFraco &&
    a.rendimentoExtra === b.rendimentoExtra &&
    (a.feitaBoa ?? null) === (b.feitaBoa ?? null) &&
    (a.feitaFraca ?? null) === (b.feitaFraca ?? null) &&
    (a.observacao ?? "") === (b.observacao ?? "") &&
    tipoCaixaDaEntrada(a) === tipoCaixaDaEntrada(b) &&
    JSON.stringify(a.destinos ?? []) === JSON.stringify(b.destinos ?? [])
  );
}

function mesmasEntradas(a: EntradaLancamento[], b: EntradaLancamento[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((entrada, i) => mesmaEntrada(entrada, b[i]));
}

function mesmosPedidos(a: PedidoCliente[], b: PedidoCliente[]): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function obsDaEntrada(local: EntradaLancamento, remota?: EntradaLancamento, guardadas?: Record<string, string>): string | undefined {
  const doBanco = remota?.observacao?.trim();
  if (doBanco) return remota?.observacao;
  const daTela = local.observacao?.trim();
  if (daTela) return local.observacao;
  const lembrada = guardadas?.[local.id]?.trim();
  return lembrada || undefined;
}

function lembrarObservacao(id: string, texto: string | undefined) {
  const mapa = loadFromStorage<Record<string, string>>("entrada-obs-v1", {});
  const limpo = texto?.trim() ?? "";
  if (limpo) mapa[id] = limpo;
  else delete mapa[id];
  saveToStorage("entrada-obs-v1", mapa);
}

function lembrarTipoCaixa(id: string, tipo: string | undefined) {
  const mapa = loadFromStorage<Record<string, string>>("entrada-tipo-caixa-v1", {});
  const limpo = tipo?.trim() ?? "";
  if (!limpo || ehTipoCaixaPadrao(limpo)) delete mapa[id];
  else mapa[id] = limpo;
  saveToStorage("entrada-tipo-caixa-v1", mapa);
}

function tipoCaixaGuardado(
  local: EntradaLancamento,
  remota?: EntradaLancamento,
  guardadas?: Record<string, string>,
): string | undefined {
  const lembrada = guardadas?.[local.id]?.trim();
  if (lembrada) return lembrada;
  const daTela = local.tipoCaixa?.trim();
  if (daTela) return daTela;
  const doBanco = remota?.tipoCaixa?.trim();
  return doBanco || undefined;
}

type FeitaGuardada = { boa: number | null; fraca: number | null };

function lembrarFeita(id: string, boa: number | null | undefined, fraca: number | null | undefined) {
  const mapa = loadFromStorage<Record<string, FeitaGuardada>>("entrada-feita-v1", {});
  if (boa == null && fraca == null) delete mapa[id];
  else mapa[id] = { boa: boa ?? null, fraca: fraca ?? null };
  saveToStorage("entrada-feita-v1", mapa);
}

function feitaDaEntrada(
  local: EntradaLancamento,
  remota?: EntradaLancamento,
  guardadas?: Record<string, FeitaGuardada>,
): { feitaBoa?: number | null; feitaFraca?: number | null } {
  const lembrada = guardadas?.[local.id];
  if (lembrada) return { feitaBoa: lembrada.boa, feitaFraca: lembrada.fraca };
  if (local.feitaBoa != null || local.feitaFraca != null) {
    return { feitaBoa: local.feitaBoa, feitaFraca: local.feitaFraca };
  }
  if (remota?.feitaBoa != null || remota?.feitaFraca != null) {
    return { feitaBoa: remota.feitaBoa, feitaFraca: remota.feitaFraca };
  }
  return {};
}

function mesclarEntradas(
  local: EntradaLancamento[],
  remoto: EntradaLancamento[],
  pendentes: Set<string>,
): EntradaLancamento[] {
  const remotoPorId = new Map(remoto.map((entrada) => [entrada.id, entrada]));
  const vistos = new Set<string>();
  const resultado: EntradaLancamento[] = [];
  const obsGuardadas = loadFromStorage<Record<string, string>>("entrada-obs-v1", {});
  const feitaGuardadas = loadFromStorage<Record<string, FeitaGuardada>>("entrada-feita-v1", {});
  const tipoGuardadas = loadFromStorage<Record<string, string>>("entrada-tipo-caixa-v1", {});

  for (const entrada of local) {
    if (pendentes.has(entrada.id)) {
      resultado.push(entrada);
      vistos.add(entrada.id);
      continue;
    }
    const remota = remotoPorId.get(entrada.id);
    if (remota) {
      resultado.push({
        ...remota,
        observacao: obsDaEntrada(entrada, remota, obsGuardadas),
        tipoCaixa: tipoCaixaGuardado(entrada, remota, tipoGuardadas),
        destinos: mesclarDestinos(entrada.destinos ?? [], remota.destinos ?? []),
        ...feitaDaEntrada(entrada, remota, feitaGuardadas),
      });
      vistos.add(entrada.id);
      continue;
    }
    if (!entradaPersistivel(entrada)) {
      resultado.push(entrada);
      vistos.add(entrada.id);
    }
  }

  for (const entrada of remoto) {
    if (!vistos.has(entrada.id)) {
      resultado.push({
        ...entrada,
        observacao: entrada.observacao?.trim() || obsGuardadas[entrada.id] || undefined,
        tipoCaixa: tipoCaixaGuardado(entrada, entrada, tipoGuardadas),
        ...feitaDaEntrada(entrada, entrada, feitaGuardadas),
      });
    }
  }

  return mesmasEntradas(local, resultado) ? local : resultado;
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
  const [pedidos, setPedidos] = useState<PedidoCliente[]>(() =>
    apiRemota ? [] : loadFromStorage("pedidos-v1", []),
  );
  const [previsoes, setPrevisoes] = useState<PrevisaoFornecedor[]>(() =>
    loadFromStorage("previsoes-v1", []).filter(previsaoPersistivel),
  );
  const [caixas, setCaixas] = useState<MovimentoCaixa[]>(() =>
    loadFromStorage("caixas-v1", []).filter(caixaPersistivel),
  );
  const [tiposCaixa, setTiposCaixa] = useState<TipoCaixa[]>(() =>
    loadFromStorage("tipos-caixa-v1", []).filter(tipoCaixaPersistivel),
  );
  const [statusBanco, setStatusBanco] = useState<StatusBanco>("conectando");
  const [gravadas, setGravadas] = useState<Record<string, EntradaLancamento>>({});
  const timers = useRef(new Map<string, number>());
  const bancoRef = useRef(false);
  const entradasRef = useRef(entradas);
  const pedidosRef = useRef(pedidos);
  const previsoesRef = useRef(previsoes);
  const gravadasRef = useRef(gravadas);
  entradasRef.current = entradas;
  pedidosRef.current = pedidos;
  previsoesRef.current = previsoes;
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
      setPedidos((local) => {
        const proxima = mesclarPedidos(local, pacote.pedidos ?? [], idsPendentes());
        return mesmosPedidos(local, proxima) ? local : proxima;
      });
      setGravadas((prev) => {
        const next = { ...prev };
        const pendentes = idsPendentes();
        let mudou = false;
        for (const entrada of pacote.entradas) {
          if (!pendentes.has(entrada.id) && entradaPersistivel(entrada)) {
            const gravada = paraApi(entrada);
            if (!prev[entrada.id] || JSON.stringify(prev[entrada.id]) !== JSON.stringify(gravada)) {
              next[entrada.id] = gravada;
              mudou = true;
            }
          }
        }
        return mudou ? next : prev;
      });
    });
  }, [usandoBanco]);

  useEffect(() => {
    if (apiRemota || usandoBanco) return;
    saveToStorage("lancamentos-entradas-v5", entradas);
  }, [entradas, usandoBanco]);

  useEffect(() => {
    if (apiRemota || usandoBanco) return;
    saveToStorage("pedidos-v1", pedidos.filter(pedidoPersistivel));
  }, [pedidos, usandoBanco]);

  useEffect(() => {
    saveToStorage("previsoes-v1", previsoes.filter(previsaoPersistivel));
  }, [previsoes]);

  useEffect(() => {
    saveToStorage("caixas-v1", caixas.filter(caixaPersistivel));
  }, [caixas]);

  useEffect(() => {
    saveToStorage("tipos-caixa-v1", tiposCaixa.filter(tipoCaixaPersistivel));
  }, [tiposCaixa]);

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
      previsoes,
      caixas,
      tiposCaixa,
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
        if ("observacao" in patch) lembrarObservacao(id, patch.observacao);
        if ("tipoCaixa" in patch) lembrarTipoCaixa(id, patch.tipoCaixa);
        if ("feitaBoa" in patch || "feitaFraca" in patch) {
          const atual = entradasRef.current.find((entrada) => entrada.id === id);
          lembrarFeita(
            id,
            "feitaBoa" in patch ? patch.feitaBoa : atual?.feitaBoa,
            "feitaFraca" in patch ? patch.feitaFraca : atual?.feitaFraca,
          );
        }
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
        lembrarObservacao(id, "");
        lembrarFeita(id, null, null);
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
      definirCaixa: (data, fornecedor, tipo, pegou) => {
        const nome = fornecedor.trim();
        const tipoNome = tipo.trim();
        if (!nome || !tipoNome) return;
        const pegouN = Number.isFinite(pegou) && pegou > 0 ? pegou : 0;
        setCaixas((prev) => {
          const indice = prev.findIndex(
            (item) =>
              item.data === data &&
              mesmaPessoa(item.fornecedor, nome) &&
              mesmoTipoCaixa(item.tipo ?? "", tipoNome),
          );
          if (pegouN <= 0) {
            if (indice < 0) return prev;
            return prev.filter((_, i) => i !== indice);
          }
          if (indice >= 0) {
            const atual = prev[indice];
            if (atual.pegou === pegouN && atual.fornecedor === nome && atual.tipo === tipoNome) {
              return prev;
            }
            const proxima = [...prev];
            proxima[indice] = { ...atual, fornecedor: nome, tipo: tipoNome, veio: 0, pegou: pegouN };
            return proxima;
          }
          return [...prev, { id: generateId("cx"), data, fornecedor: nome, tipo: tipoNome, veio: 0, pegou: pegouN }];
        });
      },
      addTipoCaixa: (nome) => {
        const limpo = nome.trim();
        if (!limpo) return false;
        let criou = false;
        setTiposCaixa((prev) => {
          if (prev.some((tipo) => mesmoTipoCaixa(tipo.nome, limpo))) return prev;
          criou = true;
          return [...prev, { id: generateId("tcx"), nome: limpo }];
        });
        return criou;
      },
      removeTipoCaixa: (id) => {
        setTiposCaixa((prev) => prev.filter((tipo) => tipo.id !== id));
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
      definirPedido: (dados) => {
        const daLinha = pedidosRef.current.filter(
          (pedido) =>
            pedido.data === dados.data &&
            mesmaChave(pedido.cliente, dados.cliente) &&
            mesmaChave(pedido.mercadoria, dados.mercadoria),
        );
        const quantidade = dados.qtd;
        const apagar = (lista: PedidoCliente[]) => {
          for (const pedido of lista) {
            const timer = timers.current.get(pedido.id);
            if (timer) window.clearTimeout(timer);
            timers.current.delete(pedido.id);
            if (bancoRef.current) {
              marcarPendente(pedido.id);
              void api.delete(`/pedidos/${pedido.id}`).finally(() => limparPendente(pedido.id));
            }
          }
        };
        if (quantidade == null || !Number.isFinite(quantidade) || quantidade <= 0) {
          if (daLinha.length === 0) return;
          apagar(daLinha);
          const ids = new Set(daLinha.map((pedido) => pedido.id));
          setPedidos((prev) => prev.filter((pedido) => !ids.has(pedido.id)));
          return;
        }
        const tipo = daLinha[0]?.tipo || dados.tipo?.trim() || "BOM";
        if (daLinha.length === 1 && daLinha[0].qtd === quantidade && mesmaChave(daLinha[0].tipo || "BOM", tipo)) {
          return;
        }
        if (daLinha.length === 0) {
          const id = generateId("ped");
          const pedido: PedidoCliente = {
            id,
            data: dados.data,
            cliente: dados.cliente,
            mercadoria: dados.mercadoria,
            tipo,
            qtd: quantidade,
          };
          setPedidos((prev) => [...prev, pedido]);
          agendarSalvarPedido(pedido);
          return;
        }
        const [primeiro, ...resto] = daLinha;
        const atualizado: PedidoCliente = { ...primeiro, qtd: quantidade, tipo };
        const idsResto = new Set(resto.map((pedido) => pedido.id));
        apagar(resto);
        setPedidos((prev) =>
          prev
            .filter((pedido) => !idsResto.has(pedido.id))
            .map((pedido) => (pedido.id === primeiro.id ? atualizado : pedido)),
        );
        agendarSalvarPedido(atualizado);
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
      definirPrevisao: (data, mercadoria, qtd, fornecedor) => {
        const nome = mercadoria.trim();
        if (!nome) return;
        const qtdN = Number.isFinite(qtd) && qtd > 0 ? qtd : 0;
        const existente = previsaoExistente(previsoesRef.current, data, nome, fornecedor);
        const forn = fornecedor?.trim() || undefined;
        setPrevisoes((prev) => {
          if (qtdN <= 0) {
            if (!existente) return prev;
            return prev.filter((item) => item.id !== existente.id);
          }
          if (existente) {
            if (
              existente.qtd === qtdN &&
              existente.mercadoria === nome &&
              (existente.fornecedor ?? "") === (forn ?? "")
            ) {
              return prev;
            }
            return prev.map((item) =>
              item.id === existente.id ? { ...item, mercadoria: nome, qtd: qtdN, fornecedor: forn } : item,
            );
          }
          return [
            ...prev,
            { id: generateId("prev"), data, mercadoria: nome, qtd: qtdN, fornecedor: forn },
          ];
        });
      },
      atualizarPrevisao: (id, patch) => {
        setPrevisoes((prev) => {
          const atual = prev.find((item) => item.id === id);
          if (!atual) return prev;
          const proximo = { ...atual, ...patch };
          if (!previsaoPersistivel(proximo)) return prev.filter((item) => item.id !== id);
          return prev.map((item) => (item.id === id ? proximo : item));
        });
      },
      removePrevisao: (id) => {
        setPrevisoes((prev) => prev.filter((item) => item.id !== id));
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
      sobras: (data) => sobrasPorDia(entradas, data),
    }),
    [entradas, pedidos, previsoes, caixas, tiposCaixa, saidas, usandoBanco, statusBanco, gravadas],
  );

  return <PlanilhaContext.Provider value={value}>{children}</PlanilhaContext.Provider>;
}

export function usePlanilha(): PlanilhaContextValue {
  const ctx = useContext(PlanilhaContext);
  if (!ctx) throw new Error("usePlanilha deve ser usado dentro de PlanilhaProvider");
  return ctx;
}
