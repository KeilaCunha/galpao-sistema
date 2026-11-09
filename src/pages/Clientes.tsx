import { Plus, Users } from "lucide-react";
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
import type { Cliente } from "../types";
import { formatDate } from "../utils/format";

export default function Clientes() {
  const { clientes, addCliente, updateCliente, removeCliente } = useData();
  const { showSuccess } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [viewing, setViewing] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState<Cliente | null>(null);

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
    if (!term) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.telefone.toLowerCase().includes(term) ||
        c.documento.toLowerCase().includes(term),
    );
  }, [clientes, search]);

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(cliente: Cliente) {
    setEditing(cliente);
    setFormOpen(true);
  }

  function handleSubmit(values: ContatoFormValues) {
    if (editing) {
      updateCliente(editing.id, values);
      showSuccess("Cliente atualizado com sucesso.");
    } else {
      addCliente(values);
      showSuccess("Cliente cadastrado com sucesso.");
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleConfirmDelete() {
    if (!deleting) return;
    removeCliente(deleting.id);
    showSuccess("Cliente excluído com sucesso.");
    setDeleting(null);
  }

  const columns: DataTableColumn<Cliente>[] = [
    { header: "Nome", render: (c) => <span className="font-medium text-neutral-800">{c.nome}</span> },
    { header: "CPF/CNPJ", render: (c) => c.documento },
    { header: "Telefone", render: (c) => c.telefone },
    { header: "Cidade", render: (c) => c.cidade },
    {
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end">
          <RowActions onView={() => setViewing(c)} onEdit={() => handleEdit(c)} onDelete={() => setDeleting(c)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Mercados, sacolões, restaurantes e comerciantes atendidos pelo galpão."
        actions={
          <Button icon={<Plus size={16} />} onClick={handleNew}>
            Novo cliente
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar por nome, telefone ou CPF/CNPJ..." />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(c) => c.id}
        emptyTitle="Nenhum cliente encontrado"
        emptyDescription="Ajuste a pesquisa ou cadastre um novo cliente."
      />

      <ContatoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editing ?? undefined}
        modalTitle={editing ? "Editar cliente" : "Novo cliente"}
        soNomeObrigatorio
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Detalhes do cliente" size="md">
        {viewing && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Users size={22} />
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
        title="Excluir cliente"
        description={`Tem certeza que deseja excluir "${deleting?.nome}"? Esta ação não poderá ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
