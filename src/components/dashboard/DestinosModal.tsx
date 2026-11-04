import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import type { EntradaLancamento } from "../../types";
import { capacidadeEntrada, destinosDoDia } from "../../utils/alocacao";
import { opcoesClassificacao, patchQtd, patchTipo, qtdDestino } from "../../utils/classificacao";
import { resumoDestinos } from "../../utils/destino";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";

const modalInputClass =
  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

interface DestinosModalProps {
  open: boolean;
  onClose: () => void;
  entrada: EntradaLancamento | undefined;
  dataDestino: string;
  descricao?: string;
}

export function DestinosModal({ open, onClose, entrada, dataDestino, descricao }: DestinosModalProps) {
  const { entradas, addDestino, updateDestino, removeDestino, updateEntrada } = usePlanilha();
  const { clientes } = useData();
  const [rendimento, setRendimento] = useState<number | null>(null);

  const atual = entrada ? entradas.find((e) => e.id === entrada.id) ?? entrada : undefined;
  const destinos = atual ? destinosDoDia(atual, dataDestino) : [];

  const clientesSugestao = useMemo(() => {
    const nomes = new Set(clientes.map((c) => c.nome));
    for (const e of entradas) {
      for (const d of e.destinos ?? []) if (d.cliente.trim()) nomes.add(d.cliente);
    }
    return [...nomes].sort();
  }, [clientes, entradas]);

  function fechar() {
    if (atual) {
      const todos = atual.destinos ?? [];
      const total = todos.reduce((s, d) => s + (d.boa ?? 0) + (d.fraca ?? 0) + (d.perda ?? 0), 0);
      const cap = capacidadeEntrada(atual);
      if (cap > 0 && total > cap) {
        setRendimento(total - cap);
        return;
      }
    }
    onClose();
  }

  return (
    <>
      <Modal
        open={open && !!atual}
        onClose={fechar}
        title="Destinos desta entrega"
        description={
          descricao ??
          (atual ? `${atual.produtor || "Produtor"} · ${atual.mercadoria || "Mercadoria"}` : undefined)
        }
        size="lg"
      >
        {atual && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="min-w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">Cliente</th>
                    <th className="min-w-[170px] px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">Tipo</th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">Qtd</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {destinos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-400">
                        Nenhum destino neste dia. Clique em Adicionar destino.
                      </td>
                    </tr>
                  )}
                  {destinos.map((destino) => (
                    <tr key={destino.id} className="border-t border-neutral-100">
                      <td className="p-1.5">
                        <Autocomplete
                          compact
                          value={destino.cliente}
                          onChange={(cliente) =>
                            updateDestino(atual.id, destino.id, { cliente, data: dataDestino })
                          }
                          sugestoes={clientesSugestao}
                          placeholder="Cliente"
                        />
                      </td>
                      <td className="p-1.5">
                        <Select
                          value={destino.tipo ?? ""}
                          onChange={(e) =>
                            updateDestino(atual.id, destino.id, {
                              ...patchTipo(e.target.value, destino),
                              data: dataDestino,
                            })
                          }
                        >
                          <option value="">Classificar</option>
                          {opcoesClassificacao(atual.mercadoria).map((opcao) => (
                            <option key={opcao.value} value={opcao.value}>
                              {opcao.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          min={0}
                          className={modalInputClass}
                          value={qtdDestino(destino) ?? ""}
                          onChange={(e) =>
                            updateDestino(atual.id, destino.id, {
                              ...patchQtd(destino.tipo, e.target.value === "" ? null : Number(e.target.value)),
                              data: dataDestino,
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeDestino(atual.id, destino.id)}
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
                addDestino(atual.id, { cliente: "", data: dataDestino, tipo: "", boa: null, fraca: null });
              }}
            >
              Adicionar destino
            </Button>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Total desta entrega</p>
              {(() => {
                const r = resumoDestinos(destinos);
                return (
                  <p className="text-sm font-semibold text-neutral-700">
                    {r.total}{" "}
                    <span className="font-normal text-neutral-400">({r.boa} bom · {r.fraca} fraco)</span>
                  </p>
                );
              })()}
            </div>

            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button onClick={fechar}>Concluído</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={rendimento !== null} onClose={() => setRendimento(null)} title="Saiu mais do que entrou" size="sm">
        {rendimento !== null && atual && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              O destino passou {rendimento} cx do que entrou. Rendeu mais?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setRendimento(null)}>Não</Button>
              <Button
                fullWidth
                onClick={() => {
                  updateEntrada(atual.id, {
                    rendimentoExtra: (atual.rendimentoExtra ?? 0) + rendimento,
                  });
                  setRendimento(null);
                  onClose();
                }}
              >
                Sim, rendeu mais
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
