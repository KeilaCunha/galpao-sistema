import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Situacao, UnidadeMedida } from "../../types";
import { UNIDADES_MEDIDA } from "../../types";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { SelectField } from "../ui/Select";

export interface ProdutoFormValues {
  nome: string;
  unidade: UnidadeMedida;
  estoqueMinimo: number;
  descricao: string;
  situacao: Situacao;
  tipos?: string[];
}

function emptyValues(): ProdutoFormValues {
  return {
    nome: "",
    unidade: "kg",
    estoqueMinimo: 10,
    descricao: "",
    situacao: "ativo",
    tipos: [],
  };
}

interface ProdutoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ProdutoFormValues) => void;
  initialValues?: ProdutoFormValues;
  modalTitle: string;
}

type FormErrors = Partial<Record<keyof ProdutoFormValues, string>>;

export function ProdutoFormModal({
  open,
  onClose,
  onSubmit,
  initialValues,
  modalTitle,
}: ProdutoFormModalProps) {
  const [values, setValues] = useState<ProdutoFormValues & { tipos: string[] }>(
    { ...emptyValues(), tipos: [] },
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [novoTipo, setNovoTipo] = useState("");
  const tipoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const base = initialValues ?? emptyValues();
      // Normaliza tipos que vieram como string única com vírgulas: "A , AA , AAA" → ["A","AA","AAA"]
      const tiposNormalizados = (base.tipos ?? []).flatMap((t) =>
        t.includes(",") ? t.split(",").map((s) => s.trim()).filter(Boolean) : [t],
      );
      setValues({ ...base, tipos: tiposNormalizados });
      setErrors({});
      setNovoTipo("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!values.nome.trim()) nextErrors.nome = "Informe o nome do produto.";
    if (values.estoqueMinimo < 0) nextErrors.estoqueMinimo = "O estoque mínimo não pode ser negativo.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...values, nome: values.nome.trim(), descricao: values.descricao.trim() });
  }

  function adicionarTipo() {
    if (!novoTipo.trim()) return;
    // Suporta múltiplos tipos separados por vírgula: "A, AA, AAA" → ["A", "AA", "AAA"]
    const novos = novoTipo
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setValues((p) => {
      const existentes = p.tipos.map((t) => t.toLowerCase());
      const paraAdicionar = novos.filter((t) => !existentes.includes(t.toLowerCase()));
      return { ...p, tipos: [...p.tipos, ...paraAdicionar] };
    });
    setNovoTipo("");
    tipoInputRef.current?.focus();
  }

  function removerTipo(idx: number) {
    setValues((p) => ({ ...p, tipos: p.tipos.filter((_, i) => i !== idx) }));
  }

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nome do produto"
          required
          value={values.nome}
          onChange={(e) => setValues((p) => ({ ...p, nome: e.target.value }))}
          error={errors.nome}
          placeholder="Ex: Tomate"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Unidade de medida"
            required
            value={values.unidade}
            onChange={(e) => setValues((p) => ({ ...p, unidade: e.target.value as UnidadeMedida }))}
          >
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </SelectField>

          <Input
            label="Estoque mínimo"
            type="number"
            min={0}
            required
            value={values.estoqueMinimo}
            onChange={(e) => setValues((p) => ({ ...p, estoqueMinimo: Number(e.target.value) }))}
            error={errors.estoqueMinimo}
          />

          <SelectField
            label="Situação"
            value={values.situacao}
            onChange={(e) => setValues((p) => ({ ...p, situacao: e.target.value as Situacao }))}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </SelectField>
        </div>

        {/* ── Tipos / Grades do produto ── */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-700">
            Tipos / Grades
            <span className="ml-1 font-normal text-neutral-400">(opcional)</span>
          </label>

          {/* Campo de adição */}
          <div className="flex gap-2">
            <input
              ref={tipoInputRef}
              type="text"
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarTipo();
                }
              }}
              placeholder="Ex: A, AA, AAA (separe por vírgula)"
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              onClick={adicionarTipo}
              disabled={!novoTipo.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
              Adicionar
            </button>
          </div>

          {/* Lista de tipos cadastrados */}
          {values.tipos.length > 0 ? (
            <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              {values.tipos.map((tipo, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                >
                  {tipo}
                  <button
                    type="button"
                    onClick={() => removerTipo(idx)}
                    className="ml-0.5 rounded-full p-0.5 text-brand-500 hover:bg-brand-100 hover:text-brand-700"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400">
              Nenhum tipo cadastrado. Adicione grades como "A", "AA", "AAA", "Especial"…
            </p>
          )}
        </div>

        <Textarea
          label="Descrição"
          rows={3}
          value={values.descricao}
          onChange={(e) => setValues((p) => ({ ...p, descricao: e.target.value }))}
          placeholder="Informações adicionais sobre o produto (opcional)"
        />

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
