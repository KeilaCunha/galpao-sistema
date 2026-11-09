import { useEffect, useState } from "react";
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
    unidade: "caixa",
    estoqueMinimo: 0,
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
  const [values, setValues] = useState<ProdutoFormValues>(emptyValues());
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? emptyValues());
      setErrors({});
    }
  }, [open, initialValues]);

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!values.nome.trim()) nextErrors.nome = "Informe o nome do produto.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...values,
      nome: values.nome.trim(),
      descricao: values.descricao.trim(),
      tipos: [],
    });
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

          <SelectField
            label="Situação"
            value={values.situacao}
            onChange={(e) => setValues((p) => ({ ...p, situacao: e.target.value as Situacao }))}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </SelectField>
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
