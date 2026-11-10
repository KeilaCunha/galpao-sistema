export interface EventoAuditoria {
  id: string;
  criadoEm: string;
  usuarioNome: string;
  autorizadoPorNome?: string | null;
  acao: string;
  alvo?: string | null;
  detalhe?: Record<string, unknown>;
}

const ROTULO_TIPO: Record<string, { um: string; artigo: string }> = {
  produtos: { um: "produto", artigo: "o" },
  produto: { um: "produto", artigo: "o" },
  fornecedores: { um: "fornecedor", artigo: "o" },
  fornecedor: { um: "fornecedor", artigo: "o" },
  clientes: { um: "cliente", artigo: "o" },
  cliente: { um: "cliente", artigo: "o" },
};

const ACOES_CADASTRO = new Set(["cadastrar", "alterar_cadastro", "apagar_cadastro", "salvar_cadastro"]);
const ACOES_OCULTAS = new Set(["login", "seed_admin"]);

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export function tipoDoEvento(evento: EventoAuditoria): string {
  const tipo = texto(evento.detalhe?.tipo);
  if (tipo) return tipo;
  const prefixo = (evento.alvo ?? "").split(":")[0];
  if (prefixo === "produtos" || prefixo === "fornecedores" || prefixo === "clientes") return prefixo;
  return "";
}

export function ehEventoCadastro(evento: EventoAuditoria): boolean {
  return ACOES_CADASTRO.has(evento.acao) || Boolean(ROTULO_TIPO[tipoDoEvento(evento)]);
}

export function ehEventoVisivel(evento: EventoAuditoria): boolean {
  return !ACOES_OCULTAS.has(evento.acao);
}

function itemCadastro(evento: EventoAuditoria): string {
  const rotulo = ROTULO_TIPO[tipoDoEvento(evento)];
  const nome = texto(evento.detalhe?.nome);
  if (rotulo && nome) return `${rotulo.artigo} ${rotulo.um} ${nome}`;
  if (nome) return nome;
  if (rotulo) return `${rotulo.artigo} ${rotulo.um}`;
  return "";
}

function fraseFolha(quem: string, verbo: string, detalhe: Record<string, unknown>): string {
  const produtor = texto(detalhe.produtor);
  const mercadoria = texto(detalhe.mercadoria);
  const peca = [produtor, mercadoria].filter(Boolean).join(" · ");
  return peca ? `${quem} ${verbo} ${peca}` : `${quem} ${verbo}`;
}

export function fraseAuditoria(evento: EventoAuditoria): string {
  const quem = evento.usuarioNome || "Alguém";
  const d = evento.detalhe ?? {};
  const item = itemCadastro(evento);
  const nome = texto(d.nome);
  const cliente = texto(d.cliente);
  const mercadoria = texto(d.mercadoria);

  switch (evento.acao) {
    case "cadastrar":
    case "salvar_cadastro":
      return item ? `${quem} cadastrou ${item}` : `${quem} cadastrou um registro`;
    case "alterar_cadastro":
      return item ? `${quem} alterou ${item}` : `${quem} alterou um cadastro`;
    case "apagar_cadastro":
      return item ? `${quem} excluiu ${item}` : `${quem} excluiu um cadastro`;
    case "lancar_entrada":
      return fraseFolha(quem, "lançou na folha", d);
    case "alterar_entrada":
      return fraseFolha(quem, "alterou na folha", d);
    case "apagar_entrada":
      return fraseFolha(quem, "apagou da folha", d);
    case "salvar_pedido":
      return cliente || mercadoria
        ? `${quem} lançou pedido de ${[cliente, mercadoria].filter(Boolean).join(" · ")}`
        : `${quem} lançou um pedido`;
    case "apagar_pedido":
      return `${quem} apagou um pedido`;
    case "criar_usuario":
      return nome ? `${quem} cadastrou a pessoa ${nome}` : `${quem} cadastrou uma pessoa`;
    case "alterar_usuario":
      return nome ? `${quem} alterou a pessoa ${nome}` : `${quem} alterou uma pessoa`;
    case "alterar_travas":
      return `${quem} mudou as travas da folha`;
    case "autorizar":
      return evento.autorizadoPorNome
        ? `${quem} alterou com liberação de ${evento.autorizadoPorNome}`
        : `${quem} pediu liberação para alterar`;
    case "setup":
      return nome ? `${quem} cadastrou o primeiro responsável (${nome})` : `${quem} configurou o sistema`;
    default:
      return item ? `${quem} · ${item}` : `${quem} ${evento.acao.replace(/_/g, " ")}`;
  }
}
