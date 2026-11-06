import { Plus, Search, Trash2 } from "lucide-react";
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
import { ehTomate, resumoFeitaTomate } from "../../utils/classificacao";
import { calcularRendimento, calcularSobra, destinoPersistivel, resumoAlocado, statusQtdFeita } from "../../utils/destino";
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
  const { entradas, addEntrada, updateEntrada, removeEntrada, garantirLinhasDoDia, entradaGravada } = usePlanilha();
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
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ id: string; campos: CampoTrava[] } | null>(null);
  const [filtroProdutor, setFiltroProdutor] = useState("");
  const [filtroMercadoria, setFiltroMercadoria] = useState("");
  const sentinelaRef = useRef<HTMLDivElement>(null);

  const filtrando = Boolean(filtroProdutor.trim() || filtroMercadoria.trim());

  useEffect(() => {
    setFiltroProdutor("");
    setFiltroMercadoria("");
  }, [data]);

  const linhasVisiveis = useMemo(() => {
    if (!filtrando) return linhas;
    return linhas.filter((linha) => {
      const temDado = linha.produtor.trim() || linha.mercadoria.trim() || (linha.qtd ?? 0) > 0;
      if (!temDado) return false;
      return (
        correspondeBusca(linha.produtor, filtroProdutor) &&
        correspondeBusca(linha.mercadoria, filtroMercadoria)
      );
    });
  }, [linhas, filtroProdutor, filtroMercadoria, filtrando]);

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

  const produtores = useMemo(() => {
    const nomes = new Set(fornecedores.map((f) => f.nome.trim()).filter(Boolean));
    for (const e of entradas) if (e.produtor.trim()) nomes.add(e.produtor.trim());
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [fornecedores, entradas]);

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

  const mercadorias = useMemo(() => {
    const nomes = new Set<string>();
    for (const p of produtos.filter((item) => item.situacao === "ativo")) {
      if (p.nome.trim()) nomes.add(p.nome.trim());
    }
    for (const e of entradas) if (e.mercadoria.trim()) nomes.add(e.mercadoria.trim());
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [produtos, entradas]);

  const entradaModal = editandoId ? entradas.find((e) => e.id === editandoId) : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600">Operações</h3>
        <p className="text-xs text-neutral-400">Digite na linha. O destino aparece em chips sozinho.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              {vis.produtor && <th className="w-[22%] min-w-[9rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Produtor</th>}
              {vis.qtd && <th className="w-16 border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Qtd</th>}
              {vis.qtdFeita && <th className="w-[13%] min-w-[8rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Qtd feita</th>}
              {vis.mercadoria && <th className="w-[18%] min-w-[8rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Merc.</th>}
              {vis.preco && <th className="w-[9.75rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Preço</th>}
              {vis.destino && <th className="w-[32%] min-w-[12rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Destino</th>}
              <th className="w-10 border-b border-neutral-200" />
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
              {vis.destino && <th className="border-b border-neutral-200" />}
              <th className="border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {linhasVisiveis.map((linha) => {
              const resumo = resumoAlocado(linha.destinos, linha.qtd);
              const destinosDia = linha.destinos.filter(
                (destino) =>
                  (destino.data || data) === data &&
                  destino.origem !== "estoque" &&
                  destinoPersistivel(destino),
              );
              const status = statusQtdFeita(linha.qtd, resumo);
              const sobra = calcularSobra(linha.qtd, resumo);
              const rendeu = calcularRendimento(linha.qtd, resumo);
              return (
                <tr key={linha.id} className="border-b border-neutral-50 last:border-0">
                  {vis.produtor && (
                  <td className="p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "produtor")} onLiberar={() => setPedido({ id: linha.id, campos: ["produtor"] })}>
                      <Autocomplete
                        compact
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
                    </CampoTravado>
                  </td>
                  )}
                  {vis.qtdFeita && (
                  <td className="px-2 py-2 align-top">
                    {status === "vazio" ? (
                      <span className="text-neutral-300">—</span>
                    ) : (
                      <div className="leading-tight">
                        <p className="font-semibold text-neutral-800">
                          {ehTomate(linha.mercadoria) ? (
                            <QtdFeitaTomate destinos={linha.destinos} qtd={linha.qtd} />
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
                  )}
                  {vis.mercadoria && (
                  <td className="p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "mercadoria")} onLiberar={() => setPedido({ id: linha.id, campos: ["mercadoria"] })}>
                      <Autocomplete
                        compact
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
                  <td className="p-1 align-top">
                    <CampoTravado travado={travado(linha.id, "preco")} onLiberar={() => setPedido({ id: linha.id, campos: ["preco"] })}>
                      <div className="flex w-max items-center gap-0.5">
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
                    <div
                      className="flex min-h-[36px] cursor-pointer flex-wrap items-center gap-1 rounded-lg p-1 transition hover:bg-neutral-50"
                      onClick={() => {
                        if (pode("destinos")) setEditandoId(linha.id);
                      }}
                      title={pode("destinos") ? "Clique para informar destinos" : "Sem acesso aos destinos"}
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
                  )}
                  <td className="p-1 text-center align-top">
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

function correspondeBusca(texto: string, termo: string): boolean {
  const busca = semAcento(termo);
  if (!busca) return true;
  return semAcento(texto).includes(busca);
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
      className={`flex h-9 items-center rounded-md px-0.5 focus-within:bg-brand-50/70 focus-within:ring-2 focus-within:ring-brand-300 ${
        fraco ? "w-[4.85rem] text-warning-700" : "w-[4.15rem] text-neutral-700"
      }`}
    >
      <span className={`shrink-0 text-[11px] font-semibold ${fraco ? "text-warning-600" : "text-neutral-500"}`}>R$</span>
      <input
        inputMode="decimal"
        className="h-full w-10 min-w-0 bg-transparent px-0.5 text-sm tabular-nums outline-none placeholder:text-neutral-300"
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
      {fraco ? <span className="shrink-0 text-[10px] font-extrabold uppercase text-warning-600">fr</span> : null}
    </label>
  );
}

function QtdFeitaTomate({ destinos, qtd }: { destinos: DestinoEntrada[]; qtd: number | null }) {
  const feita = resumoFeitaTomate(destinos, qtd);
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
