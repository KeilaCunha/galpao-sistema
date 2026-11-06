import { useState } from "react";
import { ErroApi } from "../../api/http";
import { useAuth } from "../../context/AuthContext";
import type { CampoTrava } from "../../utils/permissoes";
import { ROTULOS_TRAVA } from "../../utils/permissoes";
import { Button } from "../ui/Button";
import { Input } from "../ui/FormField";
import { Modal } from "../ui/Modal";

export function AutorizarModal({
  open,
  entradaId,
  campos,
  onClose,
  onLiberou,
}: {
  open: boolean;
  entradaId: string;
  campos: CampoTrava[];
  onClose: () => void;
  onLiberou: () => void;
}) {
  const { autorizar } = useAuth();
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const rotulos = campos
    .map((campo) => ROTULOS_TRAVA.find((item) => item.chave === campo)?.titulo ?? campo)
    .join(", ");

  async function confirmar() {
    setErro("");
    setEnviando(true);
    try {
      await autorizar({ nome, pin, entradaId, campos });
      setNome("");
      setPin("");
      onLiberou();
      onClose();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível autorizar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Liberar alteração"
      description={`O operador já lançou ${rotulos.toLowerCase()}. O responsável confirma com o nome e a senha, sem tirar o operador da sessão.`}
      size="sm"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void confirmar();
        }}
      >
        <Input label="Nome do responsável" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" autoFocus />
        <Input
          label="Senha numérica"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          autoComplete="off"
        />
        {erro ? <p className="text-sm font-medium text-danger-500">{erro}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando || nome.trim().length < 2 || pin.length < 4}>
            {enviando ? "Verificando…" : "Liberar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
