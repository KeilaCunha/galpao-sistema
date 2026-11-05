import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import type { DestinoEntrada, LinhaPlanilha } from "../../types";
import { ehTomate, resumoFeitaTomate } from "../../utils/classificacao";
import { calcularRendimento, calcularSobra, resumoDestinos, statusQtdFeita } from "../../utils/destino";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DestinoChips } from "./DestinoChips";
import { DestinosModal } from "./DestinosModal";

const cellClass =
  "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

interface PlanilhaDiariaProps {
  data: string;
  linhas: LinhaPlanilha[];
}

export function PlanilhaDiaria({ data, linhas }: PlanilhaDiariaProps) {
  const { entradas, addEntrada, updateEntrada, removeEntrada } = usePlanilha();
  const { produtos, fornecedores } = useData();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const produtores = useMemo(() => {
    const nomes = new Set(fornecedores.map((f) => f.nome));
    for (const e of entradas) if (e.produtor.trim()) nomes.add(e.produtor);
    return [...nomes].sort();
  }, [fornecedores, entradas]);

  const mercadorias = useMemo(() => {
    const lista: string[] = [];
    for (const p of produtos.filter((item) => item.situacao === "ativo")) {
      if (!lista.some((n) => n.toLowerCase() === p.nome.toLowerCase())) lista.push(p.nome);
    }
    for (const e of entradas) {
      if (e.mercadoria && !lista.some((n) => n.toLowerCase() === e.mercadoria.toLowerCase())) {
        lista.push(e.mercadoria);
      }
    }
    return lista;
  }, [produtos, entradas]);

  const entradaModal = editandoId ? entradas.find((e) => e.id === editandoId) : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600">Operações</h3>
        <p className="text-xs text-neutral-400">Digite na linha. O destino aparece em chips sozinho.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="min-w-[150px] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Produtor</th>
              <th className="w-16 border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Qtd</th>
              <th className="min-w-[9.5rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Qtd feita</th>
              <th className="min-w-[140px] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Merc.</th>
              <th className="w-20 border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Preço</th>
              <th className="border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Destino</th>
              <th className="w-10 border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const resumo = resumoDestinos(linha.destinos);
              const destinosDia = linha.destinos.filter((destino) => (destino.data || data) === data);
              const status = statusQtdFeita(linha.qtd, resumo);
              const sobra = calcularSobra(linha.qtd, resumo);
              const rendeu = calcularRendimento(linha.qtd, resumo);
              return (
                <tr key={linha.id} className="border-b border-neutral-50 last:border-0">
                  <td className="p-1 align-top">
                    <Autocomplete
                      compact
                      value={linha.produtor}
                      onChange={(produtor) => updateEntrada(linha.id, { produtor })}
                      sugestoes={produtores}
                      placeholder="Produtor"
                    />
                  </td>
                  <td className="p-1 align-top">
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
                  </td>
                  <td className="px-2 py-2 align-top">
                    {status === "vazio" ? (
                      <span className="text-neutral-300">—</span>
                    ) : (
                      <div className="leading-tight">
                        <p className="font-semibold text-neutral-800">
                          {ehTomate(linha.mercadoria) ? (
                            <QtdFeitaTomate destinos={linha.destinos} />
                          ) : (
                            <>
                              {resumo.boa}
                              {resumo.fraca > 0 && (
                                <span className="text-warning-600">
                                  {" + "}{resumo.fraca}
                                  <sup className="text-[10px]">fr</sup>
                                </span>
                              )}
                              {resumo.perda > 0 && (
                                <span className="text-danger-500"> + {resumo.perda} perda</span>
                              )}
                            </>
                          )}
                        </p>
                        {status === "parcial" && (
                          <p className="mt-0.5 text-xs font-medium text-danger-500">falta fazer {sobra}</p>
                        )}
                        {(status === "completo" || status === "excedente") && (
                          <p className="mt-0.5 text-xs font-medium text-success-600">completo</p>
                        )}
                        {rendeu > 0 && (
                          <p className="text-xs font-medium text-brand-600">
                            rendeu {rendeu} {rendeu === 1 ? "caixa" : "caixas"}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-1 align-top">
                    <Autocomplete
                      compact
                      value={linha.mercadoria}
                      onChange={(mercadoria) => updateEntrada(linha.id, { mercadoria })}
                      sugestoes={mercadorias}
                      placeholder="Mercadoria"
                    />
                  </td>
                  <td className="p-1 align-top">
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
                  </td>
                  <td className="px-1.5 py-1.5 align-top">
                    <div
                      className="flex min-h-[36px] cursor-pointer flex-wrap items-center gap-1 rounded-lg p-1 transition hover:bg-neutral-50"
                      onClick={() => setEditandoId(linha.id)}
                      title="Clique para informar destinos"
                    >
                      <DestinoChips destinos={destinosDia} />
                      {sobra > 0 && (
                        <span className="inline-flex items-center rounded-md border border-dashed border-danger-500/50 bg-danger-50 px-2 py-0.5 text-xs font-bold text-danger-600">
                          {sobra} sobra
                        </span>
                      )}
                      {destinosDia.length === 0 && sobra === 0 && (
                        <span className="text-xs text-neutral-400">+ destino</span>
                      )}
                    </div>
                  </td>
                  <td className="p-1 text-center align-top">
                    <button
                      type="button"
                      onClick={() => setExcluirId(linha.id)}
                      className="rounded-lg p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
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

      <DestinosModal
        open={!!editandoId}
        onClose={() => setEditandoId(null)}
        entrada={entradaModal}
        dataDestino={data}
      />

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
    </div>
  );
}

function QtdFeitaTomate({ destinos }: { destinos: DestinoEntrada[] }) {
  const feita = resumoFeitaTomate(destinos);
  const partes: { n: number; sup?: string; aviso?: boolean }[] = [];
  if (feita.bom > 0) partes.push({ n: feita.bom });
  if (feita.aa > 0) partes.push({ n: feita.aa, sup: "aa" });
  if (feita.a > 0) partes.push({ n: feita.a, sup: "a" });
  if (feita.fr > 0) partes.push({ n: feita.fr, sup: "fr", aviso: true });

  if (partes.length === 0 && feita.perda === 0) return <span className="text-neutral-300">—</span>;

  return (
    <>
      {partes.map((parte, i) => (
        <span key={`${parte.sup ?? "bom"}-${i}`} className={parte.aviso ? "text-warning-600" : undefined}>
          {i > 0 ? " + " : ""}
          {parte.n}
          {parte.sup ? <sup className="text-[10px] font-extrabold">{parte.sup}</sup> : null}
        </span>
      ))}
      {feita.perda > 0 && (
        <span className="text-danger-500">
          {partes.length > 0 ? " + " : ""}
          {feita.perda} perda
        </span>
      )}
    </>
  );
}
