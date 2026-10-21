import { useEffect, useState } from "react";
import type { Situacao } from "../../types";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { SelectField } from "../ui/Select";

export interface ClassificacaoFormValues {
  nome: string;
  descricao: string;
  situacao: Situacao;
}

const EMPTY_VALUES: ClassificacaoFormValues = {
  nome: "",
  descricao: "",
  situacao: "ativo",
};

interface ClassificacaoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ClassificacaoFormValues) => void;
  initialValues?: ClassificacaoFormValues;
  modalTitle: string;
}

type FormErrors = Partial<Record<keyof ClassificacaoFormValues, string>>;

export function ClassificacaoFormModal({
  open,
  onClose,
  onSubmit,
  initialValues,
  modalTitle,
}: ClassificacaoFormModalProps) {
  const [values, setValues] = useState<ClassificacaoFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? EMPTY_VALUES);
      setErrors({});
    }
  }, [open, initialValues]);

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!values.nome.trim()) nextErrors.nome = "Informe o nome da classificação.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...values, nome: values.nome.trim(), descricao: values.descricao.trim() });
  }

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nome da classificação"
          required
          value={values.nome}
          onChange={(e) => setValues((p) => ({ ...p, nome: e.target.value }))}
          error={errors.nome}
          placeholder="Ex: Extra"
        />
        <Textarea
          label="Descrição"
          rows={3}
          value={values.descricao}
          onChange={(e) => setValues((p) => ({ ...p, descricao: e.target.value }))}
          placeholder="Descreva o padrão de qualidade desta classificação"
        />
        <SelectField
          label="Situação"
          value={values.situacao}
          onChange={(e) => setValues((p) => ({ ...p, situacao: e.target.value as Situacao }))}
        >
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </SelectField>

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
