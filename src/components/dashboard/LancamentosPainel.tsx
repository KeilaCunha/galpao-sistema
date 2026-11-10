import { Plus, Trash2 } from "lucide-react";
import type { EntradaLancamento, SaidaLancamento } from "../../types";
import { MOTIVOS_PERDA } from "../../types";
import { Button } from "../ui/Button";
import { Autocomplete } from "../ui/Autocomplete";

const cellClass =
  "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

interface LancamentosPainelProps {
  entradas: EntradaLancamento[];
  saidas: SaidaLancamento[];
  produtores: string[];
  mercadorias: string[];
  clientes: string[];
  onAddEntrada: () => void;
  onUpdateEntrada: (id: string, patch: Partial<Omit<EntradaLancamento, "id">>) => void;
  onRemoveEntrada: (id: string) => void;
  onAddSaida: (tipo: "cliente" | "perda") => void;
  onUpdateSaida: (id: string, patch: Partial<Omit<SaidaLancamento, "id">>) => void;
  onRemoveSaida: (id: string) => void;
}

export function LancamentosPainel({
  entradas,
  saidas,
  produtores,
  mercadorias,
  clientes,
  onAddEntrada,
  onUpdateEntrada,
  onRemoveEntrada,
  onAddSaida,
  onUpdateSaida,
  onRemoveSaida,
}: LancamentosPainelProps) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-600">Entradas</h3>
          <span className="text-[11px] font-medium text-neutral-400">
            {entradas.length} {entradas.length === 1 ? "linha" : "linhas"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Produtor</th>
                <th className="w-16 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Cx</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Mercadoria</th>
                <th className="w-20 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Preço</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {entradas.map((entrada, index) => (
                <tr key={entrada.id} className="border-t border-neutral-50">
                  <td className="p-1">
                    <Autocomplete
                      compact
                      tipoItem="fornecedor"
                      autoFocus={
                        index === entradas.length - 1 &&
                        !entrada.produtor &&
                        entradas.slice(0, -1).some((item) => item.produtor || item.mercadoria || item.qtd)
                      }
                      value={entrada.produtor}
                      onChange={(produtor) => onUpdateEntrada(entrada.id, { produtor })}
                      sugestoes={produtores}
                      placeholder="Produtor"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      className={cellClass}
                      value={entrada.qtd || ""}
                      onChange={(e) =>
                        onUpdateEntrada(entrada.id, { qtd: e.target.value === "" ? 0 : Number(e.target.value) })
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="p-1">
                    <Autocomplete
                      compact
                      tipoItem="produto"
                      value={entrada.mercadoria}
                      onChange={(mercadoria) => onUpdateEntrada(entrada.id, { mercadoria })}
                      sugestoes={mercadorias}
                      placeholder="Mercadoria"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={cellClass}
                      value={entrada.preco ?? ""}
                      onChange={(e) =>
                        onUpdateEntrada(entrada.id, {
                          preco: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="R$"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveEntrada(entrada.id)}
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

        <div className="border-t border-neutral-100 px-5 py-3">
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={onAddEntrada}>
            Adicionar entrada
          </Button>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-600">Destinos</h3>
          <span className="text-[11px] font-medium text-neutral-400">
            {saidas.length} {saidas.length === 1 ? "linha" : "linhas"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="w-24 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Tipo</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Cliente / motivo</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Mercadoria</th>
                <th className="w-14 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Boa</th>
                <th className="w-14 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Fraca</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {saidas.map((saida, index) => (
                <tr key={saida.id} className="border-t border-neutral-50">
                  <td className="p-1">
                    <select
                      className={cellClass}
                      value={saida.tipo}
                      onChange={(e) =>
                        onUpdateSaida(saida.id, {
                          tipo: e.target.value as "cliente" | "perda",
                          fraca: e.target.value === "perda" ? 0 : saida.fraca,
                        })
                      }
                    >
                      <option value="cliente">Cliente</option>
                      <option value="perda">Perda</option>
                    </select>
                  </td>
                  <td className="p-1">
                    {saida.tipo === "perda" ? (
                      <select
                        className={cellClass}
                        value={saida.motivo ?? MOTIVOS_PERDA[0]}
                        onChange={(e) => onUpdateSaida(saida.id, { motivo: e.target.value, cliente: "" })}
                      >
                        {MOTIVOS_PERDA.map((motivo) => (
                          <option key={motivo} value={motivo}>{motivo}</option>
                        ))}
                      </select>
                    ) : (
                      <Autocomplete
                        compact
                        tipoItem="cliente"
                        autoFocus={
                          index === saidas.length - 1 &&
                          !saida.cliente &&
                          saidas.slice(0, -1).some((item) => item.cliente || item.mercadoria || item.boa || item.fraca)
                        }
                        value={saida.cliente ?? ""}
                        onChange={(cliente) => onUpdateSaida(saida.id, { cliente })}
                        sugestoes={clientes}
                        placeholder="Cliente"
                      />
                    )}
                  </td>
                  <td className="p-1">
                    <Autocomplete
                      compact
                      tipoItem="produto"
                      value={saida.mercadoria}
                      onChange={(mercadoria) => onUpdateSaida(saida.id, { mercadoria })}
                      sugestoes={mercadorias}
                      placeholder="Mercadoria"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min={0}
                      className={cellClass}
                      value={saida.boa || ""}
                      onChange={(e) =>
                        onUpdateSaida(saida.id, { boa: e.target.value === "" ? 0 : Number(e.target.value) })
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="p-1">
                    {saida.tipo === "perda" ? (
                      <span className="block px-2 text-xs text-neutral-300">—</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        className={cellClass}
                        value={saida.fraca || ""}
                        onChange={(e) =>
                          onUpdateSaida(saida.id, { fraca: e.target.value === "" ? 0 : Number(e.target.value) })
                        }
                        placeholder="0"
                      />
                    )}
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveSaida(saida.id)}
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

        <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-5 py-3">
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => onAddSaida("cliente")}>
            Adicionar destino
          </Button>
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => onAddSaida("perda")}>
            Adicionar perda
          </Button>
        </div>
      </section>
    </div>
  );
}
