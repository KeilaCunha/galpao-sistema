import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { ErroApi, api } from "../api/http";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/FormField";
import { PageHeader } from "../components/layout/PageHeader";
import { TelinhaColunasFolha, resumoColunasFolha } from "../components/config/TelinhaColunasFolha";
import { permissoesIniciais, useAuth, visibilidadeIniciais } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { ChavePermissao, Permissoes, Travas, Usuario, VisibilidadeFolha } from "../utils/permissoes";
import { COLUNAS_FOLHA_OPERADOR, mesclarColunasFolha, ROTULOS_PERMISSAO, ROTULOS_TRAVA } from "../utils/permissoes";

type Aba = "pessoas" | "colunas" | "travas" | "historico";

interface EventoAuditoria {
  id: string;
  criadoEm: string;
  usuarioNome: string;
  autorizadoPorNome?: string | null;
  acao: string;
  alvo?: string | null;
  detalhe?: Record<string, unknown>;
}

const ROTULOS_ACAO: Record<string, string> = {
  setup: "Cadastrou o primeiro responsável",
  login: "Entrou no sistema",
  criar_usuario: "Cadastrou pessoa",
  alterar_usuario: "Alterou pessoa",
  alterar_travas: "Mudou as travas",
  autorizar: "Liberou alteração",
  lancar_entrada: "Lançou na folha",
  alterar_entrada: "Alterou lançamento",
  apagar_entrada: "Apagou lançamento",
  salvar_cadastro: "Salvou cadastro",
};

