import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { maskDocumento, maskTelefone } from "../../utils/format";

export interface ContatoFormValues {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cidade: string;
  endereco: string;
  observacoes: string;
}

const EMPTY_VALUES: ContatoFormValues = {
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  cidade: "",
  endereco: "",
  observacoes: "",
};

interface ContatoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ContatoFormValues) => void;
  initialValues?: ContatoFormValues;
  modalTitle: string;
  nomeLabel?: string;
  soNomeObrigatorio?: boolean;
}

type FormErrors = Partial<Record<keyof ContatoFormValues, string>>;

export function ContatoFormModal({
  open,
  onClose,
  onSubmit,
  initialValues,
  modalTitle,
  nomeLabel = "Nome ou razão social",
  soNomeObrigatorio = false,
}: ContatoFormModalProps) {
  const [values, setValues] = useState<ContatoFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? EMPTY_VALUES);
      setErrors({});
    }
  }, [open, initialValues]);

  function updateField<K extends keyof ContatoFormValues>(field: K, value: ContatoFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!values.nome.trim()) nextErrors.nome = "Informe o nome.";
    if (!soNomeObrigatorio) {
      if (!values.documento.trim()) nextErrors.documento = "Informe o CPF ou CNPJ.";
      if (!values.telefone.trim()) nextErrors.telefone = "Informe um telefone para contato.";
      if (!values.cidade.trim()) nextErrors.cidade = "Informe a cidade.";
      if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
        nextErrors.email = "Informe um e-mail válido.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...values,
      nome: values.nome.trim(),
      documento: values.documento.trim(),
      telefone: values.telefone.trim(),
      email: values.email.trim(),
      cidade: values.cidade.trim(),
      endereco: values.endereco.trim(),
      observacoes: values.observacoes.trim(),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label={nomeLabel}
              required
              value={values.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              error={errors.nome}
              placeholder="Ex: João da Silva"
            />
          </div>
          <Input
            label="CPF/CNPJ"
            required={!soNomeObrigatorio}
            value={values.documento}
            onChange={(e) => updateField("documento", maskDocumento(e.target.value))}
            error={errors.documento}
            placeholder="000.000.000-00"
          />
          <Input
            label="Telefone"
            required={!soNomeObrigatorio}
            value={values.telefone}
            onChange={(e) => updateField("telefone", maskTelefone(e.target.value))}
            error={errors.telefone}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="E-mail"
            type="email"
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
            error={errors.email}
            placeholder="contato@exemplo.com.br"
          />
          <Input
            label="Cidade"
            required={!soNomeObrigatorio}
            value={values.cidade}
            onChange={(e) => updateField("cidade", e.target.value)}
            error={errors.cidade}
            placeholder="Ex: Teresópolis - RJ"
          />
          <div className="sm:col-span-2">
            <Input
              label="Endereço"
              value={values.endereco}
              onChange={(e) => updateField("endereco", e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Observações"
              rows={3}
              value={values.observacoes}
              onChange={(e) => updateField("observacoes", e.target.value)}
              placeholder="Informações adicionais (opcional)"
            />
          </div>
        </div>

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
