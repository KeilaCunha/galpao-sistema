import { CalendarDays, ChevronLeft, ChevronRight, Leaf, Settings, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlanilhaDiaria } from "../components/dashboard/PlanilhaDiaria";
import { Button } from "../components/ui/Button";
import { usePlanilha } from "../context/PlanilhaContext";
import type { LinhaPlanilha } from "../types";
import {
  calcularSobra,
  pontaDaCadeia,
  resumoComCadeia,
  resumoDestinos,
} from "../utils/destino";
import { addDays, formatDate, toISODate, weekdayLabel } from "../utils/format";

const hojeISO = toISODate();
type Aba = "folha" | "clientes" | "sobras";

// ── Abreviação de mercadoria para chips (ex: "Abobrinha" → "AB", "Jiló" → "JILÓ") ──
function abrevMercadoria(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiro = partes[0];
  const resto = partes.slice(1).join(" ");
  const abrev = primeiro.length <= 5 ? primeiro.toUpperCase() : primeiro.slice(0, 2).toUpperCase();
  return resto ? `${abrev} ${resto.toUpperCase()}` : abrev;
}

// ── Chip de stat ─────────────────────────────────────────────────────────────
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
    neutral: "text-neutral-700",
  };
  return (
    <div className="text-center">
      <p className={`text-xl font-bold tabular-nums ${cores[cor ?? "neutral"]}`}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(hojeISO);
  const [aba, setAba] = useState<Aba>("folha");
  const navigate = useNavigate();

  const { getLinhas, listarDatas } = usePlanilha();
  const linhasDoDia = getLinhas(data);
  const ehHoje = data === hojeISO;

  // ── Resumo do dia ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let recebido = 0;
    let feitoBom = 0;
    let feitoFraco = 0;
    for (const linha of linhasDoDia) {
      recebido += linha.qtd ?? 0;
      const r = resumoDestinos(linha.destinos);
      feitoBom += r.boa;
      feitoFraco += r.fraca;
    }
    const sobra = Math.max(0, recebido - feitoBom - feitoFraco);
    return { recebido, feitoBom, feitoFraco, sobra };
  }, [linhasDoDia]);

  // ── Sobras pendentes (todas as datas) ─────────────────────────────────────
  const sobrasPendentes = useMemo(
    () =>
      listarDatas()
        .flatMap((dataEntrada) =>
          getLinhas(dataEntrada)
            .filter((l) => !l.origemLinhaId && l.qtd !== null)
            .map((linha) => {
              const resumo = resumoComCadeia(getLinhas, dataEntrada, linha);
              return { dataEntrada, linha, resumo, sobra: calcularSobra(linha.qtd, resumo) };
            }),
        )
        .filter((item) => item.sobra > 0)
        .sort((a, b) => a.dataEntrada.localeCompare(b.dataEntrada)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listarDatas, getLinhas],
  );

  // ── ENTRADAS: agrupa linhas do dia por produtor ────────────────────────────
  const entradas = useMemo(() => {
    const mapa = new Map<string, { mercadorias: { nome: string; qtd: number }[]; totalQtd: number }>();
    for (const linha of linhasDoDia) {
      if (linha.origemLinhaId) continue; // sobra de outro dia, não é entrada nova
      if (!linha.produtor.trim() && !linha.mercadoria.trim() && linha.qtd === null) continue;
      const key = linha.produtor.trim() || "(sem nome)";
      const atual = mapa.get(key) ?? { mercadorias: [], totalQtd: 0 };
      if (linha.mercadoria.trim()) {
        const existente = atual.mercadorias.find((m) => m.nome === linha.mercadoria);
        if (existente) { existente.qtd += linha.qtd ?? 0; }
        else { atual.mercadorias.push({ nome: linha.mercadoria, qtd: linha.qtd ?? 0 }); }
      }
      atual.totalQtd += linha.qtd ?? 0;
      mapa.set(key, atual);
    }
    return Array.from(mapa.entries());
  }, [linhasDoDia]);

  // ── SAÍDAS: agrupa destinos do dia por cliente ─────────────────────────────
  const saidas = useMemo(() => {
    const mapa = new Map<string, { itens: { mercadoria: string; boa: number; fraca: number }[]; totalBoa: number; totalFraca: number }>();
    for (const linha of linhasDoDia) {
      for (const d of linha.destinos) {
        if (!d.cliente.trim()) continue;
        const key = d.cliente.trim();
        const atual = mapa.get(key) ?? { itens: [], totalBoa: 0, totalFraca: 0 };
        const merc = linha.mercadoria.trim() || "(?)";
        const existente = atual.itens.find((i) => i.mercadoria === merc);
        if (existente) {
          existente.boa += d.boa ?? 0;
          existente.fraca += d.fraca ?? 0;
        } else {
          atual.itens.push({ mercadoria: merc, boa: d.boa ?? 0, fraca: d.fraca ?? 0 });
        }
        atual.totalBoa += d.boa ?? 0;
        atual.totalFraca += d.fraca ?? 0;
        mapa.set(key, atual);
      }
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhasDoDia]);

  // ── Por cliente (agrupa destinos do dia) ──────────────────────────────────
  const porCliente = useMemo(() => {
    const mapa = new Map<string, { boa: number; fraca: number; mercadorias: string[] }>();
    for (const linha of linhasDoDia) {
      for (const d of linha.destinos) {
        if (!d.cliente.trim()) continue;
        const key = d.cliente.trim();
        const atual = mapa.get(key) ?? { boa: 0, fraca: 0, mercadorias: [] };
        atual.boa += d.boa ?? 0;
        atual.fraca += d.fraca ?? 0;
        if (linha.mercadoria && !atual.mercadorias.includes(linha.mercadoria)) {
          atual.mercadorias.push(linha.mercadoria);
        }
        mapa.set(key, atual);
      }
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhasDoDia]);

  function resolverSobra(dataEntrada: string, linha: LinhaPlanilha) {
    const ponta = pontaDaCadeia(getLinhas, dataEntrada, linha);
    setData(ponta.data);
    setAba("folha");
  }

  const abas = [
    { id: "folha" as Aba, label: "Folha do dia" },
    { id: "clientes" as Aba, label: "Por cliente", count: porCliente.length },
    { id: "sobras" as Aba, label: "Sobras em estoque", count: sobrasPendentes.length, alert: true },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ══════════════════ HEADER ══════════════════ */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          {/* Esquerda — identidade */}
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-900/20">
              <Leaf size={18} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[13px] font-bold uppercase tracking-widest text-neutral-800">Galpão</p>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-400">
                Controle de produção
              </p>
            </div>
          </div>

          {/* Direita — data + settings */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setData((d) => addDays(d, -1))}
              className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Dia anterior"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-[150px] text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-neutral-800">
                {weekdayLabel(data)}
              </p>
              <p className="text-[11px] text-neutral-500">{formatDate(data)}</p>
            </div>

            <button
              type="button"
              onClick={() => setData((d) => addDays(d, 1))}
              className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Próximo dia"
            >
              <ChevronRight size={20} />
            </button>

            {!ehHoje && (
              <button
                type="button"
                onClick={() => setData(hojeISO)}
                className="ml-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Hoje
              </button>
            )}

            <div className="mx-2 h-6 w-px bg-neutral-200" />

            <button
              type="button"
              onClick={() => navigate("/configuracoes")}
              className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════ TABS ══════════════════ */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] px-6">
          {abas.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                aba === tab.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    tab.alert
                      ? "bg-warning-100 text-warning-700"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════ CONTEÚDO ══════════════════ */}
      <div className="mx-auto max-w-[1400px] px-6 py-5">
        {/* ── Resumo do dia (barra sempre visível) ── */}
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Resumo do dia · o estoque bate?
          </p>
          <div className="h-5 w-px bg-neutral-200" />
          <Stat label="Recebido" value={stats.recebido} />
          <span className="text-lg font-light text-neutral-300">=</span>
          <Stat label="Feito bom" value={stats.feitoBom} cor="success" />
          <span className="text-sm text-neutral-300">+</span>
          <Stat label="Feito fraco" value={stats.feitoFraco} cor="warning" />
          {stats.sobra > 0 && (
            <>
              <span className="text-sm text-neutral-300">+</span>
              <Stat label="Sobra" value={stats.sobra} cor="danger" />
            </>
          )}
          {/* barra de progresso */}
          {stats.recebido > 0 && (
            <div className="ml-2 flex-1 overflow-hidden rounded-full bg-neutral-200" style={{ height: 6, minWidth: 80 }}>
              <div
                className="h-full rounded-full bg-success-500"
                style={{ width: `${Math.min(100, ((stats.feitoBom + stats.feitoFraco) / stats.recebido) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Aba: Folha do dia ── */}
        {aba === "folha" && (
          <>
            <PlanilhaDiaria data={data} setData={setData} />

            {/* ── ENTRADAS / SAÍDAS ── */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">

              {/* ENTRADAS */}
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-600">Entradas</h3>
                  <span className="text-[11px] font-medium text-neutral-400">
                    {entradas.length} {entradas.length === 1 ? "produtor" : "produtores"}
                  </span>
                </div>
                {entradas.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-neutral-400">Nenhuma entrada registrada hoje.</p>
                ) : (
                  <div>
                    {entradas.map(([produtor, dados]) => (
                      <div
                        key={produtor}
                        className="flex items-center gap-3 border-b border-neutral-50 px-5 py-3 last:border-0 hover:bg-neutral-50/60"
                      >
                        <span className="min-w-[100px] text-sm font-semibold text-neutral-700">{produtor}</span>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {dados.mercadorias.map((m, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700"
                            >
                              {m.qtd} {abrevMercadoria(m.nome)}
                            </span>
                          ))}
                        </div>
                        <span className="whitespace-nowrap text-[11px] font-semibold text-neutral-400">
                          {dados.totalQtd} cx
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SAÍDAS */}
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-600">Saídas</h3>
                  <span className="text-[11px] font-medium text-neutral-400">
                    {saidas.length} {saidas.length === 1 ? "cliente" : "clientes"}
                  </span>
                </div>
                {saidas.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-neutral-400">Nenhuma saída registrada hoje.</p>
                ) : (
                  <div>
                    {saidas.map(([cliente, dados]) => (
                      <div
                        key={cliente}
                        className="flex items-center gap-3 border-b border-neutral-50 px-5 py-3 last:border-0 hover:bg-neutral-50/60"
                      >
                        <span className="min-w-[48px] text-sm font-bold text-neutral-800">{cliente}</span>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {dados.itens.map((item, i) => (
                            <span key={i} className="contents">
                              {item.boa > 0 && (
                                <span className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700">
                                  {item.boa} {abrevMercadoria(item.mercadoria)}
                                </span>
                              )}
                              {item.fraca > 0 && (
                                <span className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700">
                                  {item.fraca} {abrevMercadoria(item.mercadoria)}
                                  <sup className="ml-0.5 text-[8px] font-extrabold">fr</sup>
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        <span className="whitespace-nowrap text-[11px] font-semibold text-neutral-400">
                          {dados.totalBoa + dados.totalFraca} cx
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}

        {/* ── Aba: Por cliente ── */}
        {aba === "clientes" && (
          <div>
            {porCliente.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Users size={36} className="text-neutral-300" />
                <p className="text-sm font-medium text-neutral-500">Nenhum cliente com destino informado hoje.</p>
                <p className="text-xs text-neutral-400">Adicione destinos na aba "Folha do dia".</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Cliente
                      </th>
                      <th className="border-b border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Mercadoria
                      </th>
                      <th className="w-28 border-b border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-success-600">
                        Boa
                      </th>
                      <th className="w-28 border-b border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-warning-600">
                        Fraca
                      </th>
                      <th className="w-28 border-b border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCliente.map(([cliente, dados]) => (
                      <tr key={cliente} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-semibold text-neutral-800">{cliente}</td>
                        <td className="px-4 py-3 text-neutral-500">
                          {dados.mercadorias.join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-success-600">
                          {dados.boa || "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-warning-600">
                          {dados.fraca > 0 ? (
                            <span className="inline-flex items-center gap-0.5">
                              {dados.fraca} <Zap size={11} />
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-neutral-700">
                          {dados.boa + dados.fraca}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Aba: Sobras em estoque ── */}
        {aba === "sobras" && (
          <div>
            {sobrasPendentes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <CalendarDays size={36} className="text-neutral-300" />
                <p className="text-sm font-medium text-neutral-500">Nenhuma sobra pendente no momento.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {Array.from(
                  sobrasPendentes.reduce((grupos, item) => {
                    const lista = grupos.get(item.dataEntrada) ?? [];
                    lista.push(item);
                    grupos.set(item.dataEntrada, lista);
                    return grupos;
                  }, new Map<string, typeof sobrasPendentes>()),
                ).map(([dataEntrada, itens]) => (
                  <div key={dataEntrada}>
                    <div className="mb-2 flex items-center gap-2">
                      <CalendarDays size={14} className="text-brand-600" />
                      <h3 className="text-sm font-bold text-neutral-800">{formatDate(dataEntrada)}</h3>
                      <span className="text-xs text-neutral-400">
                        · {itens.length} {itens.length === 1 ? "produtor" : "produtores"}
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-neutral-50">
                            <th className="border-b border-neutral-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Produtor</th>
                            <th className="w-24 border-b border-neutral-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Qtd.</th>
                            <th className="border-b border-neutral-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Mercadoria</th>
                            <th className="w-40 border-b border-neutral-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-warning-600">Sobra</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map(({ linha, resumo, sobra }) => (
                            <tr key={linha.id} className="border-b border-neutral-100 last:border-0">
                              <td className="px-4 py-2.5 font-semibold text-neutral-800">
                                {linha.produtor || "Produtor não informado"}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-600">
                                <p className="font-semibold">{linha.qtd}</p>
                                <p className="text-[11px] text-neutral-400">feito: {resumo.total}</p>
                              </td>
                              <td className="px-4 py-2.5 text-neutral-600">
                                {linha.mercadoria || "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-warning-600">{sobra}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => resolverSobra(dataEntrada, linha)}
                                  >
                                    Resolver →
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
