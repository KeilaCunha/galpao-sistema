import { Leaf } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/FormField";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../api/http";

export function TelaAcesso() {
  const { login, setup, precisaSetup } = useAuth();
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const primeiro = precisaSetup;

  async function enviar() {
    setErro("");
    setEnviando(true);
    try {
      if (primeiro) await setup(nome, pin);
      else await login(nome, pin);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Leaf size={20} strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-neutral-800">Galpão Empório</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              {primeiro ? "Primeiro responsável" : "Login de acesso"}
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm text-neutral-600">
          {primeiro
            ? "Cadastre quem vai cuidar das permissões. A senha é só números, de 4 a 8 dígitos. Depois essa pessoa inclui as outras."
            : "Toda vez que entrar no sistema, faça o login. Depois aparece o seu nome em cima, com a opção de sair e entrar de novo."}
        </p>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            autoFocus
            required
          />
          <Input
            label="Senha (só números)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••"
            required
          />
          {erro ? <p className="text-sm font-medium text-danger-500">{erro}</p> : null}
          <Button type="submit" disabled={enviando || nome.trim().length < 2 || pin.length < 4}>
            {enviando ? "Aguarde…" : primeiro ? "Criar responsável e entrar" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
