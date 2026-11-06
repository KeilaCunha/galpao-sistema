import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import type { PedidoCliente } from "../../types";
import { opcoesClassificacao, tipoEhEstoque, tipoEhPerda } from "../../utils/classificacao";
import { Autocomplete } from "../ui/Autocomplete";
import { Button } from "../ui/Button";
import { FieldWrapper, Input } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { SelectField } from "../ui/Select";

interface PedidoModalProps {
  open: boolean;
  data: string;
  clienteInicial?: string;
  onClose: () => void;
  onSalvar: (pedido: Omit<PedidoCliente, "id">) => void;
}

export function PedidoModal({ open, data, clienteInicial = "", onClose, onSalvar }: PedidoModalProps) {
  const { produtos } = useData();
  const [cliente, setCliente] = useState(clienteInicial);
  const [mercadoria, setMercadoria] = useState("");
  const [tipo, setTipo] = useState("BOM");
  const [qtd, setQtd] = useState("");
  const nomesProdutos = useMemo(
    () =>
      [...new Set(produtos.filter((item) => item.situacao === "ativo").map((item) => item.nome.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [produtos],
  );
  const tipos = useMemo(
    () => opcoesClassificacao(mercadoria).filter((opcao) => !tipoEhPerda(opcao.value) && !tipoEhEstoque(opcao.value)),
    [mercadoria],
  );

  useEffect(() => {
    if (!open) return;
    setCliente(clienteInicial);
    setMercadoria("");
    setTipo("BOM");
    setQtd("");
  }, [open, clienteInicial]);

  useEffect(() => {
    if (tipos.some((opcao) => opcao.value === tipo)) return;
    setTipo(tipos[0]?.value ?? "BOM");
  }, [tipos, tipo]);

  function limpar() {
    setCliente(clienteInicial);
    setMercadoria("");
    setTipo("BOM");
    setQtd("");
  }

  function fechar() {
    limpar();
    onClose();
  }

  function salvar() {
    const quantidade = Number(qtd.replace(",", "."));
    if (!cliente.trim() || !mercadoria.trim() || !Number.isFinite(quantidade) || quantidade <= 0) return;
    onSalvar({
      data,
      cliente: cliente.trim(),
      mercadoria: mercadoria.trim(),
      tipo: tipo || "BOM",
      qtd: quantidade,
    });
    fechar();
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={clienteInicial ? `Pedido de ${clienteInicial}` : "Adicionar pedido"}
      description="Anota o que este cliente pediu neste dia para conferir se o destino está batendo."
      size="sm"
    >
      <div className="flex flex-col gap-3">
        <FieldWrapper label="Cliente">
          <div className="flex h-10 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-semibold text-neutral-800">
            {cliente}
          </div>
        </FieldWrapper>
        <Autocomplete label="Mercadoria" value={mercadoria} onChange={setMercadoria} sugestoes={nomesProdutos} required />
        <SelectField
          label="Classificação"
          value={tipos.some((opcao) => opcao.value === tipo) ? tipo : "BOM"}
          onChange={(e) => setTipo(e.target.value)}
        >
          {tipos.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </SelectField>
        <Input
          label="Quantidade"
          type="number"
          min={1}
          inputMode="numeric"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          required
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar}>
            Adicionar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
