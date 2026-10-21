import { ClipboardList, Eraser, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { DetailList } from "../components/ui/DetailList";
import { Input, Textarea } from "../components/ui/FormField";
import { Modal } from "../components/ui/Modal";
import { RowActions } from "../components/ui/RowActions";
import { SearchInput } from "../components/ui/SearchInput";
import { Select, SelectField } from "../components/ui/Select";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { labelUnidade, type Anotacao, type UnidadeMedida } from "../types";
import { formatDate, formatQuantidade, toISODate } from "../utils/format";

const UNIDADES_ANOTACAO: { value: UnidadeMedida; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "caixa", label: "Caixa" },
  { value: "unidade", label: "Unidade" },
  { value: "saco", label: "Saco" },
  { value: "maco", label: "Maço" },
];

interface FormState {
  fornecedorId: string;
  produtoId: string;
  quantidade: string;
  unidade: UnidadeMedida;
  data: string;
  observacao: string;
}

function emptyForm(): FormState {
  return {
    fornecedorId: "",
    produtoId: "",
    quantidade: "",
    unidade: "caixa",
    data: toISODate(),
    observacao: "",
  };
}

type FormErrors = Partial<Record<keyof FormState, string>>;

export default function Anotacoes() {
  const { fornecedores, produtos, anotacoes, addAnotacao, updateAnotacao, removeAnotacao } = useData();
  const { showSuccess, showError } = useToast();
  const location = useLocation();
  const formRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  const [filtroProduto, setFiltroProduto] = useState("todos");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [viewing, setViewing] = useState<Anotacao | null>(null);
  const [deleting, setDeleting] = useState<Anotacao | null>(null);

  useEffect(() => {
    const state = location.state as { focusForm?: boolean } | null;
    if (state?.focusForm) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nomeFornecedor(id: string) {
    return fornecedores.find((f) => f.id === id)?.nome ?? "Fornecedor removido";
  }

  function nomeProduto(id: string) {
    return produtos.find((p) => p.id === id)?.nome ?? "Produto removido";
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!form.fornecedorId) nextErrors.fornecedorId = "Selecione um fornecedor.";
    if (!form.produtoId) nextErrors.produtoId = "Selecione um produto.";
    const quantidadeNum = Number(form.quantidade);
    if (!form.quantidade || Number.isNaN(quantidadeNum) || quantidadeNum <= 0) {
      nextErrors.quantidade = "Informe uma quantidade válida.";
    }
    if (!form.data) nextErrors.data = "Selecione a data.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleLimpar() {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
  }

  function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      showError("Verifique os campos obrigatórios do formulário.");
      return;
    }
    const payload = {
      fornecedorId: form.fornecedorId,
      produtoId: form.produtoId,
      quantidade: Number(form.quantidade),
      unidade: form.unidade,
      data: form.data,
      observacao: form.observacao.trim(),
    };
    if (editingId) {
      updateAnotacao(editingId, payload);
      showSuccess("Anotação atualizada com sucesso.");
    } else {
      addAnotacao(payload);
      showSuccess("Anotação registrada com sucesso.");
    }
    handleLimpar();
  }

  function handleEdit(anotacao: Anotacao) {
    setEditingId(anotacao.id);
    setForm({
      fornecedorId: anotacao.fornecedorId,
      produtoId: anotacao.produtoId,
      quantidade: String(anotacao.quantidade),
      unidade: anotacao.unidade,
      data: anotacao.data,
      observacao: anotacao.observacao,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleConfirmDelete() {
    if (!deleting) return;
    removeAnotacao(deleting.id);
    showSuccess("Anotação excluída com sucesso.");
    if (editingId === deleting.id) handleLimpar();
    setDeleting(null);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return anotacoes
      .filter((a) => {
        const matchTerm =
          !term ||
          nomeFornecedor(a.fornecedorId).toLowerCase().includes(term) ||
          nomeProduto(a.produtoId).toLowerCase().includes(term) ||
          a.observacao.toLowerCase().includes(term);
        const matchFornecedor = filtroFornecedor === "todos" || a.fornecedorId === filtroFornecedor;
        const matchProduto = filtroProduto === "todos" || a.produtoId === filtroProduto;
        const matchInicio = !periodoInicio || a.data >= periodoInicio;
        const matchFim = !periodoFim || a.data <= periodoFim;
        return matchTerm && matchFornecedor && matchProduto && matchInicio && matchFim;
      })
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.criadoEm.localeCompare(a.criadoEm)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anotacoes, search, filtroFornecedor, filtroProduto, periodoInicio, periodoFim, fornecedores, produtos]);

  const columns: DataTableColumn<Anotacao>[] = [
    { header: "Data", render: (a) => formatDate(a.data) },
    { header: "Fornecedor", render: (a) => nomeFornecedor(a.fornecedorId) },
    { header: "Produto", render: (a) => nomeProduto(a.produtoId) },
    { header: "Quantidade", render: (a) => a.quantidade },
    { header: "Unidade", render: (a) => labelUnidade(a.unidade) },
    {
      header: "Observação",
      render: (a) => <span className="line-clamp-1 max-w-xs text-neutral-500">{a.observacao || "-"}</span>,
    },
    {
      header: "Ações",
      headerClassName: "text-right",
      className: "text-right",
      render: (a) => (
        <div className="flex justify-end">
          <RowActions onView={() => setViewing(a)} onEdit={() => handleEdit(a)} onDelete={() => setDeleting(a)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Anotações"
        description="Registre rapidamente recebimentos e compras de fornecedores."
      />

      {/* Formulário em destaque */}
      <div
        ref={formRef}
        className="mb-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/70 to-white p-5 shadow-sm shadow-brand-900/5"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ClipboardList size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">
              {editingId ? "Editar anotação" : "Nova anotação"}
            </h2>
            <p className="text-xs text-neutral-500">Fornecedor, produto, quantidade e data do recebimento.</p>
          </div>
        </div>

        <form onSubmit={handleSalvar} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SelectField
              label="Fornecedor"
              required
              value={form.fornecedorId}
              error={errors.fornecedorId}
              onChange={(e) => updateField("fornecedorId", e.target.value)}
            >
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Produto"
              required
              value={form.produtoId}
              error={errors.produtoId}
              onChange={(e) => updateField("produtoId", e.target.value)}
            >
              <option value="">Selecione...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </SelectField>

            <Input
              label="Quantidade"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.quantidade}
              error={errors.quantidade}
              onChange={(e) => updateField("quantidade", e.target.value)}
              placeholder="Ex: 50"
            />

            <SelectField
              label="Unidade de medida"
              required
              value={form.unidade}
              onChange={(e) => updateField("unidade", e.target.value as UnidadeMedida)}
            >
              {UNIDADES_ANOTACAO.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </SelectField>

            <Input
              label="Data"
              type="date"
              required
              value={form.data}
              error={errors.data}
              onChange={(e) => updateField("data", e.target.value)}
            />
          </div>

          <Textarea
            label="Observação"
            rows={2}
            value={form.observacao}
            onChange={(e) => updateField("observacao", e.target.value)}
            placeholder="Informações adicionais sobre o recebimento (opcional)"
          />

          <div className="flex items-center justify-end gap-3 border-t border-brand-100 pt-4">
            <Button type="button" variant="outline" icon={<Eraser size={15} />} onClick={handleLimpar}>
              Limpar
            </Button>
            <Button type="submit" icon={<Save size={15} />}>
              {editingId ? "Atualizar anotação" : "Salvar anotação"}
            </Button>
          </div>
        </form>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:max-w-xs lg:flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar anotações..." />
        </div>
        <div className="w-full lg:w-48">
          <Select value={filtroFornecedor} onChange={(e) => setFiltroFornecedor(e.target.value)}>
            <option value="todos">Todos os fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full lg:w-48">
          <Select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)}>
            <option value="todos">Todos os produtos</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-full items-center gap-2 lg:w-auto">
          <input
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 lg:w-40"
            aria-label="Data inicial"
          />
          <span className="text-xs text-neutral-400">até</span>
          <input
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 lg:w-40"
            aria-label="Data final"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(a) => a.id}
        emptyTitle="Nenhuma anotação encontrada"
        emptyDescription="Ajuste os filtros ou registre uma nova anotação acima."
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Detalhes da anotação" size="sm">
        {viewing && (
          <DetailList
            items={[
              { label: "Data", value: formatDate(viewing.data) },
              { label: "Fornecedor", value: nomeFornecedor(viewing.fornecedorId) },
              { label: "Produto", value: nomeProduto(viewing.produtoId) },
              {
                label: "Quantidade",
                value: formatQuantidade(viewing.quantidade, labelUnidade(viewing.unidade)),
              },
              { label: "Observação", value: viewing.observacao, fullWidth: true },
            ]}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir anotação"
        description="Tem certeza que deseja excluir esta anotação? Esta ação não poderá ser desfeita."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
