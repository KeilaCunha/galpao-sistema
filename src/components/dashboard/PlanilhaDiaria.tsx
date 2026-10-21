import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  MapPinPlus,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../context/DataContext";
import { useGarantirDataPlanilha, usePlanilha } from "../../context/PlanilhaContext";
import type { DestinoEntrada, LinhaPlanilha } from "../../types";
import {
  calcularSobra,
  destinoPossuiDados,
  pontaDaCadeia,
  resumoComCadeia,
  resumoDestinos,
  statusQtdFeita,
} from "../../utils/destino";
import { addDays, formatDate, toISODate, weekdayLabel } from "../../utils/format";
import { generateId } from "../../utils/id";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";

const hojeISO = toISODate();

// ── Autocomplete inteligente para o campo Mercadoria ──────────────────────────
// Combina o nome do produto com cada tipo cadastrado para gerar as sugestões.
// Ex: "Tomate" com tipos ["A","AA","AAA"] → ["Tomate A", "Tomate AA", "Tomate AAA"]
function MercadoriaAutocomplete({
  value,
  onChange,
  sugestoes,
  desabilitado,
}: {
  value: string;
  onChange: (v: string) => void;
  sugestoes: string[];
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [filtradas, setFiltradas] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function recalcular(v: string) {
    if (!v.trim()) { setFiltradas([]); setAberto(false); return; }
    const lower = v.toLowerCase();
    const lista = sugestoes.filter((s) => s.toLowerCase().includes(lower)).slice(0, 10);
    setFiltradas(lista);
    setAberto(lista.length > 0);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    recalcular(e.target.value);
  }

  function handleFocus() {
    recalcular(value);
  }

  function selecionar(s: string) {
    onChange(s);
    setAberto(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={cellInputClass}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Ex: Tomate AA"
        disabled={desabilitado}
      />
      {aberto && (
        <div className="absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
          {filtradas.map((s) => {
            // Detecta se o item é só o produto ou produto+tipo (tem espaço após o nome base)
            const partes = s.split(" ");
            const produto = partes.slice(0, -1).join(" ");
            const tipo = partes[partes.length - 1];
            const temTipo = partes.length > 1 && sugestoes.some(
              (x) => x !== s && x.startsWith(produto + " "),
            );
            return (
              <button
                key={s}
                type="button"
                onMouseDown={() => selecionar(s)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-brand-50"
              >
                <span className="font-medium text-neutral-800">{temTipo ? produto : s}</span>
                {temTipo && (
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                    {tipo}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function linhaPossuiDados(linha: LinhaPlanilha): boolean {
  return Boolean(
    linha.produtor.trim() ||
      linha.mercadoria.trim() ||
      linha.qtd !== null ||
      linha.preco !== null ||
      linha.destinos.some(destinoPossuiDados),
  );
}

const cellInputClass =
  "h-10 w-full rounded-md bg-transparent px-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

const modalInputClass =
  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function PlanilhaDiaria() {
  const [data, setData] = useState(hojeISO);
  useGarantirDataPlanilha(data);

  const { getLinhas, listarDatas, updateLinha, addLinha, removeLinha, sincronizarSobra } = usePlanilha();
  const { produtos } = useData();

  // Sugestões de mercadoria: "Produto Tipo" para cada tipo, ou só "Produto" se não tiver tipos.
  const sugestoesMercadoria = useMemo(() => {
    const lista: string[] = [];
    for (const p of produtos.filter((p) => p.situacao === "ativo")) {
      const tipos = p.tipos ?? [];
      if (tipos.length === 0) {
        lista.push(p.nome);
      } else {
        for (const t of tipos) {
          lista.push(`${p.nome} ${t}`);
        }
      }
    }
    return lista;
  }, [produtos]);
  const linhas = getLinhas(data);

  const [linhaParaExcluir, setLinhaParaExcluir] = useState<LinhaPlanilha | null>(null);
  const [editandoLinhaId, setEditandoLinhaId] = useState<string | null>(null);
  const [sobrasAbertas, setSobrasAbertas] = useState(false);

  const preenchidas = useMemo(() => linhas.filter(linhaPossuiDados).length, [linhas]);
  const ehHoje = data === hojeISO;
  const linhaEmEdicao = linhas.find((l) => l.id === editandoLinhaId) ?? null;

  // Tipos disponíveis para a linha em edição, baseados no produto do catálogo.
  // Se a mercadoria for "Tomate" ou "Tomate AA", encontra os tipos [A, AA, AAA].
  const tiposDisponiveis = useMemo(() => {
    if (!linhaEmEdicao) return [];
    const merc = linhaEmEdicao.mercadoria.toLowerCase().trim();
    if (!merc) return [];
    const produto = produtos.find(
      (p) =>
        merc === p.nome.toLowerCase() ||
        merc.startsWith(p.nome.toLowerCase() + " ") ||
        (p.tipos ?? []).some((t) => merc === `${p.nome} ${t}`.toLowerCase()),
    );
    return produto?.tipos ?? [];
  }, [linhaEmEdicao, produtos]);

  // Lista TODAS as sobras ainda pendentes, em qualquer data (não só a que está sendo vista
  // agora), olhando apenas as linhas "de origem" (uma entrega original, não uma continuação
  // automática) e somando o que já foi resolvido em dias seguintes. Assim que uma sobra for
  // totalmente diluída — em qualquer dia — ela sai sozinha desta lista. Aparecem sempre da
  // data de entrada mais antiga para a mais nova, pois é nessa ordem que devem ser vendidas.
  const sobrasPendentes = listarDatas()
    .flatMap((dataEntrada) =>
      getLinhas(dataEntrada)
        .filter((linha) => !linha.origemLinhaId && linha.qtd !== null)
        .map((linha) => {
          const resumo = resumoComCadeia(getLinhas, dataEntrada, linha);
          return { dataEntrada, linha, resumo, sobra: calcularSobra(linha.qtd, resumo) };
        }),
    )
    .filter((item) => item.sobra > 0)
    .sort((a, b) => a.dataEntrada.localeCompare(b.dataEntrada));

  function resolverSobra(dataEntrada: string, linha: LinhaPlanilha) {
    const ponta = pontaDaCadeia(getLinhas, dataEntrada, linha);
    setSobrasAbertas(false);
    setData(ponta.data);
    setEditandoLinhaId(ponta.linha.id);
  }

  // Mantém a sobra de cada linha sincronizada automaticamente com o dia seguinte,
  // sem precisar de nenhum clique: assim que surge (ou deixa de existir) uma sobra,
  // a linha do próximo dia é criada, atualizada ou removida sozinha.
  useEffect(() => {
    for (const linha of linhas) {
      if (linha.qtd === null) continue;
      const resumo = resumoDestinos(linha.destinos);
      if (resumo.total === 0) continue; // ainda não começou a distribuir, não antecipa sobra
      const sobra = calcularSobra(linha.qtd, resumo);
      sincronizarSobra({
        dataOrigem: data,
        linhaOrigemId: linha.id,
        produtor: linha.produtor,
        mercadoria: linha.mercadoria,
        preco: linha.preco,
        sobra,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, data]);

  function solicitarRemocao(linha: LinhaPlanilha) {
    if (linhaPossuiDados(linha)) {
      setLinhaParaExcluir(linha);
    } else {
      removeLinha(data, linha.id);
    }
  }

  function confirmarRemocao() {
    if (!linhaParaExcluir) return;
    removeLinha(data, linhaParaExcluir.id);
    setLinhaParaExcluir(null);
  }

  function adicionarDestino(linha: LinhaPlanilha) {
    const novoDestino: DestinoEntrada = { id: generateId("dest"), cliente: "", data, boa: null, fraca: null };
    updateLinha(data, linha.id, { destinos: [...linha.destinos, novoDestino] });
  }

  function atualizarDestino(linha: LinhaPlanilha, destinoId: string, patch: Partial<Omit<DestinoEntrada, "id">>) {
    updateLinha(data, linha.id, {
      destinos: linha.destinos.map((d) => (d.id === destinoId ? { ...d, ...patch } : d)),
    });
  }

  function removerDestino(linha: LinhaPlanilha, destinoId: string) {
    updateLinha(data, linha.id, { destinos: linha.destinos.filter((d) => d.id !== destinoId) });
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm shadow-brand-900/5">
      <div className="flex flex-col gap-3 border-b border-brand-100 bg-gradient-to-br from-brand-50/70 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <NotebookPen size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Planilha do dia</h2>
            <p className="text-xs text-neutral-500">
              {preenchidas} de {linhas.length} linhas preenchidas · estilo livre, igual à folha de papel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSobrasAbertas(true)}
            className="relative flex items-center gap-1.5 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-700 transition hover:bg-warning-100"
          >
            <AlertTriangle size={14} />
            Sobras
            {sobrasPendentes.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-500 px-1 text-[10px] font-bold text-white">
                {sobrasPendentes.length}
              </span>
            )}
          </button>

          <div className="h-6 w-px bg-neutral-200" />

          <button
            type="button"
            onClick={() => setData((d) => addDays(d, -1))}
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-white hover:text-neutral-600"
            aria-label="Dia anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600">
            <CalendarDays size={14} className="text-brand-600" />
            {formatDate(data)} · {weekdayLabel(data)}
          </div>

          <button
            type="button"
            onClick={() => setData((d) => addDays(d, 1))}
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-white hover:text-neutral-600"
            aria-label="Próximo dia"
          >
            <ChevronRight size={18} />
          </button>

          {!ehHoje && (
            <Button variant="outline" size="sm" onClick={() => setData(hojeISO)}>
              Hoje
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="w-10 border-b border-neutral-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                #
              </th>
              <th className="min-w-[170px] border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Produtor (Fornecedor)
              </th>
              <th className="w-24 border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Qtd.
              </th>
              <th className="w-32 border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Qtd. feita
                <span className="block text-[9px] font-normal normal-case tracking-normal text-neutral-400">
                  soma automática
                </span>
              </th>
              <th className="min-w-[150px] border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Mercadoria
              </th>
              <th className="w-28 border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Preço
              </th>
              <th className="min-w-[200px] border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Destino
              </th>
              <th className="w-12 border-b border-neutral-200 px-2.5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, index) => {
              // Soma o que foi distribuído nesta linha + o que já foi resolvido nos dias
              // seguintes (sobra vendida depois), para que esta linha apareça "Completo"
              // assim que tudo for contabilizado, mesmo que parte tenha sido vendida depois.
              const resumo = resumoComCadeia(getLinhas, data, linha);
              const status = statusQtdFeita(linha.qtd, resumo);
              const sobra = calcularSobra(linha.qtd, resumo);
              return (
                <tr key={linha.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                  <td className="px-3 text-xs font-medium text-neutral-300">{index + 1}</td>
                  <td className="p-0.5">
                    <input
                      className={cellInputClass}
                      value={linha.produtor}
                      onChange={(e) => updateLinha(data, linha.id, { produtor: e.target.value })}
                      placeholder="Ex: João da Silva"
                    />
                    {linha.origemSobraDe && (
                      <span className="ml-2.5 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                        <CornerDownRight size={10} /> Sobra de {formatDate(linha.origemSobraDe)}
                      </span>
                    )}
                  </td>
                  <td className="p-0.5">
                    <input
                      type="number"
                      min={0}
                      className={cellInputClass}
                      value={linha.qtd ?? ""}
                      onChange={(e) =>
                        updateLinha(data, linha.id, { qtd: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2.5 py-1.5 align-middle">
                    {status === "vazio" && <span className="text-sm text-neutral-300">—</span>}

                    {status !== "vazio" && (
                      <div className="leading-tight">
                        <span className="text-sm font-semibold text-neutral-700">
                          {resumo.total}
                          {linha.qtd !== null && <span className="font-normal text-neutral-400"> / {linha.qtd}</span>}
                        </span>
                        <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[11px]">
                          {resumo.boa > 0 && <span className="font-medium text-success-600">{resumo.boa} boa</span>}
                          {resumo.fraca > 0 && (
                            <span className="font-medium text-warning-600">{resumo.fraca} fraca</span>
                          )}
                        </div>

                        {status === "completo" && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-600">
                            <CheckCircle2 size={11} /> Completo
                          </span>
                        )}

                        {status === "excedente" && (
                          <p className="mt-1 text-[10px] font-medium text-danger-500">
                            {resumo.total - (linha.qtd ?? 0)} a mais que a Qtd.
                          </p>
                        )}

                        {status === "parcial" && (
                          <p className="mt-1 text-[11px] font-semibold text-warning-600">Sobra: {sobra}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-0.5">
                    <MercadoriaAutocomplete
                      value={linha.mercadoria}
                      onChange={(v) => updateLinha(data, linha.id, { mercadoria: v })}
                      sugestoes={sugestoesMercadoria}
                      desabilitado={!!linha.origemLinhaId}
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={cellInputClass}
                      value={linha.preco ?? ""}
                      onChange={(e) =>
                        updateLinha(data, linha.id, {
                          preco: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="R$ 0,00"
                    />
                  </td>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={() => setEditandoLinhaId(linha.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-2.5 py-2 text-left text-xs font-medium text-neutral-500 transition hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700"
                    >
                      <MapPinPlus size={14} className="shrink-0 text-brand-500" />
                      {linha.destinos.length === 0 ? (
                        "Adicionar destino"
                      ) : (
                        <span className="truncate">
                          {linha.destinos.length}{" "}
                          {linha.destinos.length === 1 ? "destino informado" : "destinos informados"}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      onClick={() => solicitarRemocao(linha)}
                      title="Remover linha"
                      className="rounded-lg p-2 text-neutral-300 transition hover:bg-danger-50 hover:text-danger-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-400">
          Clique em <strong className="font-medium text-neutral-500">"Adicionar destino"</strong> para informar, para
          cada cliente, quantas unidades boas e fracas foram entregues. A{" "}
          <strong className="font-medium text-neutral-500">Qtd. feita</strong> soma tudo automaticamente e, se sobrar
          quantidade em relação à Qtd., ela já aparece sozinha na planilha do dia seguinte — sem precisar clicar em
          nada.
        </p>
        <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => addLinha(data)}>
          Adicionar linha
        </Button>
      </div>

      {/* Modal de destinos por cliente */}
      <Modal
        open={!!linhaEmEdicao}
        onClose={() => setEditandoLinhaId(null)}
        title="Destinos desta entrega"
        description={
          linhaEmEdicao
            ? `${linhaEmEdicao.produtor || "Produtor não informado"} · ${
                linhaEmEdicao.mercadoria || "Mercadoria não informada"
              }`
            : undefined
        }
        size="xl"
      >
        {linhaEmEdicao && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="min-w-[200px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Cliente
                    </th>
                    <th className="w-36 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Data
                    </th>
                    {tiposDisponiveis.length > 0 && (
                      <th className="w-40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Tipo
                      </th>
                    )}
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Boa
                    </th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Fraca
                    </th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {linhaEmEdicao.destinos.length === 0 && (
                    <tr>
                      <td colSpan={tiposDisponiveis.length > 0 ? 6 : 5} className="px-3 py-6 text-center text-sm text-neutral-400">
                        Nenhum destino adicionado ainda.
                      </td>
                    </tr>
                  )}
                  {linhaEmEdicao.destinos.map((destino) => (
                    <tr key={destino.id} className="border-t border-neutral-100">
                      <td className="p-1.5">
                        <input
                          className={modalInputClass}
                          value={destino.cliente}
                          onChange={(e) => atualizarDestino(linhaEmEdicao, destino.id, { cliente: e.target.value })}
                          placeholder="Ex: Mercado Bom Preço"
                          autoFocus={!destino.cliente && !destino.boa && !destino.fraca}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="date"
                          className={modalInputClass}
                          value={destino.data ?? data}
                          onChange={(e) =>
                            atualizarDestino(linhaEmEdicao, destino.id, { data: e.target.value || data })
                          }
                        />
                      </td>
                      {tiposDisponiveis.length > 0 && (
                        <td className="p-1.5">
                          <select
                            className="h-10 w-full min-w-[148px] rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                            value={destino.tipo ?? ""}
                            onChange={(e) =>
                              atualizarDestino(linhaEmEdicao, destino.id, {
                                tipo: e.target.value || undefined,
                              })
                            }
                          >
                            <option value="">— tipo —</option>
                            {tiposDisponiveis.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="p-1.5">
                        <input
                          type="number"
                          min={0}
                          className={modalInputClass}
                          value={destino.boa ?? ""}
                          onChange={(e) =>
                            atualizarDestino(linhaEmEdicao, destino.id, {
                              boa: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          min={0}
                          className={modalInputClass}
                          value={destino.fraca ?? ""}
                          onChange={(e) =>
                            atualizarDestino(linhaEmEdicao, destino.id, {
                              fraca: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removerDestino(linhaEmEdicao, destino.id)}
                          title="Remover destino"
                          className="rounded-lg p-1.5 text-neutral-300 transition hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => adicionarDestino(linhaEmEdicao)}
            >
              Adicionar destino
            </Button>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Total desta entrega</p>
              {(() => {
                const resumo = resumoDestinos(linhaEmEdicao.destinos);
                return (
                  <p className="text-sm font-semibold text-neutral-700">
                    {resumo.total}{" "}
                    <span className="font-normal text-neutral-400">
                      ({resumo.boa} boa · {resumo.fraca} fraca)
                    </span>
                  </p>
                );
              })()}
            </div>

            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button onClick={() => setEditandoLinhaId(null)}>Concluído</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de sobras pendentes (de todas as datas, da mais antiga para a mais nova) */}
      <Modal
        open={sobrasAbertas}
        onClose={() => setSobrasAbertas(false)}
        title="Sobras pendentes"
        description="Data, produtor, quantidade e mercadoria vêm automáticos (são da entrega original). Só falta informar o destino, da data mais antiga para a mais nova — é nessa ordem que devem ser vendidas."
        size="lg"
      >
        {sobrasPendentes.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">Nenhuma sobra pendente no momento.</p>
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
                  <CalendarDays size={15} className="text-brand-600" />
                  <h3 className="text-sm font-bold text-neutral-800">{formatDate(dataEntrada)}</h3>
                  <span className="text-xs text-neutral-400">
                    · {itens.length} {itens.length === 1 ? "produtor" : "produtores"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-neutral-300">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="border border-neutral-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Produtor
                        </th>
                        <th className="border border-neutral-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Qtd.
                        </th>
                        <th className="border border-neutral-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Mercadoria
                        </th>
                        <th className="border border-neutral-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Destino
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map(({ linha, resumo, sobra }) => (
                        <tr key={linha.id} className="bg-warning-50/40">
                          <td className="border border-neutral-300 px-3 py-2.5 align-top font-semibold text-neutral-800">
                            {linha.produtor || "Produtor não informado"}
                          </td>
                          <td className="border border-neutral-300 px-3 py-2.5 align-top">
                            <p className="font-semibold text-neutral-800">{linha.qtd}</p>
                            <p className="mt-0.5 text-xs text-neutral-400">feito: {resumo.total}</p>
                          </td>
                          <td className="border border-neutral-300 px-3 py-2.5 align-top text-neutral-700">
                            {linha.mercadoria || "Mercadoria não informada"}
                          </td>
                          <td className="border border-neutral-300 px-3 py-2.5 align-top">
                            <p className="mb-1.5 text-xs font-bold text-warning-600">Sobra: {sobra}</p>
                            <Button size="sm" variant="outline" onClick={() => resolverSobra(dataEntrada, linha)}>
                              Resolver
                            </Button>
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
      </Modal>

      <ConfirmDialog
        open={!!linhaParaExcluir}
        title="Remover linha da planilha"
        description="Esta linha já possui dados preenchidos. Deseja realmente removê-la?"
        confirmLabel="Remover"
        onConfirm={confirmarRemocao}
        onCancel={() => setLinhaParaExcluir(null)}
      />
    </div>
  );
}
