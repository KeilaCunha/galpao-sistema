import {
  ArrowDownCircle,
  ArrowUpCircle,
  Box,
  CheckCircle2,
  PackageX,
  History,
  ListTree,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { SearchInput } from "../components/ui/SearchInput";
import { Select } from "../components/ui/Select";
import { StatCard } from "../components/ui/StatCard";
import { EstoqueBadge } from "../components/ui/StatusBadge";
import { useData } from "../context/DataContext";
import { labelUnidade, situacaoEstoqueProduto, type Produto, type SituacaoEstoque } from "../types";
import { formatDate, formatQuantidade } from "../utils/format";

export default function Estoque() {
  const { produtos, movimentacoes } = useData();

  const [search, setSearch] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState<"todas" | SituacaoEstoque>("todas");
  const [showMovimentacoes, setShowMovimentacoes] = useState(false);
  const [historicoProduto, setHistoricoProduto] = useState<Produto | null>(null);

  const totais = useMemo(() => {
    let normal = 0;
    let baixo = 0;
    let semEstoque = 0;
    for (const p of produtos) {
      const situacao = situacaoEstoqueProduto(p);
      if (situacao === "normal") normal += 1;
      else if (situacao === "baixo") baixo += 1;
      else semEstoque += 1;
    }
    return { total: produtos.length, normal, baixo, semEstoque };
  }, [produtos]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return produtos.filter((p) => {
      const matchSearch = !term || p.nome.toLowerCase().includes(term);
      const matchSituacao = filtroSituacao === "todas" || situacaoEstoqueProduto(p) === filtroSituacao;
      return matchSearch && matchSituacao;
    });
  }, [produtos, search, filtroSituacao]);

  const movimentacoesOrdenadas = useMemo(
    () => [...movimentacoes].sort((a, b) => (a.data < b.data ? 1 : -1)),
    [movimentacoes],
  );

  const columns: DataTableColumn<Produto>[] = [
    { header: "Produto", render: (p) => <span className="font-medium text-neutral-800">{p.nome}</span> },
    { header: "Unidade", render: (p) => labelUnidade(p.unidade) },
    { header: "Quantidade atual", render: (p) => formatQuantidade(p.estoqueAtual, labelUnidade(p.unidade)) },
    { header: "Estoque mínimo", render: (p) => formatQuantidade(p.estoqueMinimo, labelUnidade(p.unidade)) },
    { header: "Situação", render: (p) => <EstoqueBadge situacao={situacaoEstoqueProduto(p)} /> },
    {
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setHistoricoProduto(p)}
            title="Ver histórico de movimentações"
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-brand-50 hover:text-brand-600"
          >
            <ListTree size={16} />
          </button>
        </div>
      ),
    },
  ];

  const historicoDoProduto = useMemo(() => {
    if (!historicoProduto) return [];
    return movimentacoesOrdenadas.filter((m) => m.produtoId === historicoProduto.id);
  }, [historicoProduto, movimentacoesOrdenadas]);

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Controle visual das quantidades disponíveis no galpão."
        actions={
          <Button
            variant={showMovimentacoes ? "secondary" : "outline"}
            icon={<History size={16} />}
            onClick={() => setShowMovimentacoes((v) => !v)}
          >
            {showMovimentacoes ? "Ocultar movimentações" : "Ver movimentações"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de produtos" value={totais.total} icon={Box} tone="brand" />
        <StatCard label="Estoque disponível" value={totais.normal} icon={CheckCircle2} tone="success" />
        <StatCard label="Estoque baixo" value={totais.baixo} icon={ArrowDownCircle} tone="warning" />
        <StatCard label="Sem estoque" value={totais.semEstoque} icon={PackageX} tone="danger" />
      </div>

      {showMovimentacoes && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-800">Movimentações de estoque (entradas e saídas)</h2>
          {movimentacoesOrdenadas.length === 0 ? (
            <EmptyState title="Nenhuma movimentação registrada" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {movimentacoesOrdenadas.map((mov) => {
                const produto = produtos.find((p) => p.id === mov.produtoId);
                const unidade = produto ? labelUnidade(produto.unidade) : "";
                const isEntrada = mov.tipo === "entrada";
                return (
                  <div
                    key={mov.id}
                    className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5"
                  >
                    <span
                      className={
                        isEntrada
                          ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600"
                          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-500"
                      }
                    >
                      {isEntrada ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-neutral-700">
                          {produto?.nome ?? "Produto removido"}
                        </p>
                        <span className="shrink-0 text-xs font-medium text-neutral-400">{formatDate(mov.data)}</span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {isEntrada ? "Entrada" : "Saída"} de {formatQuantidade(mov.quantidade, unidade)}
                      </p>
                      {mov.observacao && <p className="mt-0.5 truncate text-xs text-neutral-400">{mov.observacao}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-sm sm:flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar produto..." />
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value as "todas" | SituacaoEstoque)}
          >
            <option value="todas">Todas as situações</option>
            <option value="normal">Estoque normal</option>
            <option value="baixo">Estoque baixo</option>
            <option value="sem-estoque">Sem estoque</option>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(p) => p.id}
        emptyTitle="Nenhum produto encontrado"
        emptyDescription="Ajuste a pesquisa ou os filtros aplicados."
      />

      <Modal
        open={!!historicoProduto}
        onClose={() => setHistoricoProduto(null)}
        title={`Movimentações — ${historicoProduto?.nome ?? ""}`}
        description="Entradas e saídas registradas para este produto."
        size="md"
      >
        {historicoDoProduto.length === 0 ? (
          <EmptyState title="Nenhuma movimentação registrada para este produto" />
        ) : (
          <ul className="flex flex-col gap-2">
            {historicoDoProduto.map((mov) => {
              const isEntrada = mov.tipo === "entrada";
              const unidade = historicoProduto ? labelUnidade(historicoProduto.unidade) : "";
              return (
                <li
                  key={mov.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5"
                >
                  <span
                    className={
                      isEntrada
                        ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-500"
                    }
                  >
                    {isEntrada ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-700">{isEntrada ? "Entrada" : "Saída"}</p>
                      <span className="text-xs font-medium text-neutral-400">{formatDate(mov.data)}</span>
                    </div>
                    <p className="text-xs text-neutral-500">{formatQuantidade(mov.quantidade, unidade)}</p>
                    {mov.observacao && <p className="mt-0.5 text-xs text-neutral-400">{mov.observacao}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}
