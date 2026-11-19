import { Check, ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AutorizarModal } from "../auth/AutorizarModal";
import { CampoTravado } from "../auth/CampoTravado";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import { useToast } from "../../context/ToastContext";
import type { DestinoEntrada, LinhaPlanilha } from "../../types";
import type { CampoTrava } from "../../utils/permissoes";
import { campoTravado, ehResponsavel } from "../../utils/permissoes";
import { abrevCliente } from "../../utils/abrev";
import { destinoEhSobra, ehTomate, qtdDestino, resumoFeitaTomate } from "../../utils/classificacao";
import {
  calcularRendimento,
  calcularSobra,
  destinoTemQuantidade,
  extraDeFeita,
  resumoQtdFeita,
  statusQtdFeita,
} from "../../utils/destino";
import { ehTipoCaixaPadrao, nomesTipoCaixa, tipoCaixaDaEntrada } from "../../utils/caixas";
import { formatPreco, parsePreco } from "../../utils/format";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DestinoChips } from "./DestinoChips";
import { DestinosModal } from "./DestinosModal";

const cellClass =
  "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

const LOTE_LINHAS = 8;
const MAX_LINHAS_DIA = 80;

interface PlanilhaDiariaProps {
  data: string;
  linhas: LinhaPlanilha[];
}

