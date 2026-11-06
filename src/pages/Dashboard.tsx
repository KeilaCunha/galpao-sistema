import { CalendarDays, ChevronLeft, ChevronRight, Leaf, LogOut, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DestinoChips } from "../components/dashboard/DestinoChips";
import { DestinosModal } from "../components/dashboard/DestinosModal";
import { PlanilhaDiaria } from "../components/dashboard/PlanilhaDiaria";
import { RelatoriosPainel } from "../components/dashboard/RelatoriosPainel";
import { Button } from "../components/ui/Button";
import { DatePicker } from "../components/ui/DatePicker";
import { useAuth } from "../context/AuthContext";
import { usePlanilha } from "../context/PlanilhaContext";
import { abrevMercadoria } from "../utils/abrev";
import {
  compararLancamento,
  destinosDoDia,
  destinosDoEstoqueNoDia,
  fracaEmEstoque,
  ordemDeLancamento,
  restanteEntradaDireto,
} from "../utils/alocacao";
import { destinoPersistivel } from "../utils/destino";
import { abrevTipo, nomeTipoCliente, ordemClassificacao, qtdDestino, tipoEhEstoque, tipoEhFraco, tipoEhPerda } from "../utils/classificacao";
import { addDays, formatDateLong, weekdayLabel } from "../utils/format";

type Aba = "folha" | "clientes" | "sobras" | "relatorios";

const SHELL = "mx-auto w-full max-w-[2400px] px-3 sm:px-5 lg:px-8";