export default function Configuracoes() {
  const { usuario, precisaSetup, setup, ehResponsavel, recarregar, travas, modoLivre } = useAuth();
  const { showSuccess, showError } = useToast();
  const [aba, setAba] = useState<Aba>("pessoas");
  const [pessoas, setPessoas] = useState<Usuario[]>([]);
  const [historico, setHistorico] = useState<EventoAuditoria[]>([]);
  const [travasLocais, setTravasLocais] = useState<Travas>(travas);

  useEffect(() => {
    setTravasLocais(travas);
  }, [travas]);

  useEffect(() => {
    if (!ehResponsavel) return;
    void api.get<Usuario[]>("/usuarios").then(setPessoas).catch(() => setPessoas([]));
    void api.get<EventoAuditoria[]>("/auditoria").then(setHistorico).catch(() => setHistorico([]));
  }, [ehResponsavel]);

  if (precisaSetup) {
    return <PrimeiroResponsavel onCriado={() => void recarregar()} setup={setup} />;
  }

  if (!ehResponsavel && !modoLivre) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Shield className="mx-auto mb-3 text-neutral-300" size={36} />
        <p className="text-sm font-medium text-neutral-600">Só o responsável configura o acesso.</p>
        <p className="mt-1 text-xs text-neutral-400">Peça para um administrador entrar com o cadastro dele.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <PageHeader
        title="Administração"
        description="Quem entra, o que cada um vê na folha, o que pode fazer e o que trava depois do lançamento. O histórico guarda quem mudou o quê."
      />

      {modoLivre && (
        <p className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          O banco ainda não está ligado neste computador. O cadastro de pessoas só grava com o selo verde (Banco ao vivo). No site isso entra depois do SUBA.
        </p>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {(
          [
            ["pessoas", "Pessoas"],
            ["colunas", "O que aparece na folha"],
            ["travas", "Travas da folha"],
            ["historico", "Histórico"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium ${
              aba === id ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "pessoas" && (
        <PainelPessoas
          pessoas={pessoas}
          euId={usuario?.id}
          podeGravar={!modoLivre}
          onMudou={async () => {
            setPessoas(await api.get<Usuario[]>("/usuarios"));
          }}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {aba === "colunas" && (
        <PainelColunas
          pessoas={pessoas}
          podeGravar={!modoLivre}
          onMudou={async () => {
            setPessoas(await api.get<Usuario[]>("/usuarios"));
          }}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {aba === "travas" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-sm text-neutral-600">
            Com a trava ligada, o operador lança uma vez. Para mudar depois, o responsável coloca a senha na hora, sem tirar o operador da tela.
          </p>
          <div className="flex flex-col gap-3">
            {ROTULOS_TRAVA.map((item) => (
              <label key={item.chave} className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-100 px-4 py-3 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(travasLocais[item.chave])}
                  onChange={(e) => setTravasLocais((prev) => ({ ...prev, [item.chave]: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-semibold text-neutral-800">{item.titulo}</span>
                  <span className="text-xs text-neutral-500">{item.detalhe}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              disabled={modoLivre}
              onClick={async () => {
                if (modoLivre) {
                  showError("As travas só gravam com o banco ao vivo.");
                  return;
                }
                try {
                  const salvas = await api.put<Travas>("/config/travas", travasLocais);
                  setTravasLocais(salvas);
                  await recarregar();
                  showSuccess("Travas atualizadas.");
                } catch (falha) {
                  showError(falha instanceof ErroApi ? falha.message : "Não deu para salvar.");
                }
              }}
            >
              Salvar travas
            </Button>
          </div>
        </div>
      )}

      {aba === "historico" && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {historico.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-400">Ainda não há registros.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <th className="px-4 py-2.5">Quando</th>
                  <th className="px-4 py-2.5">Quem</th>
                  <th className="px-4 py-2.5">Ação</th>
                  <th className="px-4 py-2.5">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((evento) => (
                  <tr key={evento.id} className="border-t border-neutral-100">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-neutral-500">
                      {new Date(evento.criadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-neutral-800">
                      {evento.usuarioNome}
                      {evento.autorizadoPorNome ? (
                        <span className="block text-[11px] font-normal text-neutral-400">
                          liberado por {evento.autorizadoPorNome}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">{ROTULOS_ACAO[evento.acao] ?? evento.acao}</td>
                    <td className="px-4 py-2.5 text-xs text-neutral-500">
                      {resumoDetalhe(evento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function resumoDetalhe(evento: EventoAuditoria): string {
  const d = evento.detalhe ?? {};
  if (typeof d.nome === "string") return d.nome;
  if (typeof d.produtor === "string" && d.produtor) {
    return [d.produtor, d.mercadoria].filter(Boolean).join(" · ");
  }
  if (Array.isArray(d.campos)) return `campos: ${(d.campos as string[]).join(", ")}`;
  if (Array.isArray(d.mudancas)) {
    return (d.mudancas as { campo?: string }[]).map((m) => m.campo).filter(Boolean).join(", ");
  }
  return "";
}

function PrimeiroResponsavel({
  setup,
  onCriado,
}: {
  setup: (nome: string, pin: string) => Promise<void>;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <PageHeader
        title="Primeiro responsável"
        description="Cadastre quem vai configurar o sistema. Depois essa pessoa inclui os administradores e os operadores, com o acesso que quiserem."
      />
      <form
        className="mt-4 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro("");
          setEnviando(true);
          try {
            await setup(nome, pin);
            onCriado();
          } catch (falha) {
            setErro(falha instanceof ErroApi ? falha.message : "Não foi possível cadastrar.");
          } finally {
            setEnviando(false);
          }
        }}
      >
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" required />
        <Input
          label="Senha (4 a 8 números)"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          autoComplete="off"
          required
        />
        {erro ? <p className="text-sm font-medium text-danger-500">{erro}</p> : null}
        <Button type="submit" disabled={enviando || nome.trim().length < 2 || pin.length < 4}>
          {enviando ? "Salvando…" : "Cadastrar e entrar"}
        </Button>
      </form>
    </div>
  );
}

function PainelPessoas({
  pessoas,
  euId,
  podeGravar,
  onMudou,
  showSuccess,
  showError,
}: {
  pessoas: Usuario[];
  euId?: string;
  podeGravar: boolean;
  onMudou: () => Promise<void>;
  showSuccess: (m: string) => void;
  showError: (m: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [papel, setPapel] = useState<Usuario["papel"]>("operador");
  const [permissoes, setPermissoes] = useState<Permissoes>(permissoesIniciais("operador"));
  const [colunas, setColunas] = useState<VisibilidadeFolha>(visibilidadeIniciais("operador"));
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [pinNovo, setPinNovo] = useState("");

  useEffect(() => {
    setPermissoes(permissoesIniciais(papel));
    setColunas(visibilidadeIniciais(papel));
  }, [papel]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        className="rounded-2xl border border-neutral-200 bg-white p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!podeGravar) {
            showError("Ainda não dá para cadastrar: o banco não está ao vivo nesta tela.");
            return;
          }
          try {
            await api.post("/usuarios", { nome, pin, papel, permissoes, visibilidadeFolha: colunas });
            setNome("");
            setPin("");
            setPapel("operador");
            showSuccess("Pessoa cadastrada.");
            await onMudou();
          } catch (falha) {
            showError(falha instanceof ErroApi ? falha.message : "Não deu para cadastrar.");
          }
        }}
      >
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-neutral-600">Nova pessoa</h3>
        <div className="flex flex-col gap-3">
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" required />
          <Input
            label="Senha (4 a 8 números)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            autoComplete="off"
            required
          />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            Papel
            <select
              className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
              value={papel}
              onChange={(e) => setPapel(e.target.value as Usuario["papel"])}
            >
              <option value="operador">Operador — lança a folha no que você liberar</option>
              <option value="responsavel">Responsável — acesso total e configura os outros</option>
            </select>
          </label>
          {papel === "operador" && (
            <fieldset className="rounded-xl border border-neutral-100 p-3">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-neutral-400">Pode usar</legend>
              {ROTULOS_PERMISSAO.map((item) => (
                <label key={item.chave} className="flex cursor-pointer items-start gap-2 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={permissoes[item.chave as ChavePermissao]}
                    onChange={(e) =>
                      setPermissoes((prev) => ({ ...prev, [item.chave]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="font-medium text-neutral-800">{item.titulo}</span>
                    <span className="block text-xs text-neutral-500">{item.detalhe}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {papel === "operador" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">O que vê na folha</p>
              <TelinhaColunasFolha valor={colunas} onChange={setColunas} />
            </div>
          )}
          <Button type="submit" disabled={!podeGravar || nome.trim().length < 2 || pin.length < 4}>
            {podeGravar ? "Cadastrar" : "Cadastrar (precisa do banco ao vivo)"}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {pessoas.map((pessoa) => (
          <div key={pessoa.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-neutral-800">
                  {pessoa.nome}
                  {pessoa.id === euId ? <span className="ml-2 text-xs font-medium text-brand-600">você</span> : null}
                </p>
                <p className="text-xs uppercase tracking-wide text-neutral-400">
                  {pessoa.papel === "responsavel" ? "Responsável" : "Operador"}
                  {pessoa.ativo ? "" : " · inativo"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditando(pessoa); setPinNovo(""); }}>
                  Editar
                </Button>
              </div>
            </div>
            {pessoa.papel === "operador" && (
              <>
                <p className="mt-2 text-xs text-neutral-500">
                  {ROTULOS_PERMISSAO.filter((item) => pessoa.permissoes[item.chave]).map((item) => item.titulo).join(" · ") || "Sem módulos"}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Folha: {resumoColunasFolha(mesclarColunasFolha("operador", pessoa.visibilidadeFolha))}
                </p>
              </>
            )}
            {editando?.id === pessoa.id && (
              <form
                className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.put(`/usuarios/${pessoa.id}`, {
                      nome: editando.nome,
                      papel: editando.papel,
                      ativo: editando.ativo,
                      permissoes: editando.permissoes,
                      visibilidadeFolha: editando.visibilidadeFolha,
                      pin: pinNovo || undefined,
                    });
                    setEditando(null);
                    showSuccess("Cadastro atualizado.");
                    await onMudou();
                  } catch (falha) {
                    showError(falha instanceof ErroApi ? falha.message : "Não deu para salvar.");
                  }
                }}
              >
                <Input label="Nome" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                <Input
                  label="Nova senha (deixe em branco para manter)"
                  value={pinNovo}
                  onChange={(e) => setPinNovo(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                  Papel
                  <select
                    className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
                    value={editando.papel}
                    onChange={(e) => setEditando({ ...editando, papel: e.target.value as Usuario["papel"] })}
                  >
                    <option value="operador">Operador</option>
                    <option value="responsavel">Responsável</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editando.ativo}
                    onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })}
                  />
                  Ativo
                </label>
                {editando.papel === "operador" && (
                  <fieldset className="rounded-xl border border-neutral-100 p-3">
                    {ROTULOS_PERMISSAO.map((item) => (
                      <label key={item.chave} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={editando.permissoes[item.chave]}
                          onChange={(e) =>
                            setEditando({
                              ...editando,
                              permissoes: { ...editando.permissoes, [item.chave]: e.target.checked },
                            })
                          }
                        />
                        {item.titulo}
                      </label>
                    ))}
                  </fieldset>
                )}
                {editando.papel === "operador" && (
                  <TelinhaColunasFolha
                    valor={mesclarColunasFolha("operador", editando.visibilidadeFolha)}
                    onChange={(proxima) => setEditando({ ...editando, visibilidadeFolha: proxima })}
                  />
                )}
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Salvar</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelColunas({
  pessoas,
  podeGravar,
  onMudou,
  showSuccess,
  showError,
}: {
  pessoas: Usuario[];
  podeGravar: boolean;
  onMudou: () => Promise<void>;
  showSuccess: (m: string) => void;
  showError: (m: string) => void;
}) {
  const operadores = pessoas.filter((pessoa) => pessoa.papel === "operador");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-bold text-neutral-800">O que cada um vê na folha do dia</h3>
        <p className="mt-1 text-sm text-neutral-600">
          O administrador sempre vê tudo, inclusive o preço. No operador, desligue a coluna que não deve aparecer — por exemplo, deixar produtor, quantidade, qtd feita, mercadoria e destino, e esconder o preço.
        </p>
      </div>
      {operadores.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-400">
          Cadastre um operador na aba Pessoas para escolher as colunas da folha.
        </p>
      ) : (
        operadores.map((pessoa) => (
          <div key={pessoa.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="mb-3">
              <p className="font-semibold text-neutral-800">{pessoa.nome}</p>
              <p className="text-xs text-neutral-400">Operador · {pessoa.ativo ? "ativo" : "inativo"}</p>
            </div>
            <TelinhaColunasFolha
              valor={mesclarColunasFolha("operador", pessoa.visibilidadeFolha ?? COLUNAS_FOLHA_OPERADOR)}
              onChange={async (proxima) => {
                if (!podeGravar) {
                  showError("As colunas só gravam com o banco ao vivo.");
                  return;
                }
                try {
                  await api.put(`/usuarios/${pessoa.id}`, {
                    nome: pessoa.nome,
                    papel: pessoa.papel,
                    ativo: pessoa.ativo,
                    permissoes: pessoa.permissoes,
                    visibilidadeFolha: proxima,
                  });
                  await onMudou();
                  showSuccess(`Folha do ${pessoa.nome} atualizada.`);
                } catch (falha) {
                  showError(falha instanceof ErroApi ? falha.message : "Não deu para salvar.");
                }
              }}
            />
          </div>
        ))
      )}
    </div>
  );
}