export function PlanilhaDiaria({ data, linhas }: PlanilhaDiariaProps) {
  const { entradas, addEntrada, updateEntrada, removeEntrada, garantirLinhasDoDia, entradaGravada, tiposCaixa } = usePlanilha();
  const { produtos, fornecedores } = useData();
  const { usuario, travas, modoLivre, estaLiberado, pode, verColuna } = useAuth();
  const vis = {
    produtor: verColuna("produtor"),
    qtd: verColuna("qtd"),
    qtdFeita: verColuna("qtdFeita"),
    mercadoria: verColuna("mercadoria"),
    preco: verColuna("preco"),
    destino: verColuna("destino"),
  };
  const colSpanFolha = 1 + Object.values(vis).filter(Boolean).length;
  const { showInfo } = useToast();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoFeitaId, setEditandoFeitaId] = useState<string | null>(null);
  const [editandoTipoId, setEditandoTipoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ id: string; campos: CampoTrava[] } | null>(null);
  const [filtroProdutor, setFiltroProdutor] = useState("");
  const [filtroMercadoria, setFiltroMercadoria] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const podeEditarFeita = ehResponsavel(usuario) || modoLivre;
  const sentinelaRef = useRef<HTMLDivElement>(null);

  const filtrando = Boolean(filtroProdutor.trim() || filtroMercadoria.trim() || filtroCliente.trim());

  useEffect(() => {
    setFiltroProdutor("");
    setFiltroMercadoria("");
    setFiltroCliente("");
    setEditandoFeitaId(null);
    setEditandoTipoId(null);
  }, [data]);

  const linhasVisiveis = useMemo(() => {
    if (!filtrando) return linhas;
    return linhas.filter((linha) => {
      const temDado = linha.produtor.trim() || linha.mercadoria.trim() || (linha.qtd ?? 0) > 0;
      if (!temDado) return false;
      if (!correspondeBusca(linha.produtor, filtroProdutor)) return false;
      if (!correspondeBusca(linha.mercadoria, filtroMercadoria)) return false;
      if (filtroCliente.trim()) {
        return destinosDaFolha(linha, data).some((destino) => correspondeCliente(destino, filtroCliente));
      }
      return true;
    });
  }, [linhas, filtroProdutor, filtroMercadoria, filtroCliente, filtrando, data]);

  useEffect(() => {
    const sentinela = sentinelaRef.current;
    if (!sentinela || filtrando) return;
    const observador = new IntersectionObserver(
      (entradasObs) => {
        if (!entradasObs[0]?.isIntersecting) return;
        if (linhas.length >= MAX_LINHAS_DIA) return;
        garantirLinhasDoDia(data, Math.min(linhas.length + LOTE_LINHAS, MAX_LINHAS_DIA));
      },
      { root: null, rootMargin: "240px" },
    );
    observador.observe(sentinela);
    return () => observador.disconnect();
  }, [data, linhas.length, garantirLinhasDoDia, filtrando]);

  const produtores = useMemo(
    () =>
      [...new Set(fornecedores.map((f) => f.nome.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [fornecedores],
  );

  function travado(id: string, campo: CampoTrava) {
    return campoTravado({
      usuario,
      travas,
      gravada: entradaGravada(id),
      campo,
      liberado: estaLiberado(id, campo),
      modoLivre,
    });
  }

  const mercadorias = useMemo(
    () =>
      [
        ...new Set(
          produtos
            .filter((item) => item.situacao === "ativo")
            .map((item) => item.nome.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [produtos],
  );

  const entradaModal = editandoId ? entradas.find((e) => e.id === editandoId) : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600">Operações</h3>
        <p className="text-xs text-neutral-400">Digite na linha. O destino aparece em chips sozinho.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              {vis.produtor && <th className="min-w-[10rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Produtor</th>}
              {vis.qtd && <th className="w-[5.25rem] min-w-[5.25rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Qtd</th>}
              {vis.qtdFeita && <th className="min-w-[10.5rem] whitespace-nowrap border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Qtd feita</th>}
              {vis.mercadoria && <th className="min-w-[9rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Merc.</th>}
              {vis.preco && <th className="w-[12.5rem] min-w-[12.5rem] whitespace-nowrap border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Preço</th>}
              {vis.destino && <th className="min-w-[16rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Destino</th>}
              <th className="w-10 min-w-10 border-b border-neutral-200" />
            </tr>
            <tr className="bg-white">
              {vis.produtor && (
                <th className="border-b border-neutral-200 p-1 font-normal">
                  <CampoFiltro
                    value={filtroProdutor}
                    onChange={setFiltroProdutor}
                    placeholder="Pesquisar nome"
                  />
                </th>
              )}
              {vis.qtd && <th className="border-b border-neutral-200" />}
              {vis.qtdFeita && <th className="border-b border-neutral-200" />}
              {vis.mercadoria && (
                <th className="border-b border-neutral-200 p-1 font-normal">
                  <CampoFiltro
                    value={filtroMercadoria}
                    onChange={setFiltroMercadoria}
                    placeholder="Pesquisar mercadoria"
                  />
                </th>
              )}
              {vis.preco && <th className="border-b border-neutral-200" />}
              {vis.destino && (
                <th className="border-b border-neutral-200 p-1 font-normal">
                  <CampoFiltro
                    value={filtroCliente}
                    onChange={setFiltroCliente}
                    placeholder="Pesquisar cliente"
                  />
                </th>
              )}
              <th className="border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((linha) => {
              const resumo = resumoQtdFeita(linha);
              const destinosFolha = destinosDaFolha(linha, data);
              const destinosDia = destinosFolha.filter((destino) =>
                filtroCliente.trim() ? correspondeCliente(destino, filtroCliente) : true,
              );
              const status = statusQtdFeita(linha.qtd, resumo);
              const sobra = calcularSobra(linha.qtd, resumo);
              const reserva = destinosFolha
                .filter((destino) => destinoEhSobra(destino))
                .reduce((soma, destino) => soma + (qtdDestino(destino) ?? 0), 0);
              const rendeu = calcularRendimento(linha.qtd, resumo, reserva);
              return (
                <tr key={linha.id} className="border-b border-neutral-50 last:border-0">
                  {vis.produtor && (
                  <td className="p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "produtor")} onLiberar={() => setPedido({ id: linha.id, campos: ["produtor"] })}>
                      <Autocomplete
                        compact
                        tipoItem="fornecedor"
                        value={linha.produtor}
                        onChange={(produtor) => updateEntrada(linha.id, { produtor })}
                        sugestoes={produtores}
                        placeholder="Produtor"
                        disabled={travado(linha.id, "produtor")}
                      />
                    </CampoTravado>
                  </td>
                  )}
                  {vis.qtd && (
                  <td className="p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "qtd")} onLiberar={() => setPedido({ id: linha.id, campos: ["qtd"] })}>
                      <div className="leading-tight">
                        <input
                          type="number"
                          min={0}
                          className={cellClass}
                          value={linha.qtd || ""}
                          onChange={(e) =>
                            updateEntrada(linha.id, { qtd: e.target.value === "" ? 0 : Number(e.target.value) })
                          }
                          placeholder="0"
                          disabled={travado(linha.id, "qtd")}
                        />
                        <CampoTipoCaixa
                          tipo={tipoCaixaDaEntrada(linha)}
                          tipos={nomesTipoCaixa(tiposCaixa)}
                          editando={editandoTipoId === linha.id}
                          disabled={travado(linha.id, "qtd")}
                          onEditar={() => setEditandoTipoId(linha.id)}
                          onPronto={() => setEditandoTipoId(null)}
                          onChange={(tipoCaixa) => {
                            updateEntrada(linha.id, { tipoCaixa });
                            setEditandoTipoId(null);
                          }}
                        />
                      </div>
                    </CampoTravado>
                  </td>
                  )}
                  {vis.qtdFeita && (
                  <td className="p-1 align-top">
                    {podeEditarFeita && editandoFeitaId === linha.id ? (
                      <div className="leading-tight">
                        <div className="flex items-center gap-0.5">
                          <CampoQtdFeita
                            boa={linha.feitaBoa ?? (resumo.boa || null)}
                            fraca={linha.feitaFraca ?? (resumo.fraca || null)}
                            onChange={(boa, fraca) => {
                              const extra = extraDeFeita(linha.qtd, linha.destinos, boa, fraca);
                              updateEntrada(linha.id, {
                                feitaBoa: boa,
                                feitaFraca: fraca,
                                rendimentoExtra: extra || undefined,
                              });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setEditandoFeitaId(null)}
                            className="rounded-md p-1 text-success-600 hover:bg-success-50"
                            title="Pronto"
                          >
                            <Check size={14} />
                          </button>
                        </div>
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
                    ) : status === "vazio" ? (
                      <div className="flex h-9 items-center gap-1">
                        <span className="text-neutral-300">—</span>
                        {podeEditarFeita && (
                          <button
                            type="button"
                            onClick={() => setEditandoFeitaId(linha.id)}
                            className="rounded-md p-1 text-neutral-400 hover:bg-brand-50 hover:text-brand-600"
                            title="Editar quantidade feita"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="leading-tight">
                        <p className="font-semibold text-neutral-800">
                          {ehTomate(linha.mercadoria) ? (
                            <QtdFeitaTomate
                              destinos={linha.destinos}
                              qtd={linha.qtd}
                              extra={Math.max(0, (linha.rendimentoExtra ?? 0) - reserva)}
                            />
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
                          {podeEditarFeita && (
                            <button
                              type="button"
                              onClick={() => setEditandoFeitaId(linha.id)}
                              className="ml-1 inline-flex align-text-top text-neutral-400 hover:text-brand-600"
                              title="Editar quantidade feita"
                            >
                              <Pencil size={12} />
                            </button>
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
                  )}
                  {vis.mercadoria && (
                  <td className="p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "mercadoria")} onLiberar={() => setPedido({ id: linha.id, campos: ["mercadoria"] })}>
                      <Autocomplete
                        compact
                        tipoItem="produto"
                        value={linha.mercadoria}
                        onChange={(mercadoria) => updateEntrada(linha.id, { mercadoria })}
                        sugestoes={mercadorias}
                        placeholder="Mercadoria"
                        disabled={travado(linha.id, "mercadoria")}
                      />
                    </CampoTravado>
                  </td>
                  )}
                  {vis.preco && (
                  <td className="whitespace-nowrap p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "preco")} onLiberar={() => setPedido({ id: linha.id, campos: ["preco"] })}>
                      <div className="flex flex-nowrap items-center gap-1">
                        <CampoPreco
                          value={linha.preco}
                          onChange={(preco) => updateEntrada(linha.id, { preco })}
                        />
                        <CampoPreco
                          value={linha.precoFraco}
                          onChange={(precoFraco) => updateEntrada(linha.id, { precoFraco })}
                          fraco
                        />
                      </div>
                    </CampoTravado>
                  </td>
                  )}
                  {vis.destino && (
                  <td className="px-1.5 py-1.5 align-top">
                    <div className="flex min-h-[36px] items-start gap-1">
                      <div
                        className="flex min-h-[36px] min-w-[5.5rem] flex-1 cursor-pointer flex-wrap items-center gap-1 rounded-lg p-1 transition hover:bg-neutral-50"
                        onClick={() => {
                          if (!pode("destinos")) return;
                          setEditandoId(linha.id);
                        }}
                        title={pode("destinos") ? "Clique para informar destinos" : "Sem acesso aos destinos"}
                      >
                        <DestinoChips destinos={destinosDia} />
                        {destinosDia.length === 0 && (
                          <span className="text-xs text-neutral-400">+ destino</span>
                        )}
                      </div>
                      <CampoObservacao
                        value={linha.observacao ?? ""}
                        onChange={(observacao) => updateEntrada(linha.id, { observacao })}
                      />
                    </div>
                  </td>
                  )}
                  <td className="p-1 text-center align-top">
                    <div className="flex items-start justify-end gap-1">
                      {!vis.destino && (
                        <CampoObservacao
                          value={linha.observacao ?? ""}
                          onChange={(observacao) => updateEntrada(linha.id, { observacao })}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const gravada = entradaGravada(linha.id);
                          if (gravada && !ehResponsavel(usuario) && !modoLivre) {
                            showInfo("Lançamento gravado: só o responsável apaga a linha.");
                            return;
                          }
                          setExcluirId(linha.id);
                        }}
                        className="rounded-lg p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrando && linhasVisiveis.length === 0 && (
              <tr>
                <td colSpan={colSpanFolha} className="px-4 py-8 text-center text-sm text-neutral-400">
                  Nenhum lançamento com esse filtro.
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={colSpanFolha} className="p-0">
                <div ref={sentinelaRef} className="h-px" aria-hidden />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-400">
          {filtrando
            ? `${linhasVisiveis.length} ${linhasVisiveis.length === 1 ? "linha encontrada" : "linhas encontradas"}`
            : `${linhas.filter((l) => l.produtor || l.mercadoria || (l.qtd ?? 0) > 0).length} linhas com dados · role para baixo para mais linhas`}
        </p>
        <Button
          variant="outline"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => addEntrada({ data, produtor: "", mercadoria: "", qtd: 0, preco: null, precoFraco: null, destinos: [] })}
        >
          Adicionar linha
        </Button>
      </div>

      <DestinosModal
        key={editandoId ?? "fechado"}
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

      <AutorizarModal
        open={!!pedido}
        entradaId={pedido?.id ?? ""}
        campos={pedido?.campos ?? ["qtd"]}
        onClose={() => setPedido(null)}
        onLiberou={() => setPedido(null)}
      />
    </div>
  );
}

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function destinosDaFolha(linha: LinhaPlanilha, data: string): DestinoEntrada[] {
  return linha.destinos.filter(
    (destino) =>
      (destino.data || data) === data &&
      destino.origem !== "estoque" &&
      destinoTemQuantidade(destino),
  );
}

function correspondeBusca(texto: string, termo: string): boolean {
  const busca = semAcento(termo);
  if (!busca) return true;
  return semAcento(texto).includes(busca);
}

function correspondeCliente(destino: DestinoEntrada, termo: string): boolean {
  return correspondeBusca(destino.cliente, termo) || correspondeBusca(abrevCliente(destino.cliente), termo);
}

function CampoFiltro({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-7 pr-2 text-xs font-medium text-neutral-700 placeholder:font-normal placeholder:normal-case placeholder:text-neutral-400 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}

function CampoObservacao({ value, onChange }: { value: string; onChange: (valor: string) => void }) {
  const preenchida = Boolean(value.trim());
  return (
    <input
      className={`h-9 w-[4.5rem] shrink-0 rounded-md border px-1.5 text-xs font-medium outline-none placeholder:font-normal ${
        preenchida
          ? "border-amber-400 bg-amber-100 text-neutral-900"
          : "border-amber-300 bg-amber-50 text-neutral-800 placeholder:text-amber-800/55"
      } focus:border-amber-500 focus:bg-amber-100 focus:ring-2 focus:ring-amber-200`}
      placeholder="Obs"
      title="Observação desta carga"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function CampoPreco({
  value,
  onChange,
  fraco,
}: {
  value: number | null | undefined;
  onChange: (valor: number | null) => void;
  fraco?: boolean;
}) {
  const [texto, setTexto] = useState(() => formatPreco(value));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(formatPreco(value));
  }, [value, focado]);

  return (
    <label
      className={`inline-flex h-9 shrink-0 flex-nowrap items-center gap-0.5 rounded-md px-1 focus-within:bg-brand-50/70 focus-within:ring-2 focus-within:ring-brand-300 ${
        fraco ? "text-warning-700" : "text-neutral-700"
      }`}
    >
      <span className={`shrink-0 text-[11px] font-semibold ${fraco ? "text-warning-600" : "text-neutral-500"}`}>R$</span>
      <input
        inputMode="decimal"
        className="h-full w-[3.25rem] shrink-0 bg-transparent px-0.5 text-sm tabular-nums outline-none placeholder:text-neutral-300"
        value={texto}
        onChange={(e) => {
          const valor = e.target.value;
          setTexto(valor);
          if (valor.trim() === "") {
            onChange(null);
            return;
          }
          const parsed = parsePreco(valor);
          if (parsed != null) onChange(parsed);
        }}
        onFocus={() => setFocado(true)}
        onBlur={() => {
          setFocado(false);
          setTexto(formatPreco(value));
        }}
        placeholder="0,00"
      />
      {fraco ? <span className="shrink-0 text-[10px] font-extrabold uppercase leading-none text-warning-600">fr</span> : null}
    </label>
  );
}

function CampoTipoCaixa({
  tipo,
  tipos,
  editando,
  disabled,
  onEditar,
  onPronto,
  onChange,
}: {
  tipo: string;
  tipos: string[];
  editando: boolean;
  disabled: boolean;
  onEditar: () => void;
  onPronto: () => void;
  onChange: (tipo: string) => void;
}) {
  if (editando && !disabled) {
    return (
      <select
        autoFocus
        className="mt-0.5 h-[18px] w-full cursor-pointer rounded border border-brand-400 bg-brand-50 px-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-700 outline-none"
        value={tipo}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPronto}
      >
        {tipos.map((nome) => (
          <option key={nome} value={nome}>
            {nome.toUpperCase()}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onEditar}
      title="Apertar para escolher o tipo de caixa"
      className={`mt-0.5 inline-flex h-[18px] w-full items-center justify-between gap-px rounded border px-1 text-[9px] font-bold uppercase leading-none tracking-wide ${
        ehTipoCaixaPadrao(tipo)
          ? "border-neutral-300 bg-neutral-50 text-neutral-600"
          : "border-brand-300 bg-brand-50 text-brand-700"
      } hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className="truncate">{tipo}</span>
      <ChevronDown size={9} className="shrink-0 opacity-70" />
    </button>
  );
}

function CampoQtdFeita({
  boa,
  fraca,
  onChange,
}: {
  boa: number | null;
  fraca: number | null;
  onChange: (boa: number | null, fraca: number | null) => void;
}) {
  const campo =
    "h-9 w-[3.25rem] shrink-0 [appearance:textfield] rounded-md bg-transparent px-1.5 text-sm tabular-nums text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  return (
    <div className="flex flex-nowrap items-center gap-0.5 whitespace-nowrap">
      <input
        type="number"
        min={0}
        className={campo}
        value={boa ?? ""}
        placeholder="0"
        title="Feito bom"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), fraca)}
      />
      <span className="text-neutral-300">+</span>
      <label className="flex items-center gap-0.5">
        <input
          type="number"
          min={0}
          className={campo}
          value={fraca ?? ""}
          placeholder="0"
          title="Feito fraco"
          onChange={(e) => onChange(boa, e.target.value === "" ? null : Number(e.target.value))}
        />
        <span className="shrink-0 text-[10px] font-extrabold uppercase text-warning-600">fr</span>
      </label>
    </div>
  );
}

function QtdFeitaTomate({
  destinos,
  qtd,
  extra,
}: {
  destinos: DestinoEntrada[];
  qtd: number | null;
  extra?: number;
}) {
  const base = resumoFeitaTomate(destinos, qtd);
  const feita = { ...base, bom: base.bom + (extra ?? 0) };
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
