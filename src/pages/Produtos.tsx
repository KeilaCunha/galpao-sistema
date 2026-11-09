import { Package, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ProdutoFormModal, type ProdutoFormValues } from "../components/forms/ProdutoFormModal";
import { Select } from "../components/ui/Select";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { DetailList } from "../components/ui/DetailList";
import { Modal } from "../components/ui/Modal";
import { RowActions } from "../components/ui/RowActions";
import { SearchInput } from "../components/ui/SearchInput";
import { EstoqueBadge, SituacaoBadge } from "../components/ui/StatusBadge";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { labelUnidade, situacaoEstoqueProduto, type Produto, type Situacao } from "../types";
import { formatQuantidade } from "../utils/format";

export default function Produtos() {
  const { produtos, addProduto, updateProduto, removeProduto } = useData();
  const { showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState<"todas" | Situacao>("todas");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [viewing, setViewing] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState<Produto | null>(null);

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      setEditing(null);
      setFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return produtos.filter((p) => {
      const matchSearch = !term || p.nome.toLowerCase().includes(term);
      const matchSituacao = filtroSituacao === "todas" || p.situacao === filtroSituacao;
      return matchSearch && matchSituacao;
    });
  }, [produtos, search, filtroSituacao]);

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(produto: Produto) {
    setEditing(produto);
    setFormOpen(true);
  }

  function handleSubmit(values: ProdutoFormValues) {
    if (editing) {
      updateProduto(editing.id, { ...editing, ...values });
      showSuccess("Produto atualizado com sucesso.");
    } else {
      addProduto({ ...values, estoqueAtual: 0 });
      showSuccess("Produto cadastrado com sucesso.");
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleConfirmDelete() {
    if (!deleting) return;
    removeProduto(deleting.id);
    showSuccess("Produto excluído com sucesso.");
    setDeleting(null);
  }

  const columns: DataTableColumn<Produto>[] = [
    { header: "Nome do produto", render: (p) => <span className="font-medium text-neutral-800">{p.nome}</span> },
    { header: "Unidade", render: (p) => labelUnidade(p.unidade) },
    {
      header: "Estoque atual",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span>{formatQuantidade(p.estoqueAtual, labelUnidade(p.unidade))}</span>
          <EstoqueBadge situacao={situacaoEstoqueProduto(p)} />
        </div>
      ),
    },
    { header: "Situação", render: (p) => <SituacaoBadge situacao={p.situacao} /> },
    {
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end">
          <RowActions onView={() => setViewing(p)} onEdit={() => handleEdit(p)} onDelete={() => setDeleting(p)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catálogo de produtos comercializados no galpão."
        actions={
          <Button icon={<Plus size={16} />} onClick={handleNew}>
            Novo produto
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-sm sm:flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar produto..." />
        </div>
        <div className="w-full sm:w-44">
          <Select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as "todas" | Situacao)}>
            <option value="todas">Todas as situações</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(p) => p.id}
        emptyTitle="Nenhum produto encontrado"
        emptyDescription="Ajuste a pesquisa ou os filtros, ou cadastre um novo produto."
      />

      <ProdutoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editing ?? undefined}
        modalTitle={editing ? "Editar produto" : "Novo produto"}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Detalhes do produto" size="md">
        {viewing && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Package size={22} />
              </span>
              <div>
                <p className="text-base font-semibold text-neutral-800">{viewing.nome}</p>
                <p className="text-xs text-neutral-400">{labelUnidade(viewing.unidade)}</p>
              </div>
            </div>
            <DetailList
              items={[
                { label: "Unidade de medida", value: labelUnidade(viewing.unidade) },
                { label: "Situação", value: <SituacaoBadge situacao={viewing.situacao} /> },
                {
                  label: "Estoque atual",
                  value: formatQuantidade(viewing.estoqueAtual, labelUnidade(viewing.unidade)),
                },
                { label: "Descrição", value: viewing.descricao, fullWidth: true },
              ]}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deleting?.nome}"? Esta ação não poderá ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
