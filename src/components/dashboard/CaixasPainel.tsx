import { ChevronDown, FileDown, Package, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import {
  TIPO_CAIXA_PADRAO,
  mesmoTipoCaixa,
  montarRelatorioCaixas,
  movimentoDoDia,
  nomesTipoCaixa,
  saldoCaixas,
  veioNaFolha,
} from "../../utils/caixas";
import { formatDate } from "../../utils/format";
import { imprimirRelatorioCaixas } from "../../utils/relatorioPdf";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { DatePicker } from "../ui/DatePicker";
import { SearchInput } from "../ui/SearchInput";

function CampoQtd({
  valor,
  onDefinir,
}: {
  valor: number;
  onDefinir: (qtd: number) => void;
}) {
  const [focado, setFocado] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const preenchido = valor > 0 || (focado && rascunho.trim().length > 0);

  function aplicar(texto: string) {
    const limpo = texto.trim().replace(",", ".");
    if (!limpo) {
      onDefinir(0);
      return;
    }
    const quantidade = Number(limpo);
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      onDefinir(0);
      return;
    }
    onDefinir(quantidade);
  }

  return (
    <input
      className={`h-8 w-[3.75rem] shrink-0 rounded-md border px-1 text-center text-sm font-semibold tabular-nums outline-none placeholder:font-normal ${
        preenchido
          ? "border-brand-300 bg-brand-50 text-neutral-900"
          : "border-neutral-200 bg-white text-neutral-800 placeholder:text-neutral-400"
      } focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200`}
      placeholder="0"
      inputMode="numeric"
      value={focado ? rascunho : valor > 0 ? String(valor) : ""}
      onFocus={() => {
        setFocado(true);
        setRascunho(valor > 0 ? String(valor) : "");
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        setFocado(false);
        aplicar(rascunho);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}

function Card({
  label,
  value,
  cor,
}: {
  label: string;
  value: number;
  cor?: "success" | "warning" | "danger";
}) {
  const cores = {
    success: "text-success-600",
    warning: "text-warning-600",
    danger: "text-danger-500",
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <p className={`text-2xl font-bold tabular-nums ${cor ? cores[cor] : "text-neutral-800"}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
    </div>
  );
}

function detalheTipos(partes: { tipo: string; qtd: number }[]): string {
  return partes
    .filter((item) => item.qtd > 0)
    .map((item) => `${item.qtd} ${item.tipo.toUpperCase()}`)
    .join(" · ");
}

export function CaixasPainel({ dia }: { dia: string }) {
  const { caixas, entradas, tiposCaixa, definirCaixa, addTipoCaixa, removeTipoCaixa } = usePlanilha();
  const { fornecedores } = useData();
  const [busca, setBusca] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [erroTipo, setErroTipo] = useState("");
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [de, setDe] = useState(dia);
  const [ate, setAte] = useState(dia);
  const [tipoRelatorio, setTipoRelatorio] = useState("");
  const [tiposAbertos, setTiposAbertos] = useState<string[]>([]);
  const [adicionados, setAdicionados] = useState<string[]>([]);
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState("");
  const [erroAdd, setErroAdd] = useState("");

  function chaveNome(nome: string) {
    return nome.trim().toLowerCase();
  }

  function chaveTipo(nome: string, tipo: string) {
    return `${chaveNome(nome)}::${tipo.trim().toLowerCase()}`;
  }

  const nomesFornecedores = useMemo(
    () => fornecedores.map((item) => item.nome).filter((nome) => nome.trim()),
    [fornecedores],
  );

  const cadastrados = useMemo(() => {
    const vistos = new Set<string>();
    const nomes: string[] = [];
    function incluir(nomeBruto: string) {
      const nome = nomeBruto.trim();
      if (!nome) return;
      const chave = nome.toLowerCase();
      if (vistos.has(chave)) return;
      vistos.add(chave);
      nomes.push(nome);
    }
    for (const item of fornecedores) incluir(item.nome);
    for (const item of caixas) incluir(item.fornecedor);
    for (const entrada of entradas) incluir(entrada.produtor);
    return nomes;
  }, [fornecedores, caixas, entradas]);

  const nomesTipo = useMemo(() => nomesTipoCaixa(tiposCaixa), [tiposCaixa]);

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return cadastrados
      .map((nome) => {
        const todos = nomesTipo.map((tipo) => ({
          tipo,
          veio: veioNaFolha(entradas, dia, nome, tipo),
          pegou: movimentoDoDia(caixas, dia, nome, tipo)?.pegou ?? 0,
          estoque: saldoCaixas(caixas, entradas, nome, dia, tipo),
        }));
        const tipos = todos.filter(
          (item) => item.veio > 0 || item.pegou > 0 || tiposAbertos.includes(chaveTipo(nome, item.tipo)),
        );
        const veio = todos.reduce((soma, item) => soma + item.veio, 0);
        const pegou = todos.reduce((soma, item) => soma + item.pegou, 0);
        const estoque = saldoCaixas(caixas, entradas, nome, dia);
        const tiposDisponiveis = nomesTipo.filter(
          (tipo) => !tipos.some((item) => item.tipo.toLowerCase() === tipo.toLowerCase()),
        );
        return { nome, tipos, veio, pegou, estoque, tiposDisponiveis };
      })
      .filter((linha) => {
        const lancadoHoje =
          linha.veio > 0 || linha.pegou > 0 || adicionados.includes(chaveNome(linha.nome));
        if (termo) return lancadoHoje && linha.nome.toLowerCase().includes(termo);
        return lancadoHoje;
      })
      .sort((a, b) => {
        const peso = (item: typeof a) => (item.veio > 0 ? 0 : item.pegou > 0 ? 1 : 2);
        const diff = peso(a) - peso(b);
        if (diff !== 0) return diff;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [cadastrados, caixas, dia, entradas, busca, nomesTipo, tiposAbertos, adicionados]);

  const inicio = de <= ate ? de : ate;
  const fim = de <= ate ? ate : de;
  const relatorio = useMemo(
    () => montarRelatorioCaixas(caixas, entradas, inicio, fim, tipoRelatorio, cadastrados),
    [caixas, entradas, inicio, fim, tipoRelatorio, cadastrados],
  );

  function gravar(nome: string, tipo: string, pegou: number) {
    definirCaixa(dia, nome, tipo, pegou);
  }

  function incluirQuemBuscou(nomeBruto: string) {
    const nome = nomeBruto.trim();
    if (!nome) {
      setErroAdd("Selecione o fornecedor cadastrado.");
      return;
    }
    const cadastrado = nomesFornecedores.find((item) => chaveNome(item) === chaveNome(nome));
    if (!cadastrado) {
      setErroAdd(`Fornecedor "${nome}" não está cadastrado`);
      return;
    }
    setAdicionados((atual) => (atual.includes(chaveNome(cadastrado)) ? atual : [...atual, chaveNome(cadastrado)]));
    setTiposAbertos((atual) => {
      const chave = chaveTipo(cadastrado, TIPO_CAIXA_PADRAO);
      return atual.includes(chave) ? atual : [...atual, chave];
    });
    setNovoFornecedor("");
    setErroAdd("");
    setMostrarAdicionar(false);
  }

  function cadastrarTipo() {
    const nome = novoTipo.trim();
    if (!nome) {
      setErroTipo("Digite o nome do tipo de caixa.");
      return;
    }
    if (tiposCaixa.some((tipo) => mesmoTipoCaixa(tipo.nome, nome))) {
      setErroTipo("Esse tipo já está cadastrado.");
      return;
    }
    if (!addTipoCaixa(nome)) {
      setErroTipo("Esse tipo já está cadastrado.");
      return;
    }
    setNovoTipo("");
    setErroTipo("");
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tipos de caixa</p>
        <p className="mt-0.5 text-xs text-neutral-400">Cadastre o tipo antes de anotar a quantidade. Plástica já vale; Pregado só se usar.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {nomesTipo.map((nome) => {
            const cadastrado = tiposCaixa.find((tipo) => mesmoTipoCaixa(tipo.nome, nome));
            return (
              <span
                key={nome}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-600"
              >
                {nome}
                {cadastrado ? (
                  <button
                    type="button"
                    className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-danger-500"
                    title={`Remover ${nome}`}
                    onClick={() => removeTipoCaixa(cadastrado.id)}
                  >
                    <X size={11} />
                  </button>
                ) : null}
              </span>
            );
          })}
          <input
            className="h-8 w-36 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            placeholder="Novo tipo"
            value={novoTipo}
            onChange={(e) => {
              setNovoTipo(e.target.value);
              if (erroTipo) setErroTipo("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                cadastrarTipo();
              }
            }}
          />
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            onClick={cadastrarTipo}
          >
            <Plus size={12} />
            Cadastrar
          </button>
        </div>
        {erroTipo ? <p className="mt-2 text-xs font-medium text-danger-500">{erroTipo}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-800">Controle do dia</p>
            <p className="text-xs text-neutral-400">Anote só o que o fornecedor levou. O que veio já entra pela folha.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full max-w-xs sm:w-56">
              <SearchInput value={busca} onChange={setBusca} placeholder="Pesquisar fornecedor" />
            </div>
            <Button
              type="button"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setMostrarAdicionar((aberto) => !aberto);
                setErroAdd("");
              }}
            >
              Adicionar
            </Button>
          </div>
        </div>

        {mostrarAdicionar ? (
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="mb-2 text-xs text-neutral-500">Quem não trouxe carga, mas veio só buscar caixa.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1">
                <Autocomplete
                  autoFocus
                  tipoItem="fornecedor"
                  value={novoFornecedor}
                  onChange={(nome) => {
                    setNovoFornecedor(nome);
                    if (erroAdd) setErroAdd("");
                    if (nome.trim()) incluirQuemBuscou(nome);
                  }}
                  sugestoes={nomesFornecedores}
                  placeholder="Selecione o fornecedor"
                />
              </div>
              <Button type="button" size="sm" onClick={() => incluirQuemBuscou(novoFornecedor)}>
                Incluir
              </Button>
            </div>
            {erroAdd ? <p className="mt-2 text-xs font-medium text-danger-500">{erroAdd}</p> : null}
          </div>
        ) : null}

        {cadastrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Package size={32} className="text-neutral-300" />
            <p className="text-sm font-medium text-neutral-500">Nenhum fornecedor cadastrado.</p>
            <p className="text-xs text-neutral-400">Cadastre o fornecedor primeiro para anotar as caixas dele.</p>
          </div>
        ) : linhas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-400">
            {busca.trim()
              ? "Nenhum lançamento com esse nome."
              : "Nada lançado neste dia. Quem trouxe carga entra sozinho. Se só veio buscar caixa, aperte Adicionar."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm" translate="no">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Fornecedor
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Veio na carga
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Ele pegou
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Ficou com ele
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.nome} className="border-t border-neutral-100">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-neutral-800">{linha.nome}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className={`text-sm font-semibold tabular-nums ${linha.veio > 0 ? "text-neutral-800" : "text-neutral-400"}`}>
                        {linha.veio > 0 ? `${linha.veio} cx` : "—"}
                      </p>
                      {linha.veio > 0 ? (
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                          {detalheTipos(linha.tipos.map((item) => ({ tipo: item.tipo, qtd: item.veio }))) || "PLÁSTICA"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {linha.tipos.map((item) => (
                          <label
                            key={item.tipo}
                            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-1"
                          >
                            {linha.tipos.length > 1 ? (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                                {item.tipo}
                              </span>
                            ) : null}
                            <CampoQtd
                              valor={item.pegou}
                              onDefinir={(pegou) => gravar(linha.nome, item.tipo, pegou)}
                            />
                          </label>
                        ))}
                        {linha.tiposDisponiveis.length > 0 ? (
                          <select
                            className="h-8 max-w-[7.5rem] cursor-pointer rounded-md border border-dashed border-neutral-300 bg-white px-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400 outline-none hover:border-brand-400 hover:text-brand-700"
                            value=""
                            onChange={(e) => {
                              const tipo = e.target.value;
                              if (!tipo) return;
                              setTiposAbertos((atual) => {
                                const chave = chaveTipo(linha.nome, tipo);
                                return atual.includes(chave) ? atual : [...atual, chave];
                              });
                            }}
                          >
                            <option value="">+ tipo</option>
                            {linha.tiposDisponiveis.map((tipo) => (
                              <option key={tipo} value={tipo}>
                                {tipo}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          linha.estoque > 0
                            ? "text-warning-700"
                            : linha.estoque < 0
                              ? "text-danger-500"
                              : "text-neutral-400"
                        }`}
                      >
                        {linha.estoque} cx
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setMostrarRelatorio((aberto) => !aberto)}
        >
          <span>
            <span className="text-sm font-semibold text-neutral-800">Relatório para imprimir</span>
            <span className="mt-0.5 block text-xs text-neutral-400">Escolha o período e o tipo, se quiser.</span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition ${mostrarRelatorio ? "rotate-180" : ""}`} />
        </button>

        {mostrarRelatorio ? (
          <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
            <div className="flex flex-wrap items-end gap-4">
              <DatePicker label="De" value={de} onChange={setDe} />
              <DatePicker label="Até" value={ate} onChange={setAte} />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tipo</span>
                <select
                  className="h-10 w-[12rem] rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                  value={tipoRelatorio}
                  onChange={(e) => setTipoRelatorio(e.target.value)}
                >
                  <option value="">Todos</option>
                  {nomesTipo.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>
              <Button icon={<FileDown size={16} />} onClick={() => imprimirRelatorioCaixas(relatorio)}>
                Gerar PDF
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Card label="Veio no período" value={relatorio.veio} />
              <Card label="Pegou no período" value={relatorio.pegou} />
              <Card
                label="Ficou no último dia"
                value={relatorio.estoque}
                cor={relatorio.estoque > 0 ? "warning" : undefined}
              />
            </div>

            {relatorio.movimentos.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-400">Nenhum movimento de caixa neste período.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm" translate="no">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Data
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Fornecedor
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Veio
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Pegou
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Tipo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.movimentos.map((item) => (
                      <tr key={`${item.data}-${item.fornecedor}`} className="border-t border-neutral-100">
                        <td className="px-3 py-2 text-neutral-600">{formatDate(item.data)}</td>
                        <td className="px-3 py-2 font-medium text-neutral-800">{item.fornecedor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.veio > 0 ? item.veio : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.pegou > 0 ? item.pegou : "—"}</td>
                        <td className="px-3 py-2 text-neutral-600">
                          {item.detalhe.length
                            ? item.detalhe.map((parte) => `${parte.pegou} ${parte.tipo}`).join(" · ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
