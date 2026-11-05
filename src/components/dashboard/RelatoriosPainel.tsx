import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { montarRelatorioFornecedor, montarRelatorioOperacao } from "../../utils/relatorio";
import { imprimirRelatorioFornecedor, imprimirRelatorioOperacao } from "../../utils/relatorioPdf";
import { Button } from "../ui/Button";
import { DatePicker } from "../ui/DatePicker";

type TipoRelatorio = "operacao" | "fornecedor";

const inputClass =
  "h-10 w-[8.5rem] rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function RelatoriosPainel({ dia }: { dia: string }) {
  const { entradas } = usePlanilha();
  const { fornecedores } = useData();
  const [tipo, setTipo] = useState<TipoRelatorio>("operacao");
  const [de, setDe] = useState(dia);
  const [ate, setAte] = useState(dia);
  const [fornecedorSel, setFornecedorSel] = useState("");

  const inicio = de <= ate ? de : ate;
  const fim = de <= ate ? ate : de;

  const listaFornecedores = useMemo(() => {
    const nomes = new Set(fornecedores.map((f) => f.nome.trim()).filter(Boolean));
    for (const entrada of entradas) {
      const nome = entrada.produtor.trim();
      if (nome) nomes.add(nome);
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [fornecedores, entradas]);

  const entradasFiltradas = useMemo(() => {
    if (!fornecedorSel) return entradas;
    const alvo = fornecedorSel.toLowerCase();
    return entradas.filter((entrada) => (entrada.produtor.trim() || "Sem fornecedor").toLowerCase() === alvo);
  }, [entradas, fornecedorSel]);

  const operacao = useMemo(
    () => montarRelatorioOperacao(entradasFiltradas, inicio, fim),
    [entradasFiltradas, inicio, fim],
  );
  const fornecedor = useMemo(
    () => montarRelatorioFornecedor(entradasFiltradas, inicio, fim),
    [entradasFiltradas, inicio, fim],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-4">
          <DatePicker label="De" value={de} onChange={setDe} />
          <DatePicker label="Até" value={ate} onChange={setAte} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Fornecedor</span>
            <select
              className={`${inputClass} w-[14rem]`}
              value={fornecedorSel}
              onChange={(e) => setFornecedorSel(e.target.value)}
            >
              <option value="">Todos</option>
              {listaFornecedores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Relatório</p>
            <div className="flex rounded-lg border border-neutral-200 p-1">
              <button
                type="button"
                onClick={() => setTipo("operacao")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tipo === "operacao" ? "bg-brand-600 text-white" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                O que eu fiz
              </button>
              <button
                type="button"
                onClick={() => setTipo("fornecedor")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tipo === "fornecedor" ? "bg-brand-600 text-white" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Por fornecedor
              </button>
            </div>
          </div>

          <Button
            icon={<FileDown size={16} />}
            onClick={() =>
              tipo === "operacao" ? imprimirRelatorioOperacao(operacao) : imprimirRelatorioFornecedor(fornecedor)
            }
          >
            Gerar PDF
          </Button>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Digite a data ou clique no calendário. Se for pagar alguém, selecione o fornecedor.
        </p>
      </div>

      {tipo === "operacao" ? (
        <PreviewOperacao relatorio={operacao} />
      ) : (
        <PreviewFornecedor relatorio={fornecedor} nome={fornecedorSel} />
      )}
    </div>
  );
}

function PreviewOperacao({ relatorio }: { relatorio: ReturnType<typeof montarRelatorioOperacao> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Recebido" value={relatorio.recebido} />
        <Card label="Feito bom" value={relatorio.feitoBom} cor="success" />
        <Card label="Feito fraco" value={relatorio.feitoFraco} cor="warning" />
        <Card label="Perda" value={relatorio.perda} cor="danger" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <h3 className="border-b border-neutral-100 px-4 py-3 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Por dia
        </h3>
        {relatorio.dias.length === 0 ? (
          <p className="px-4 py-8 text-sm text-neutral-400">Nenhum movimento neste período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-neutral-500">Data</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-neutral-500">Recebido</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-success-600">Bom</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-warning-600">Fraco</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-neutral-500">Perda</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.dias.map((item) => (
                <tr key={item.data} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{formatDate(item.data)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.recebido}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-success-600">{item.feitoBom || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-warning-600">{item.feitoFraco || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.perda || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function PreviewFornecedor({
  relatorio,
  nome,
}: {
  relatorio: ReturnType<typeof montarRelatorioFornecedor>;
  nome: string;
}) {
  if (relatorio.grupos.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-400">
        {nome ? `Nenhuma carga de ${nome} neste período.` : "Nenhuma carga neste período."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Card label="Caixas recebidas" value={relatorio.veio} />
        <Card label="Total a pagar" value={formatCurrency(relatorio.valor)} />
      </div>
      {relatorio.grupos.map((grupo) => (
        <section key={grupo.produtor} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <h3 className="text-sm font-bold text-neutral-800">{grupo.produtor}</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {grupo.veio} cx · {formatCurrency(grupo.valor)}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-neutral-500">Data</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-neutral-500">Mercadoria</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-neutral-500">Veio</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-success-600">Boa</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-warning-600">Fraca</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-neutral-500">Perda</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-neutral-500">Preço</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-neutral-500">Valor</th>
              </tr>
            </thead>
            <tbody>
              {grupo.linhas.map((linha, i) => (
                <tr key={`${linha.data}-${linha.mercadoria}-${i}`} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{formatDate(linha.data)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{linha.mercadoria}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{linha.veio}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-success-600">{linha.boa || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-warning-600">{linha.fraca || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{linha.perda || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {linha.preco == null && linha.precoFraco == null ? (
                      "—"
                    ) : (
                      <span className="flex flex-col items-end leading-tight">
                        {linha.preco != null && <span>{formatCurrency(linha.preco)}</span>}
                        {linha.precoFraco != null && (
                          <span className="text-warning-600">{formatCurrency(linha.precoFraco)}</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {linha.preco == null && linha.precoFraco == null ? "—" : formatCurrency(linha.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Card({
  label,
  value,
  cor,
}: {
  label: string;
  value: number | string;
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
