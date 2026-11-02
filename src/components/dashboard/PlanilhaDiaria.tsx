import {
  CheckCircle2,
  CornerDownRight,
  MapPinPlus,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../context/DataContext";
import { useGarantirDataPlanilha, usePlanilha } from "../../context/PlanilhaContext";
import type { DestinoEntrada, LinhaPlanilha } from "../../types";
import {
  calcularSobra,
  destinoPossuiDados,
  resumoComCadeia,
  resumoDestinos,
  statusQtdFeita,
} from "../../utils/destino";
import { formatDate, toISODate } from "../../utils/format";
import { generateId } from "../../utils/id";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";

const hojeISO = toISODate();

// ── Abreviação do nome do cliente para os chips ───────────────────────────────
function abrevCliente(nome: string): string {
  if (!nome.trim()) return "?";
  const palavras = nome.trim().split(/\s+/);
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

// ── Autocomplete inteligente para o campo Mercadoria ─────────────────────────
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

  function handleFocus() { recalcular(value); }

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

interface PlanilhaDiariaProps {
  data: string;
  setData: (d: string) => void;
}

export function PlanilhaDiaria({ data, setData: _setData }: PlanilhaDiariaProps) {
  useGarantirDataPlanilha(data);

  const { getLinhas, updateLinha, addLinha, removeLinha, sincronizarSobra } = usePlanilha();
  const { produtos } = useData();
  const linhas = getLinhas(data);

  const [linhaParaExcluir, setLinhaParaExcluir] = useState<LinhaPlanilha | null>(null);
  const [editandoLinhaId, setEditandoLinhaId] = useState<string | null>(null);
  const linhaEmEdicao = linhas.find((l) => l.id === editandoLinhaId) ?? null;

  // Sugestões de mercadoria com tipos
  const sugestoesMercadoria = useMemo(() => {
    const lista: string[] = [];
    for (const p of produtos.filter((p) => p.situacao === "ativo")) {
      const tipos = p.tipos ?? [];
      if (tipos.length === 0) {
        lista.push(p.nome);
      } else {
        for (const t of tipos) lista.push(`${p.nome} ${t}`);
      }
    }
    return lista;
  }, [produtos]);

  // Tipos disponíveis para a linha em edição
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

  // Sincroniza sobras com o dia seguinte automaticamente
  useEffect(() => {
    for (const linha of linhas) {
      if (linha.qtd === null) continue;
      const resumo = resumoDestinos(linha.destinos);
      if (resumo.total === 0) continue;
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

  const ehHoje = data === hojeISO;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* ── Tabela de operações ── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="w-8 border-b border-neutral-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                #
              </th>
              <th className="min-w-[160px] border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Produtor
              </th>
              <th className="w-20 border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Qtd.
              </th>
              <th className="w-28 border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Qtd. feita
              </th>
              <th className="min-w-[150px] border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Mercadoria
              </th>
              <th className="w-24 border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Preço
              </th>
              <th className="border-b border-neutral-200 px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Destino
              </th>
              <th className="w-10 border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-neutral-400">
                  Nenhuma entrada registrada. Clique em "+ Adicionar entrada" para começar.
                </td>
              </tr>
            )}
            {linhas.map((linha, index) => {
              const resumo = resumoComCadeia(getLinhas, data, linha);
              const status = statusQtdFeita(linha.qtd, resumo);
              const sobra = calcularSobra(linha.qtd, resumo);
              return (
                <tr
                  key={linha.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60"
                >
                  <td className="px-3 text-xs font-medium text-neutral-300">{index + 1}</td>

                  {/* Produtor */}
                  <td className="p-0.5">
                    <input
                      className={cellInputClass}
                      value={linha.produtor}
                      onChange={(e) => updateLinha(data, linha.id, { produtor: e.target.value })}
                      placeholder="Produtor / Fornecedor"
                    />
                    {linha.origemSobraDe && (
                      <span className="ml-2.5 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                        <CornerDownRight size={10} /> Sobra de {formatDate(linha.origemSobraDe)}
                      </span>
                    )}
                  </td>

                  {/* Qtd */}
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

                  {/* Qtd. feita */}
                  <td className="px-2.5 py-1.5 align-middle">
                    {status === "vazio" ? (
                      <span className="text-sm text-neutral-300">—</span>
                    ) : (
                      <div className="leading-tight">
                        <span className="text-sm font-semibold text-neutral-700">
                          {resumo.total}
                          {linha.qtd !== null && (
                            <span className="font-normal text-neutral-400"> / {linha.qtd}</span>
                          )}
                        </span>
                        <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[11px]">
                          {resumo.boa > 0 && <span className="font-medium text-success-600">{resumo.boa} boa</span>}
                          {resumo.fraca > 0 && <span className="font-medium text-warning-600">{resumo.fraca} fr.</span>}
                        </div>
                        {status === "completo" && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-600">
                            <CheckCircle2 size={10} /> Completo
                          </span>
                        )}
                        {status === "parcial" && (
                          <p className="mt-0.5 text-[10px] font-semibold text-warning-600">Sobra: {sobra}</p>
                        )}
                        {status === "excedente" && (
                          <p className="mt-0.5 text-[10px] font-medium text-danger-500">
                            +{resumo.total - (linha.qtd ?? 0)} a mais
                          </p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Mercadoria */}
                  <td className="p-0.5">
                    <MercadoriaAutocomplete
                      value={linha.mercadoria}
                      onChange={(v) => updateLinha(data, linha.id, { mercadoria: v })}
                      sugestoes={sugestoesMercadoria}
                      desabilitado={!!linha.origemLinhaId}
                    />
                  </td>

                  {/* Preço */}
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
                      placeholder="R$ 0"
                    />
                  </td>

                  {/* ── Destino — chips compactos ── */}
                  <td className="px-1.5 py-1.5 align-middle">
                    <div
                      className="flex min-h-[36px] cursor-pointer flex-wrap items-center gap-1 rounded-lg p-1 transition hover:bg-neutral-50"
                      onClick={() => setEditandoLinhaId(linha.id)}
                      title="Clique para gerenciar destinos"
                    >
                      {linha.destinos.map((d) => (
                        <span key={d.id} className="contents">
                          {(d.boa ?? 0) > 0 && (
                            <span className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700">
                              {d.boa} {abrevCliente(d.cliente)}
                            </span>
                          )}
                          {(d.fraca ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700">
                              {d.fraca} {abrevCliente(d.cliente)}
                              <Zap size={9} />
                            </span>
                          )}
                        </span>
                      ))}
                      {sobra > 0 && (
                        <span className="inline-flex items-center rounded-md border border-dashed border-warning-300 bg-warning-50/60 px-2 py-0.5 text-[11px] font-bold text-warning-600">
                          {sobra} sobra
                        </span>
                      )}
                      {linha.destinos.length === 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                          <MapPinPlus size={12} className="text-brand-400" />
                          + destino
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Excluir */}
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      onClick={() => solicitarRemocao(linha)}
                      className="rounded-lg p-2 text-neutral-300 transition hover:bg-danger-50 hover:text-danger-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Rodapé ── */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-400">
          {ehHoje ? "Planilha de hoje" : `Planilha de ${formatDate(data)}`}
          {" · "}{linhas.filter(linhaPossuiDados).length} de {linhas.length} linhas preenchidas
        </p>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => addLinha(data)}>
          Adicionar entrada
        </Button>
      </div>

      {/* ── Modal destinos ── */}
      <Modal
        open={!!linhaEmEdicao}
        onClose={() => setEditandoLinhaId(null)}
        title="Destinos desta entrega"
        description={
          linhaEmEdicao
            ? `${linhaEmEdicao.produtor || "Produtor não informado"} · ${linhaEmEdicao.mercadoria || "Mercadoria não informada"}`
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
                    <th className="min-w-[200px] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Cliente</th>
                    <th className="w-36 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Data</th>
                    {tiposDisponiveis.length > 0 && (
                      <th className="w-40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Tipo</th>
                    )}
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Boa</th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Fraca</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {linhaEmEdicao.destinos.length === 0 && (
                    <tr>
                      <td colSpan={tiposDisponiveis.length > 0 ? 6 : 5} className="px-3 py-6 text-center text-sm text-neutral-400">
                        Nenhum destino ainda. Clique em "+ Adicionar destino".
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
                          onChange={(e) => atualizarDestino(linhaEmEdicao, destino.id, { data: e.target.value || data })}
                        />
                      </td>
                      {tiposDisponiveis.length > 0 && (
                        <td className="p-1.5">
                          <select
                            className="h-10 w-full min-w-[148px] rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                            value={destino.tipo ?? ""}
                            onChange={(e) => atualizarDestino(linhaEmEdicao, destino.id, { tipo: e.target.value || undefined })}
                          >
                            <option value="">— tipo —</option>
                            {tiposDisponiveis.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="p-1.5">
                        <input
                          type="number" min={0} className={modalInputClass}
                          value={destino.boa ?? ""}
                          onChange={(e) => atualizarDestino(linhaEmEdicao, destino.id, { boa: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number" min={0} className={modalInputClass}
                          value={destino.fraca ?? ""}
                          onChange={(e) => atualizarDestino(linhaEmEdicao, destino.id, { fraca: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removerDestino(linhaEmEdicao, destino.id)}
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

            <Button variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => adicionarDestino(linhaEmEdicao)}>
              Adicionar destino
            </Button>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Total desta entrega</p>
              {(() => {
                const r = resumoDestinos(linhaEmEdicao.destinos);
                return (
                  <p className="text-sm font-semibold text-neutral-700">
                    {r.total}{" "}
                    <span className="font-normal text-neutral-400">({r.boa} boa · {r.fraca} fraca)</span>
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

      <ConfirmDialog
        open={!!linhaParaExcluir}
        title="Remover linha"
        description="Esta linha já possui dados. Deseja realmente removê-la?"
        confirmLabel="Remover"
        onConfirm={confirmarRemocao}
        onCancel={() => setLinhaParaExcluir(null)}
      />
    </div>
  );
}
