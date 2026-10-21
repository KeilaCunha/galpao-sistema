import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClassificacaoFormModal, type ClassificacaoFormValues } from "../components/forms/ClassificacaoFormModal";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { RowActions } from "../components/ui/RowActions";
import { SearchInput } from "../components/ui/SearchInput";
import { SituacaoBadge } from "../components/ui/StatusBadge";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import type { Classificacao } from "../types";

export default function Classificacoes() {
  const { classificacoes, produtos, addClassificacao, updateClassificacao, removeClassificacao } = useData();
  const { showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Classificacao | null>(null);
  const [deleting, setDeleting] = useState<Classificacao | null>(null);

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
    if (!term) return classificacoes;
    return classificacoes.filter(
      (c) => c.nome.toLowerCase().includes(term) || c.descricao.toLowerCase().includes(term),
    );
  }, [classificacoes, search]);

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(classificacao: Classificacao) {
    setEditing(classificacao);
    setFormOpen(true);
  }

  function handleSubmit(values: ClassificacaoFormValues) {
    if (editing) {
      updateClassificacao(editing.id, values);
      showSuccess("Classificação atualizada com sucesso.");
    } else {
      addClassificacao(values);
      showSuccess("Classificação cadastrada com sucesso.");
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleConfirmDelete() {
    if (!deleting) return;
    removeClassificacao(deleting.id);
    showSuccess("Classificação excluída com sucesso.");
    setDeleting(null);
  }

  function produtosVinculados(classificacaoId: string) {
    return produtos.filter((p) => p.classificacaoId === classificacaoId).length;
  }

  const columns: DataTableColumn<Classificacao>[] = [
    { header: "Nome", render: (c) => <span className="font-medium text-neutral-800">{c.nome}</span> },
    {
      header: "Descrição",
      render: (c) => <span className="text-neutral-500">{c.descricao || "-"}</span>,
      className: "max-w-sm",
    },
    {
      header: "Produtos",
      render: (c) => <span className="text-neutral-500">{produtosVinculados(c.id)}</span>,
    },
    { header: "Situação", render: (c) => <SituacaoBadge situacao={c.situacao} /> },
    {
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end">
          <RowActions onEdit={() => handleEdit(c)} onDelete={() => setDeleting(c)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Classificações"
        description="Defina os padrões de qualidade utilizados para os produtos."
        actions={
          <Button icon={<Plus size={16} />} onClick={handleNew}>
            Nova classificação
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar classificação..." />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(c) => c.id}
        emptyTitle="Nenhuma classificação encontrada"
        emptyDescription="Ajuste a pesquisa ou cadastre uma nova classificação."
      />

      <ClassificacaoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editing ?? undefined}
        modalTitle={editing ? "Editar classificação" : "Nova classificação"}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir classificação"
        description={`Tem certeza que deseja excluir "${deleting?.nome}"? ${
          deleting && produtosVinculados(deleting.id) > 0
            ? `Existem ${produtosVinculados(deleting.id)} produto(s) vinculados a ela.`
            : ""
        }`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
