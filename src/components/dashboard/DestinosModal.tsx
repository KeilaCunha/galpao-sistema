import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AutorizarModal } from "../auth/AutorizarModal";
import { CampoTravado } from "../auth/CampoTravado";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import { campoTravado } from "../../utils/permissoes";
import type { EntradaLancamento } from "../../types";
import { pausarSync, retomarSync } from "../../api/sync";
import { destinosDaFolhaNoDia, destinosDoEstoqueNoDia, tipoPadraoDestino } from "../../utils/alocacao";
import {
  destinoEhSobra,
  ehTomate,
  opcoesClassificacao,
  patchQtd,
  patchTipo,
  qtdDestino,
  tipoEhEstoque,
} from "../../utils/classificacao";
import { destinoPersistivel, resumoDestinos } from "../../utils/destino";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";

const modalInputClass =
  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

const LINHAS_DESTINO_PADRAO = 6;
const MAX_DESTINOS_DIA = 20;

interface DestinosModalProps {
  open: boolean;
  onClose: () => void;
  entrada: EntradaLancamento | undefined;
  dataDestino: string;
  descricao?: string;
  origemEstoque?: boolean;
}

export function DestinosModal({ open, onClose, entrada, dataDestino, descricao, origemEstoque }: DestinosModalProps) {
  const { entradas, addDestino, updateDestino, removeDestino, garantirDestinosDoDia, entradaGravada } = usePlanilha();
  const { clientes } = useData();
  const { usuario, travas, modoLivre, estaLiberado } = useAuth();
  const [pedirDestinos, setPedirDestinos] = useState(false);
  const garantirRef = useRef(garantirDestinosDoDia);
  garantirRef.current = garantirDestinosDoDia;

  const atual = entrada ? entradas.find((e) => e.id === entrada.id) ?? entrada : undefined;
  const destinos = atual
    ? origemEstoque
      ? destinosDoEstoqueNoDia(atual, dataDestino)
      : destinosDaFolhaNoDia(atual, dataDestino)
    : [];
  const preenchidos = destinos.filter(destinoPersistivel).length;
  const destinosTravados = Boolean(
    atual &&
      campoTravado({
        usuario,
        travas,
        gravada: entradaGravada(atual.id),
        campo: "destinos",
        liberado: estaLiberado(atual.id, "destinos"),
        modoLivre,
      }),
  );

  useEffect(() => {
    if (!open) return;
    pausarSync();
    return () => retomarSync();
  }, [open]);

  useEffect(() => {
    if (!open || !atual) return;
    const origem = origemEstoque ? "estoque" : "folha";
    const vazios = destinos.length - preenchidos;
    let alvo = Math.max(LINHAS_DESTINO_PADRAO, destinos.length);
    if (vazios === 0) alvo = Math.min(MAX_DESTINOS_DIA, destinos.length + 1);
    garantirRef.current(atual.id, dataDestino, origem, alvo);
  }, [open, atual?.id, dataDestino, origemEstoque, destinos.length, preenchidos]);

  const clientesSugestao = useMemo(
    () =>
      [...new Set(clientes.map((c) => c.nome.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [clientes],
  );

  return (
    <>
      <Modal
        open={open && !!atual}
        onClose={onClose}
        title="Destinos desta entrega"
        description={
          descricao ??
          (atual ? `${atual.produtor || "Produtor"} · ${atual.mercadoria || "Mercadoria"}` : undefined)
        }
        size="xl"
      >
        {atual && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-neutral-200">
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
                  {destinos.map((destino) => {
                    const linhaTravada = destinosTravados && destinoPersistivel(destino);
                    return (
                      <tr key={destino.id} className="border-t border-neutral-100">
                        <td className="p-1.5" colSpan={linhaTravada ? 4 : undefined}>
                          {linhaTravada ? (
                            <CampoTravado travado onLiberar={() => setPedirDestinos(true)}>
                              <p className="px-2 py-2 text-sm text-neutral-500">
                                Destino já gravado · {destino.cliente || "sem cliente"} · {qtdDestino(destino) ?? 0}
                              </p>
                            </CampoTravado>
                          ) : tipoEhEstoque(destino.tipo) ? (
                            <input
                              readOnly
                              value="Sobra"
                              className={`${modalInputClass} bg-warning-50 text-warning-700`}
                            />
                          ) : (
                            <Autocomplete
                              tipoItem="cliente"
                              value={destino.cliente}
                              onChange={(cliente) => {
                                if (destinoEhSobra({ cliente })) {
                                  updateDestino(atual.id, destino.id, {
                                    ...patchTipo("Estoque", destino),
                                    cliente: "Estoque",
                                    data: dataDestino,
                                  });
                                  return;
                                }
                                updateDestino(atual.id, destino.id, { cliente, data: dataDestino });
                              }}
                              sugestoes={clientesSugestao}
                              placeholder={destino.tipo === "Perda" ? "Perda da carga" : "Cliente"}
                            />
                          )}
                        </td>
                        {!linhaTravada && (
                          <>
                      <td className="p-1.5">
                        <Select
                          value={
                            destino.tipo?.trim() ||
                            (ehTomate(atual.mercadoria) ? "AAA" : "BOM")
                          }
                          onChange={(e) => {
                            const tipo = e.target.value;
                            const patch: Partial<typeof destino> = {
                              ...patchTipo(tipo, destino),
                              data: dataDestino,
                            };
                            if (tipoEhEstoque(tipo)) patch.cliente = "Estoque";
                            else if (tipoEhEstoque(destino.tipo) && destino.cliente.trim().toLowerCase() === "estoque") {
                              patch.cliente = "";
                            }
                            updateDestino(atual.id, destino.id, patch);
                          }}
                        >
                          <option value="">Classificar</option>
                          {opcoesClassificacao(atual.mercadoria, origemEstoque).map((opcao) => (
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
                          </>
                        )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Plus size={15} />}
                onClick={() => {
                  addDestino(atual.id, {
                    cliente: "",
                    data: dataDestino,
                    origem: origemEstoque ? "estoque" : "folha",
                    tipo: tipoPadraoDestino(
                      atual.mercadoria,
                      origemEstoque ? "estoque" : "folha",
                      atual,
                    ),
                    boa: null,
                    fraca: null,
                    perda: null,
                  });
                }}
              >
                Adicionar destino
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Plus size={15} />}
                onClick={() => {
                  addDestino(atual.id, {
                    cliente: "",
                    data: dataDestino,
                    origem: origemEstoque ? "estoque" : "folha",
                    tipo: "Perda",
                    boa: null,
                    fraca: null,
                    perda: null,
                  });
                }}
              >
                Adicionar perda
              </Button>
              {!origemEstoque && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Plus size={15} />}
                  onClick={() => {
                    addDestino(atual.id, {
                      cliente: "Estoque",
                      data: dataDestino,
                      origem: "folha",
                      tipo: "Estoque",
                      boa: null,
                      fraca: null,
                      perda: null,
                    });
                  }}
                >
                  Sobra
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Total desta entrega</p>
              {(() => {
                const estoque = destinos
                  .filter((d) => tipoEhEstoque(d.tipo))
                  .reduce((soma, d) => soma + (qtdDestino(d) ?? 0), 0);
                const r = resumoDestinos(destinos.filter((d) => !tipoEhEstoque(d.tipo)));
                const total = r.total + estoque;
                return (
                  <p className="text-sm font-semibold text-neutral-700">
                    {total}{" "}
                    <span className="font-normal text-neutral-400">
                      ({r.boa} bom · {r.fraca} fraco
                      {estoque > 0 ? ` · ${estoque} sobra` : ""}
                      {r.perda > 0 ? ` · ${r.perda} perda` : ""})
                    </span>
                  </p>
                );
              })()}
            </div>

            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button onClick={onClose}>Concluído</Button>
            </div>
          </div>
        )}
      </Modal>
      {atual && (
        <AutorizarModal
          open={pedirDestinos}
          entradaId={atual.id}
          campos={["destinos"]}
          onClose={() => setPedirDestinos(false)}
          onLiberou={() => setPedirDestinos(false)}
        />
      )}
    </>
  );
}
