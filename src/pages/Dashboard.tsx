import { CalendarDays, ChevronLeft, ChevronRight, Leaf, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlanilhaDiaria } from "../components/dashboard/PlanilhaDiaria";
import { usePlanilha } from "../context/PlanilhaContext";
import type { SaidaLancamento } from "../types";
import { addDays, formatDateLong, weekdayLabel } from "../utils/format";

type Aba = "folha" | "clientes" | "sobras";

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
      <p className={`text-2xl font-bold tabular-nums ${cores[cor ?? "neutral"]}`}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { dataInicial, getLinhas, getSaidasDoDia, garantirLinhasDoDia, resumo, sobras } = usePlanilha();
  const navigate = useNavigate();

  const [data, setData] = useState(dataInicial);
  const [aba, setAba] = useState<Aba>("folha");

  useEffect(() => {
    garantirLinhasDoDia(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const linhasDoDia = getLinhas(data);
  const saidasDoDia = getSaidasDoDia(data);
  const stats = resumo(data);
  const sobrasPendentes = sobras();
  const totalSobras = sobrasPendentes.reduce((soma, dia) => soma + dia.total, 0);
  const ehHoje = data === dataInicial;

  const saidasPorCliente = useMemo(() => {
    const mapa = new Map<string, { saidas: SaidaLancamento[]; total: number }>();
    for (const saida of saidasDoDia.filter((s) => s.tipo === "cliente" && s.cliente && (s.boa || s.fraca))) {
      const key = saida.cliente as string;
      const atual = mapa.get(key) ?? { saidas: [], total: 0 };
      atual.saidas.push(saida);
      atual.total += (saida.boa || 0) + (saida.fraca || 0);
      mapa.set(key, atual);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [saidasDoDia]);

  const totalBarra = stats.estoque + stats.recebido;
  const pct = (n: number) => (totalBarra > 0 ? `${(n / totalBarra) * 100}%` : "0%");

  const abas = [
    { id: "folha" as Aba, label: "Folha do dia" },
    { id: "clientes" as Aba, label: "Por cliente", count: saidasPorCliente.length },
    { id: "sobras" as Aba, label: "Sobras em estoque", count: totalSobras, alert: true },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf size={18} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[13px] font-bold uppercase tracking-widest text-neutral-800">Galpão Empório</p>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-400">
                Controle de produção
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setData((d) => addDays(d, -1))} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Dia anterior">
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-[190px] text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-neutral-800">{weekdayLabel(data)}</p>
              <p className="text-[11px] text-neutral-500">{formatDateLong(data)}</p>
            </div>
            <button type="button" onClick={() => setData((d) => addDays(d, 1))} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Próximo dia">
              <ChevronRight size={20} />
            </button>
            {!ehHoje && (
              <button type="button" onClick={() => setData(dataInicial)} className="ml-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                Hoje
              </button>
            )}
            <div className="mx-2 h-6 w-px bg-neutral-200" />
            <button type="button" onClick={() => navigate("/configuracoes")} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100" title="Configurações">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] px-6">
          {abas.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium ${
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

      <div className="mx-auto max-w-[1400px] px-6 py-5">
        <div className="mb-5 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Resumo do dia · o estoque bate?
          </p>
          <div className="flex flex-wrap items-end gap-5">
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
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Mercadoria</th>
                      <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-success-600">Boa</th>
                      <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-warning-600">Fraca</th>
                      <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saidasPorCliente.map(([cliente, dados]) => {
                      const boa = dados.saidas.reduce((s, x) => s + (x.boa || 0), 0);
                      const fraca = dados.saidas.reduce((s, x) => s + (x.fraca || 0), 0);
                      return (
                        <tr key={cliente} className="border-t border-neutral-100">
                          <td className="px-4 py-3 font-semibold text-neutral-800">{cliente}</td>
                          <td className="px-4 py-3 text-neutral-500">
                            {[...new Set(dados.saidas.map((s) => s.mercadoria))].join(", ")}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-success-600">{boa || "—"}</td>
                          <td className="px-4 py-3 text-center font-semibold text-warning-600">{fraca || "—"}</td>
                          <td className="px-4 py-3 text-center font-bold">{dados.total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {aba === "sobras" && (
          <div>
            {sobrasPendentes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <CalendarDays size={36} className="text-neutral-300" />
                <p className="text-sm font-medium text-neutral-500">Nada sobrando no estoque.</p>
                <p className="text-xs text-neutral-400">Quando sobrar no dia, aparece aqui. Se for para destino, some sozinho.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {sobrasPendentes.map((dia) => (
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
                          </tr>
                        </thead>
                        <tbody>
                          {dia.itens.map((item) => (
                            <tr key={`${item.produtor}-${item.mercadoria}`} className="border-t border-neutral-100">
                              <td className="px-4 py-3 font-semibold text-neutral-800">{item.produtor}</td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-neutral-800">{item.mercadoria}</p>
                                <p className="text-[11px] font-bold tracking-wide text-neutral-400">{item.abrev}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="inline-flex items-center rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-2.5 py-1 text-sm font-bold text-warning-700">
                                  {item.restante} cx
                                </span>
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
