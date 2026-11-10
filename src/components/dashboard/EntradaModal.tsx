import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Autocomplete } from "../ui/Autocomplete";
import { Input } from "../ui/FormField";
import { Modal } from "../ui/Modal";

export interface EntradaFormValues {
  produtor: string;
  qtd: number;
  mercadoria: string;
  preco: number | null;
}

interface EntradaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: EntradaFormValues) => void;
  produtores: string[];
  mercadorias: string[];
}

const VAZIO = { produtor: "", qtd: "", mercadoria: "", preco: "" };

export function EntradaModal({ open, onClose, onSubmit, produtores, mercadorias }: EntradaModalProps) {
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (open) {
      setForm(VAZIO);
      setErro("");
    }
  }, [open]);

  function salvar() {
    if (!form.produtor.trim()) { setErro("Informe o produtor."); return; }
    if (!form.mercadoria.trim()) { setErro("Informe a mercadoria."); return; }
    const qtd = Number(form.qtd);
    if (!form.qtd || Number.isNaN(qtd) || qtd <= 0) { setErro("Informe a quantidade de caixas."); return; }
    onSubmit({
      produtor: form.produtor.trim(),
      mercadoria: form.mercadoria.trim(),
      qtd,
      preco: form.preco === "" ? null : Number(form.preco),
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar entrada" description="O que chegou no galpão hoje." size="md">
      <div className="flex flex-col gap-4">
        <Autocomplete
          label="Produtor"
          tipoItem="fornecedor"
          required
          value={form.produtor}
          onChange={(produtor) => setForm((p) => ({ ...p, produtor }))}
          sugestoes={produtores}
          placeholder="Selecione o fornecedor"
        />
        <Input
          label="Caixas"
          required
          type="number"
          min={1}
          value={form.qtd}
          onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))}
          placeholder="100"
        />
        <Autocomplete
          label="Mercadoria"
          tipoItem="produto"
          required
          value={form.mercadoria}
          onChange={(mercadoria) => setForm((p) => ({ ...p, mercadoria }))}
          sugestoes={mercadorias}
          placeholder="Selecione a mercadoria"
        />
        <Input
          label="Preço"
          type="number"
          min={0}
          step="0.01"
          value={form.preco}
          onChange={(e) => setForm((p) => ({ ...p, preco: e.target.value }))}
          placeholder="Opcional"
        />
        {erro && <p className="text-sm font-medium text-danger-500">{erro}</p>}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar}>Lançar entrada</Button>
        </div>
      </div>
    </Modal>
  );
}
