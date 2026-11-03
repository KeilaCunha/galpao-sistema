import { useEffect, useState } from "react";
import { MOTIVOS_PERDA } from "../../types";
import { Button } from "../ui/Button";
import { Autocomplete } from "../ui/Autocomplete";
import { FieldWrapper, Input } from "../ui/FormField";
import { Modal } from "../ui/Modal";

export interface SaidaFormValues {
  tipo: "cliente" | "perda";
  cliente: string;
  mercadoria: string;
  boa: number;
  fraca: number;
  motivo?: string;
}

interface SaidaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SaidaFormValues) => void;
  clientes: string[];
  mercadorias: string[];
  mercadoriaInicial?: string;
  estoqueHint?: (mercadoria: string) => number;
}

type AbaSaida = "cliente" | "perda";

export function SaidaModal({
  open,
  onClose,
  onSubmit,
  clientes,
  mercadorias,
  mercadoriaInicial,
  estoqueHint,
}: SaidaModalProps) {
  const [aba, setAba] = useState<AbaSaida>("cliente");
  const [cliente, setCliente] = useState("");
  const [mercadoria, setMercadoria] = useState("");
  const [boa, setBoa] = useState("");
  const [fraca, setFraca] = useState("");
  const [qtdPerda, setQtdPerda] = useState("");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_PERDA[0]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!open) return;
    setAba("cliente");
    setCliente("");
    setMercadoria(mercadoriaInicial ?? "");
    setBoa("");
    setFraca("");
    setQtdPerda("");
    setMotivo(MOTIVOS_PERDA[0]);
    setErro("");
  }, [open, mercadoriaInicial]);

  const disponivel = mercadoria && estoqueHint ? estoqueHint(mercadoria) : null;

  function salvar() {
    if (!mercadoria.trim()) { setErro("Informe a mercadoria."); return; }
    if (aba === "cliente") {
      if (!cliente.trim()) { setErro("Informe o cliente."); return; }
      const nBoa = boa === "" ? 0 : Number(boa);
      const nFraca = fraca === "" ? 0 : Number(fraca);
      if ((nBoa || 0) + (nFraca || 0) <= 0) { setErro("Informe a quantidade boa ou fraca."); return; }
      onSubmit({ tipo: "cliente", cliente: cliente.trim(), mercadoria: mercadoria.trim(), boa: nBoa, fraca: nFraca });
      return;
    }
    const nPerda = Number(qtdPerda);
    if (!qtdPerda || Number.isNaN(nPerda) || nPerda <= 0) { setErro("Informe a quantidade perdida."); return; }
    onSubmit({
      tipo: "perda",
      cliente: "",
      mercadoria: mercadoria.trim(),
      boa: nPerda,
      fraca: 0,
      motivo,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar saída"
      description="Pedido para cliente ou perda. O sistema desconta do estoque sozinho."
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex rounded-lg border border-neutral-200 p-1">
          {(["cliente", "perda"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setAba(tab); setErro(""); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                aba === tab ? "bg-brand-600 text-white" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab === "cliente" ? "Para cliente" : "Perda"}
            </button>
          ))}
        </div>

        {aba === "cliente" && (
          <Autocomplete
            label="Cliente"
            required
            value={cliente}
            onChange={setCliente}
            sugestoes={clientes}
            placeholder="Ex: SE"
          />
        )}

        <Autocomplete
          label="Mercadoria"
          required
          value={mercadoria}
          onChange={setMercadoria}
          sugestoes={mercadorias}
          placeholder="Ex: Abobrinha"
          hint={disponivel !== null ? `${disponivel} cx em estoque` : undefined}
        />

        {aba === "cliente" ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Boa" type="number" min={0} value={boa} onChange={(e) => setBoa(e.target.value)} placeholder="0" />
            <Input label="Fraca" type="number" min={0} value={fraca} onChange={(e) => setFraca(e.target.value)} placeholder="0" />
          </div>
        ) : (
          <>
            <Input
              label="Quantidade"
              required
              type="number"
              min={1}
              value={qtdPerda}
              onChange={(e) => setQtdPerda(e.target.value)}
              placeholder="0"
            />
            <FieldWrapper label="Motivo" required>
              <select
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                {MOTIVOS_PERDA.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </FieldWrapper>
          </>
        )}

        {erro && <p className="text-sm font-medium text-danger-500">{erro}</p>}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar}>{aba === "cliente" ? "Lançar saída" : "Lançar perda"}</Button>
        </div>
      </div>
    </Modal>
  );
}