function Stat({
  label,
  value,
  cor,
}: {
  label: string;
  value: number;
  cor?: "success" | "warning" | "danger" | "neutral";
}) {
  const cores = {
    success: "text-success-600",
    warning: "text-warning-600",
    danger: "text-danger-500",
    neutral: "text-neutral-800",
  };
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold tabular-nums ${cores[cor ?? "neutral"]}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { dataInicial, entradas, getLinhas, garantirLinhasDoDia, resumo, sobras, statusBanco } = usePlanilha();
  const { usuario, pode, precisaSetup, logout, modoLivre } = useAuth();

  const [data, setData] = useState(dataInicial);
  const [aba, setAba] = useState<Aba>("folha");
  const [destinoSobraId, setDestinoSobraId] = useState<string | null>(null);

  useEffect(() => {
    garantirLinhasDoDia(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, statusBanco]);

  const linhasDoDia = getLinhas(data);
  const stats = resumo(data);
  const sobrasPendentes = sobras();
  const totalSobras = sobrasPendentes.reduce((soma, dia) => soma + dia.total, 0);
  const ehHoje = data === dataInicial;

  const estoqueExibicao = useMemo(() => {
    const grupos = new Map<string, typeof sobrasPendentes[number]["itens"]>();
    for (const dia of sobrasPendentes) grupos.set(dia.data, [...dia.itens]);

    for (const entrada of entradas) {
      if (entrada.data === data) continue;
      if (destinosDoEstoqueNoDia(entrada, data).length === 0) continue;
      const lista = grupos.get(entrada.data) ?? [];
      if (lista.some((item) => item.entradaId === entrada.id)) continue;
      lista.push({
        entradaId: entrada.id,
        produtor: entrada.produtor || "Sem fornecedor",
        mercadoria: entrada.mercadoria,
        restante: restanteEntradaDireto(entrada),
        fraca: fracaEmEstoque(entrada),
        abrev: abrevMercadoria(entrada.mercadoria),
      });
      grupos.set(entrada.data, lista);
    }

    const ordem = ordemDeLancamento(entradas);
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, itens]) => {
        const naOrdem = [...itens].sort((a, b) => compararLancamento(ordem, a.entradaId, b.entradaId));
        return {
          data: dia,
          itens: naOrdem,
          total: naOrdem.reduce((soma, item) => soma + item.restante, 0),
        };
      });
  }, [sobrasPendentes, entradas, data]);

  const saidasPorCliente = useMemo(() => {
    type TipoItem = { chave: string; label: string; qtd: number; fraco: boolean };
    const clientes = new Map<string, Map<string, { mercadoria: string; tipos: Map<string, TipoItem> }>>();

    for (const entrada of entradas) {
      const mercadoria = entrada.mercadoria || "Mercadoria";
      for (const destino of destinosDoDia(entrada, data)) {
        const cliente = destino.cliente.trim();
        if (!cliente || tipoEhPerda(destino.tipo) || tipoEhEstoque(destino.tipo)) continue;

        const tipo = destino.tipo?.trim() ?? "";
        const soFraca = !tipo && (destino.fraca ?? 0) > 0 && !(destino.boa ?? 0);
        const osDois = !tipo && (destino.boa ?? 0) > 0 && (destino.fraca ?? 0) > 0;
        const porMerc = clientes.get(cliente) ?? new Map();
        const item = porMerc.get(mercadoria.toLowerCase()) ?? { mercadoria, tipos: new Map<string, TipoItem>() };

        const somar = (chave: string, label: string, qtd: number, fraco: boolean) => {
          if (qtd <= 0) return;
          const atual = item.tipos.get(chave) ?? { chave, label, qtd: 0, fraco };
          atual.qtd += qtd;
          item.tipos.set(chave, atual);
        };

        if (osDois) {
          somar("boa", "", destino.boa ?? 0, false);
          somar("fraco", "fraco", destino.fraca ?? 0, true);
        } else {
          const qtd = qtdDestino(destino) ?? 0;
          const fraco = tipoEhFraco(tipo) || soFraca;
          const chave = fraco ? "fraco" : abrevTipo(tipo) || "boa";
          somar(chave, nomeTipoCliente(tipo, fraco), qtd, fraco);
        }

        porMerc.set(mercadoria.toLowerCase(), item);
        clientes.set(cliente, porMerc);
      }
    }

    return [...clientes.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([cliente, porMerc]) => {
        const itens = [...porMerc.values()]
          .map((item) => {
            const tipos = [...item.tipos.values()]
              .filter((tipo) => tipo.qtd > 0)
              .sort(
                (a, b) =>
                  ordemClassificacao(item.mercadoria, a.chave) - ordemClassificacao(item.mercadoria, b.chave),
              );
            return {
              mercadoria: item.mercadoria,
              tipos,
              total: tipos.reduce((soma, tipo) => soma + tipo.qtd, 0),
            };
          })
          .filter((item) => item.total > 0)
          .sort((a, b) => a.mercadoria.localeCompare(b.mercadoria, "pt-BR"));
        return {
          cliente,
          itens,
          total: itens.reduce((soma, item) => soma + item.total, 0),
        };
      })
      .filter((grupo) => grupo.itens.length > 0);
  }, [entradas, data]);

  const totalBarra = stats.estoque + stats.recebido;
  const pct = (n: number) => (totalBarra > 0 ? `${(n / totalBarra) * 100}%` : "0%");

  const abas = [
    { id: "folha" as Aba, label: "Folha do dia", visivel: pode("folha") },
    { id: "clientes" as Aba, label: "Por cliente", count: saidasPorCliente.length, visivel: pode("porCliente") },
    { id: "sobras" as Aba, label: "Sobras em estoque", count: totalSobras, alert: true, visivel: pode("sobras") },
    { id: "relatorios" as Aba, label: "Relatórios", visivel: pode("relatorios") },
  ].filter((tab) => tab.visivel);

  useEffect(() => {
    if (abas.some((tab) => tab.id === aba)) return;
    if (abas[0]) setAba(abas[0].id);
  }, [aba, abas]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className={`${SHELL} flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf size={18} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[15px] font-bold uppercase tracking-widest text-neutral-800">Galpão Empório</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                Controle de produção
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setData((d) => addDays(d, -1))} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Dia anterior">
              <ChevronLeft size={20} />
            </button>
            <DatePicker value={data} onChange={setData}>
              <p className="text-base font-bold uppercase tracking-wide text-neutral-800">{weekdayLabel(data)}</p>
              <p className="text-xs text-neutral-500">{formatDateLong(data)}</p>
            </DatePicker>
            <button type="button" onClick={() => setData((d) => addDays(d, 1))} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Próximo dia">
              <ChevronRight size={20} />
            </button>
            {!ehHoje && (
              <button type="button" onClick={() => setData(dataInicial)} className="ml-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                Hoje
              </button>
            )}
            <span
              className={`ml-2 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex ${
                statusBanco === "vivo"
                  ? "bg-success-50 text-success-600"
                  : statusBanco === "conectando"
                    ? "bg-brand-50 text-brand-600"
                    : "bg-warning-50 text-warning-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  statusBanco === "vivo"
                    ? "bg-success-500"
                    : statusBanco === "conectando"
                      ? "animate-pulse bg-brand-500"
                      : "bg-warning-500"
                }`}
              />
              {statusBanco === "vivo"
                ? "Banco ao vivo"
                : statusBanco === "conectando"
                  ? "Conectando…"
                  : "Só neste computador"}
            </span>
            {usuario && (
              <span className="ml-1 hidden text-xs font-medium text-neutral-500 sm:inline">
                {usuario.nome}
              </span>
            )}
            <Link
              to="/configuracoes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Settings size={14} />
              Administração
            </Link>
            {pode("cadastros") && (
              <div className="hidden items-center gap-1 md:flex">
                <Link to="/fornecedores" className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100">
                  Produtores
                </Link>
                <Link to="/produtos" className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100">
                  Produtos
                </Link>
                <Link to="/clientes" className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100">
                  Clientes
                </Link>
              </div>
            )}
            {!modoLivre && usuario && (
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
              >
                <LogOut size={14} />
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      {precisaSetup && (
        <div className="border-b border-brand-200 bg-brand-50">
          <div className={`${SHELL} flex flex-wrap items-center justify-between gap-2 py-2.5`}>
            <p className="text-sm text-brand-800">
              Ainda não tem responsável cadastrado. Crie o primeiro (por exemplo o Ítalo) para travar quantidade, definir quem acessa o quê e o que cada um vê na folha.
            </p>
            <Link
              to="/configuracoes"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Cadastrar responsável
            </Link>
          </div>
        </div>
      )}

      <div className="border-b border-neutral-200 bg-white">
        <div className={`${SHELL} flex overflow-x-auto`}>
          {abas.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap sm:px-5 ${
                aba === tab.id ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab.alert ? "bg-warning-50 text-warning-700" : "bg-neutral-100 text-neutral-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`${SHELL} py-4 sm:py-5`}>
        {aba !== "relatorios" && (
        <div className="mb-5 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            Resumo do dia · o estoque bate?
          </p>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <Stat label="Estoque" value={stats.estoque} />
            <span className="mb-5 text-lg text-neutral-300">+</span>
            <Stat label="Recebido" value={stats.recebido} />
            <span className="mb-5 text-lg text-neutral-300">=</span>
            <Stat label="Feito bom" value={stats.feitoBom} cor="success" />
            <Stat label="Feito fraco" value={stats.feitoFraco} cor="warning" />
            <Stat label="Perda" value={stats.perda} />
            <Stat label="Sobra" value={stats.sobra} cor={stats.sobra > 0 ? "danger" : "neutral"} />
          </div>
          {totalBarra > 0 && (
            <div className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="bg-brand-700" style={{ width: pct(stats.feitoBom) }} />
              <div className="bg-warning-600" style={{ width: pct(stats.feitoFraco) }} />
              <div className="bg-neutral-400" style={{ width: pct(stats.perda) }} />
              <div
                className="bg-[repeating-linear-gradient(135deg,#dc2626_0_4px,transparent_4px_8px)]"
                style={{ width: pct(stats.sobra) }}
              />
            </div>
          )}
        </div>
        )}

        {aba === "folha" && <PlanilhaDiaria data={data} linhas={linhasDoDia} />}

        {aba === "clientes" && (
          <div>
            {saidasPorCliente.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Users size={36} className="text-neutral-300" />
                <p className="text-sm font-medium text-neutral-500">Nenhum cliente neste dia.</p>
                <p className="text-xs text-neutral-400">Informe o destino na linha da folha do dia.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {saidasPorCliente.map((grupo) => (
                  <div key={grupo.cliente} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                      <h3 className="text-sm font-bold text-neutral-800">{grupo.cliente}</h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        {grupo.total} cx
                      </span>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Mercadoria</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Classificação</th>
                          <th className="w-24 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.itens.map((item) => (
                          <tr key={item.mercadoria} className="border-t border-neutral-100">
                            <td className="px-4 py-3 font-semibold text-neutral-800">{item.mercadoria}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {item.tipos.map((tipo) => (
                                  <span
                                    key={tipo.chave}
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                                      tipo.fraco ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"
                                    }`}
                                  >
                                    {tipo.qtd}{tipo.label ? ` ${tipo.label}` : ""}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-bold">{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === "sobras" && (
          <div>
            {estoqueExibicao.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <CalendarDays size={36} className="text-neutral-300" />
                <p className="text-sm font-medium text-neutral-500">Nada sobrando no estoque.</p>
                <p className="text-xs text-neutral-400">Quando sobrar no dia, aparece aqui. Clique em Destino para vender. Some sozinho.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {estoqueExibicao.map((dia) => (
                  <div key={dia.data}>
                    <div className="mb-2 flex items-center gap-2">
                      <CalendarDays size={14} className="text-brand-600" />
                      <h3 className="text-sm font-bold text-neutral-800">{formatDateLong(dia.data)}</h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        {weekdayLabel(dia.data)} · {dia.total} cx
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-neutral-50">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-neutral-500">Fornecedor</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-neutral-500">Mercadoria</th>
                            <th className="w-28 px-4 py-2.5 text-right text-xs font-semibold uppercase text-warning-600">Sobra</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-neutral-500">Destino</th>
                            <th className="w-28 px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {dia.itens.map((item) => {
                            const entrada = entradas.find((e) => e.id === item.entradaId);
                            const vendidoHoje = entrada
                              ? destinosDoEstoqueNoDia(entrada, data).filter(destinoPersistivel)
                              : [];
                            return (
                              <tr key={item.entradaId} className="border-t border-neutral-100">
                                <td className="px-4 py-3 font-semibold text-neutral-800">{item.produtor}</td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-neutral-800">{item.mercadoria}</p>
                                  <p className="text-[11px] font-bold tracking-wide text-neutral-400">{item.abrev}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="inline-flex items-center rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-2.5 py-1 text-sm font-bold text-warning-700">
                                    {item.restante} cx
                                    {item.fraca > 0 ? (
                                      <sup className="ml-0.5 text-[9px] font-extrabold">
                                        {item.fraca >= item.restante ? "fr" : `${item.fraca} fr`}
                                      </sup>
                                    ) : null}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <DestinoChips destinos={vendidoHoje} />
                                    {vendidoHoje.length === 0 && (
                                      <span className="text-xs text-neutral-400">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {pode("destinos") && (
                                    <Button size="sm" variant="outline" onClick={() => setDestinoSobraId(item.entradaId)}>
                                      Destino
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === "relatorios" && <RelatoriosPainel dia={data} />}
      </div>

      <DestinosModal
        open={!!destinoSobraId}
        onClose={() => setDestinoSobraId(null)}
        entrada={entradas.find((e) => e.id === destinoSobraId)}
        dataDestino={data}
        origemEstoque
        descricao={(() => {
          const entrada = entradas.find((e) => e.id === destinoSobraId);
          if (!entrada) return undefined;
          const item = estoqueExibicao.flatMap((dia) => dia.itens).find((s) => s.entradaId === entrada.id);
          return `${entrada.produtor || "Produtor"} · ${entrada.mercadoria || "Mercadoria"} · sobra ${item?.restante ?? 0} cx`;
        })()}
      />
    </div>
  );
}
