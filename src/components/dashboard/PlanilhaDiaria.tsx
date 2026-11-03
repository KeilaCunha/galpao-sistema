import { CornerDownRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import type { DestinoEntrada, EntradaLancamento, LinhaPlanilha } from "../../types";
import { abrevCliente, abrevMercadoria } from "../../utils/abrev";
import { capacidadeEntrada } from "../../utils/alocacao";
import { calcularSobra, resumoDestinos, statusQtdFeita } from "../../utils/destino";
import { formatDate } from "../../utils/format";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";

const cellClass =
  "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

const modalInputClass =
  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

interface PlanilhaDiariaProps {
  data: string;
  linhas: LinhaPlanilha[];
}

function idReal(linha: LinhaPlanilha): string {
  return linha.origemLinhaId ?? linha.id;
}

export function PlanilhaDiaria({ data, linhas }: PlanilhaDiariaProps) {
  const { entradas, addEntrada, updateEntrada, removeEntrada, addDestino, updateDestino, removeDestino } = usePlanilha();
  const { produtos, fornecedores, clientes } = useData();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [rendimento, setRendimento] = useState<{ entradaId: string; extra: number } | null>(null);

  const produtores = useMemo(() => {
    const nomes = new Set(fornecedores.map((f) => f.nome));
    for (const e of entradas) if (e.produtor.trim()) nomes.add(e.produtor);
    return [...nomes].sort();
  }, [fornecedores, entradas]);

  const mercadorias = useMemo(() => {
    const lista: string[] = [];
    for (const p of produtos.filter((item) => item.situacao === "ativo")) {
      const tipos = p.tipos ?? [];
      if (tipos.length === 0) lista.push(p.nome);
      else for (const t of tipos) lista.push(`${p.nome} ${t}`);
    }
    for (const e of entradas) {
      if (e.mercadoria && !lista.some((n) => n.toLowerCase() === e.mercadoria.toLowerCase())) {
        lista.push(e.mercadoria);
      }
    }
    return lista;
  }, [produtos, entradas]);

  const clientesSugestao = useMemo(() => {
    const nomes = new Set(clientes.map((c) => c.nome));
    for (const e of entradas) {
      for (const d of e.destinos ?? []) if (d.cliente.trim()) nomes.add(d.cliente);
    }
    return [...nomes].sort();
  }, [clientes, entradas]);

  const linhaModal = linhas.find((l) => l.id === editandoId) ?? null;
  const entradaModal = linhaModal
    ? entradas.find((e) => e.id === idReal(linhaModal))
    : undefined;

  const destinosModal = useMemo(() => {
    if (!linhaModal || !entradaModal) return [];
    const todos = entradaModal.destinos ?? [];
    if (linhaModal.origemLinhaId) {
      return todos.filter((d) => (d.data || entradaModal.data) >= data);
    }
    return todos;
  }, [linhaModal, entradaModal, data]);

  function entradaDaLinha(linha: LinhaPlanilha): EntradaLancamento | undefined {
    return entradas.find((e) => e.id === idReal(linha));
  }

  function checarRendimento(entrada: EntradaLancamento, destinos: DestinoEntrada[]) {
    const total = destinos.reduce((s, d) => s + (d.boa ?? 0) + (d.fraca ?? 0) + (d.perda ?? 0), 0);
    const cap = capacidadeEntrada(entrada);
    if (cap > 0 && total > cap) {
      setRendimento({ entradaId: entrada.id, extra: total - cap });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-600">Operações</h3>
        <p className="text-[11px] text-neutral-400">Digite na linha. O destino aparece em chips sozinho.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="min-w-[150px] border-b border-neutral-200 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Produtor</th>
              <th className="w-16 border-b border-neutral-200 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Qtd</th>
              <th className="w-32 border-b border-neutral-200 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Qtd feita</th>
              <th className="min-w-[140px] border-b border-neutral-200 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Merc.</th>
              <th className="w-20 border-b border-neutral-200 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Preço</th>
              <th className="border-b border-neutral-200 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Destino</th>
              <th className="w-10 border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const resumo = resumoDestinos(linha.destinos);
              const status = statusQtdFeita(linha.qtd, resumo);
              const sobra = calcularSobra(linha.qtd, resumo);
              const sobraHerdada = Boolean(linha.origemLinhaId);
              return (
                <tr key={linha.id} className="border-b border-neutral-50 last:border-0">
                  <td className="p-1 align-top">
                    {sobraHerdada ? (
                      <div className="px-2 py-1.5">
                        <p className="font-semibold text-neutral-800">{linha.produtor || "—"}</p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-neutral-400">
                          <CornerDownRight size={10} /> Sobra de {formatDate(linha.origemSobraDe ?? "")}
                        </span>
                      </div>
                    ) : (
                      <Autocomplete
                        compact
                        value={linha.produtor}
                        onChange={(produtor) => updateEntrada(linha.id, { produtor })}
                        sugestoes={produtores}
                        placeholder="Produtor"
                      />
                    )}
                  </td>
                  <td className="p-1 align-top">
                    {sobraHerdada ? (
                      <p className="px-2 py-2 font-semibold tabular-nums">{linha.qtd ?? "—"}</p>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        className={cellClass}
                        value={linha.qtd || ""}
                        onChange={(e) =>
                          updateEntrada(linha.id, { qtd: e.target.value === "" ? 0 : Number(e.target.value) })
                        }
                        placeholder="0"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {status === "vazio" ? (
                      <span className="text-neutral-300">—</span>
                    ) : (
                      <div className="leading-tight">
                        <p className="font-semibold text-neutral-800">
                          {resumo.boa}
                          {resumo.fraca > 0 && (
                            <span className="text-warning-600">
                              {" + "}{resumo.fraca}
                              <sup className="text-[9px]">fr</sup>
                            </span>
                          )}
                          {resumo.perda > 0 && (
                            <span className="text-danger-500"> + {resumo.perda} perda</span>
                          )}
                        </p>
                        {status === "parcial" && (
                          <p className="mt-0.5 text-[11px] font-medium text-danger-500">falta fazer {sobra}</p>
                        )}
                        {status === "completo" && (
                          <p className="mt-0.5 text-[11px] font-medium text-success-600">completo</p>
                        )}
                        {status === "excedente" && (
                          <p className="mt-0.5 text-[11px] font-medium text-danger-500">rendeu a mais</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-1 align-top">
                    {sobraHerdada ? (
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-bold tracking-wide text-neutral-400">{abrevMercadoria(linha.mercadoria)}</p>
                        <p className="text-sm text-neutral-700">{linha.mercadoria}</p>
                      </div>
                    ) : (
                      <Autocomplete
                        compact
                        value={linha.mercadoria}
                        onChange={(mercadoria) => updateEntrada(linha.id, { mercadoria })}
                        sugestoes={mercadorias}
                        placeholder="Mercadoria"
                      />
                    )}
                  </td>
                  <td className="p-1 align-top">
                    {sobraHerdada ? (
                      <p className="px-2 py-2 text-neutral-400">—</p>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cellClass}
                        value={linha.preco ?? ""}
                        onChange={(e) =>
                          updateEntrada(linha.id, {
                            preco: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="R$"
                      />
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 align-top">
                    <div
                      className="flex min-h-[36px] cursor-pointer flex-wrap items-center gap-1 rounded-lg p-1 transition hover:bg-neutral-50"
                      onClick={() => setEditandoId(linha.id)}
                      title="Clique para informar destinos"
                    >
                      {linha.destinos.map((destino) => (
                        <span key={destino.id} className="contents">
                          {(destino.boa ?? 0) > 0 && (
                            <span className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700">
                              {destino.boa} {abrevCliente(destino.cliente)}
                            </span>
                          )}
                          {(destino.fraca ?? 0) > 0 && (
                            <span className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-[11px] font-bold text-warning-700">
                              {destino.fraca} {abrevCliente(destino.cliente)}
                              <sup className="ml-0.5 text-[8px] font-extrabold">fr</sup>
                            </span>
                          )}
                          {(destino.perda ?? 0) > 0 && (
                            <span className="inline-flex items-center rounded-md bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-600">
                              {destino.perda} perda
                            </span>
                          )}
                        </span>
                      ))}
                      {sobra > 0 && (
                        <span className="inline-flex items-center rounded-md border border-dashed border-danger-500/50 bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-600">
                          {sobra} sobra
                        </span>
                      )}
                      {linha.destinos.length === 0 && (
                        <span className="text-[11px] text-neutral-400">+ destino</span>
                      )}
                    </div>
                  </td>
                  <td className="p-1 text-center align-top">
                    {!sobraHerdada && (
                      <button
                        type="button"
                        onClick={() => setExcluirId(linha.id)}
                        className="rounded-lg p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-400">
          {linhas.filter((l) => l.produtor || l.mercadoria || (l.qtd ?? 0) > 0).length} linhas com dados
        </p>
        <Button
          variant="outline"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => addEntrada({ data, produtor: "", mercadoria: "", qtd: 0, preco: null, destinos: [] })}
        >
          Adicionar linha
        </Button>
      </div>

      <Modal
        open={!!linhaModal}
        onClose={() => setEditandoId(null)}
        title="Destinos desta entrega"
        description={
          linhaModal
            ? `${linhaModal.produtor || "Produtor"} · ${linhaModal.mercadoria || "Mercadoria"}`
            : undefined
        }
        size="lg"
      >
        {linhaModal && entradaModal && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="min-w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">Cliente</th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">Boa</th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">Fraca</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {destinosModal.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-400">
                        Nenhum destino. Clique em Adicionar destino.
                      </td>
                    </tr>
                  )}
                  {destinosModal.map((destino) => (
                    <tr key={destino.id} className="border-t border-neutral-100">
                      <td className="p-1.5">
                        <Autocomplete
                          compact
                          value={destino.cliente}
                          onChange={(cliente) => updateDestino(entradaModal.id, destino.id, { cliente })}
                          sugestoes={clientesSugestao}
                          placeholder="Cliente"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          min={0}
                          className={modalInputClass}
                          value={destino.boa ?? ""}
                          onChange={(e) =>
                            updateDestino(entradaModal.id, destino.id, {
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
                            updateDestino(entradaModal.id, destino.id, {
                              fraca: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeDestino(entradaModal.id, destino.id)}
                          className="rounded-lg p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
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
              onClick={() => {
                addDestino(entradaModal.id, { cliente: "", data, boa: null, fraca: null });
              }}
            >
              Adicionar destino
            </Button>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Total desta entrega</p>
              {(() => {
                const r = resumoDestinos(destinosModal);
                return (
                  <p className="text-sm font-semibold text-neutral-700">
                    {r.total}{" "}
                    <span className="font-normal text-neutral-400">({r.boa} boa · {r.fraca} fraca)</span>
                  </p>
                );
              })()}
            </div>

            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button
                onClick={() => {
                  const atual = entradaDaLinha(linhaModal);
                  if (atual) checarRendimento(atual, atual.destinos ?? []);
                  setEditandoId(null);
                }}
              >
                Concluído
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!excluirId}
        title="Remover linha"
        description="Deseja remover esta linha da folha?"
        confirmLabel="Remover"
        onConfirm={() => {
          if (excluirId) removeEntrada(excluirId);
          setExcluirId(null);
        }}
        onCancel={() => setExcluirId(null)}
      />

      <Modal open={!!rendimento} onClose={() => setRendimento(null)} title="Saiu mais do que entrou" size="sm">
        {rendimento && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              O destino passou {rendimento.extra} cx do que entrou. Rendeu mais?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setRendimento(null)}>Não</Button>
              <Button
                fullWidth
                onClick={() => {
                  const entrada = entradas.find((e) => e.id === rendimento.entradaId);
                  if (entrada) {
                    updateEntrada(entrada.id, {
                      rendimentoExtra: (entrada.rendimentoExtra ?? 0) + rendimento.extra,
                    });
                  }
                  setRendimento(null);
                }}
              >
                Sim, rendeu mais
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
