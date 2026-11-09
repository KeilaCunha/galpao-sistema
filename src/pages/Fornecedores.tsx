import { Plus, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ContatoFormModal, type ContatoFormValues } from "../components/forms/ContatoFormModal";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { DetailList } from "../components/ui/DetailList";
import { Modal } from "../components/ui/Modal";
import { RowActions } from "../components/ui/RowActions";
import { SearchInput } from "../components/ui/SearchInput";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import type { Fornecedor } from "../types";
import { formatDate } from "../utils/format";

export default function Fornecedores() {
  const { fornecedores, addFornecedor, updateFornecedor, removeFornecedor } = useData();
  const { showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [viewing, setViewing] = useState<Fornecedor | null>(null);
  const [deleting, setDeleting] = useState<Fornecedor | null>(null);

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
    if (!term) return fornecedores;
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(term) ||
        f.telefone.toLowerCase().includes(term) ||
        f.documento.toLowerCase().includes(term),
    );
  }, [fornecedores, search]);

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(fornecedor: Fornecedor) {
    setEditing(fornecedor);
    setFormOpen(true);
  }

  function handleSubmit(values: ContatoFormValues) {
    if (editing) {
      updateFornecedor(editing.id, values);
      showSuccess("Fornecedor atualizado com sucesso.");
    } else {
      addFornecedor(values);
      showSuccess("Fornecedor cadastrado com sucesso.");
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleConfirmDelete() {
    if (!deleting) return;
    removeFornecedor(deleting.id);
    showSuccess("Fornecedor excluído com sucesso.");
    setDeleting(null);
  }

  const columns: DataTableColumn<Fornecedor>[] = [
    { header: "Nome", render: (f) => <span className="font-medium text-neutral-800">{f.nome}</span> },
    { header: "CPF/CNPJ", render: (f) => f.documento },
    { header: "Telefone", render: (f) => f.telefone },
    { header: "Cidade", render: (f) => f.cidade },
    {
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      render: (f) => (
        <div className="flex justify-end">
          <RowActions
            onView={() => setViewing(f)}
            onEdit={() => handleEdit(f)}
            onDelete={() => setDeleting(f)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores de verduras, legumes e hortaliças."
        actions={
          <Button icon={<Plus size={16} />} onClick={handleNew}>
            Novo fornecedor
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar por nome, telefone ou documento..." />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(f) => f.id}
        emptyTitle="Nenhum fornecedor encontrado"
        emptyDescription="Ajuste a pesquisa ou cadastre um novo fornecedor."
      />

      <ContatoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editing ?? undefined}
        modalTitle={editing ? "Editar fornecedor" : "Novo fornecedor"}
        soNomeObrigatorio
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Detalhes do fornecedor" size="md">
        {viewing && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Truck size={22} />
              </span>
              <div>
                <p className="text-base font-semibold text-neutral-800">{viewing.nome}</p>
                <p className="text-xs text-neutral-400">Cadastrado em {formatDate(viewing.criadoEm)}</p>
              </div>
            </div>
            <DetailList
              items={[
                { label: "CPF/CNPJ", value: viewing.documento },
                { label: "Telefone", value: viewing.telefone },
                { label: "E-mail", value: viewing.email },
                { label: "Cidade", value: viewing.cidade },
                { label: "Endereço", value: viewing.endereco, fullWidth: true },
                { label: "Observações", value: viewing.observacoes, fullWidth: true },
              ]}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir fornecedor"
        description={`Tem certeza que deseja excluir "${deleting?.nome}"? Esta ação não poderá ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
