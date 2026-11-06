import type { DestinoEntrada, EntradaLancamento } from "../types";

export type Papel = "responsavel" | "operador";

export type ChavePermissao =
  | "folha"
  | "destinos"
  | "sobras"
  | "porCliente"
  | "relatorios"
  | "cadastros";

export type CampoTrava = "qtd" | "produtor" | "mercadoria" | "preco" | "destinos";

export type ChaveColunaFolha = "produtor" | "qtd" | "qtdFeita" | "mercadoria" | "preco" | "destino";

export interface Permissoes {
  folha: boolean;
  destinos: boolean;
  sobras: boolean;
  porCliente: boolean;
  relatorios: boolean;
  cadastros: boolean;
}

export interface Travas {
  qtd: boolean;
  produtor: boolean;
  mercadoria: boolean;
  preco: boolean;
  destinos: boolean;
}

export interface VisibilidadeFolha {
  produtor: boolean;
  qtd: boolean;
  qtdFeita: boolean;
  mercadoria: boolean;
  preco: boolean;
  destino: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  permissoes: Permissoes;
  visibilidadeFolha: VisibilidadeFolha;
  criadoEm?: string;
}

export const PERMISSOES_OPERADOR: Permissoes = {
  folha: true,
  destinos: true,
  sobras: true,
  porCliente: false,
  relatorios: false,
  cadastros: false,
};

export const PERMISSOES_TODAS: Permissoes = {
  folha: true,
  destinos: true,
  sobras: true,
  porCliente: true,
  relatorios: true,
  cadastros: true,
};

export const TRAVAS_PADRAO: Travas = {
  qtd: true,
  produtor: false,
  mercadoria: false,
  preco: false,
  destinos: false,
};

export const COLUNAS_FOLHA_TODAS: VisibilidadeFolha = {
  produtor: true,
  qtd: true,
  qtdFeita: true,
  mercadoria: true,
  preco: true,
  destino: true,
};

/** Operador vê a folha para lançar, mas o preço fica só com o responsável. */
export const COLUNAS_FOLHA_OPERADOR: VisibilidadeFolha = {
  produtor: true,
  qtd: true,
  qtdFeita: true,
  mercadoria: true,
  preco: false,
  destino: true,
};

export const ROTULOS_PERMISSAO: { chave: ChavePermissao; titulo: string; detalhe: string }[] = [
  { chave: "folha", titulo: "Folha do dia", detalhe: "Lançar o que estiver visível na folha." },
  { chave: "destinos", titulo: "Destinos", detalhe: "Informar para onde foi cada caixa." },
  { chave: "sobras", titulo: "Sobras em estoque", detalhe: "Ver e vender o que ficou no galpão." },
  { chave: "porCliente", titulo: "Por cliente", detalhe: "Ver o que cada cliente levou no dia." },
  { chave: "relatorios", titulo: "Relatórios", detalhe: "Gerar PDF e baixar backup." },
  { chave: "cadastros", titulo: "Cadastros", detalhe: "Incluir produtor, produto e cliente." },
];

export const ROTULOS_COLUNA_FOLHA: { chave: ChaveColunaFolha; titulo: string; detalhe: string }[] = [
  { chave: "produtor", titulo: "Produtor", detalhe: "Nome de quem entregou." },
  { chave: "qtd", titulo: "Qtd", detalhe: "Quantidade que chegou." },
  { chave: "qtdFeita", titulo: "Qtd feita", detalhe: "O que já saiu e o que falta." },
  { chave: "mercadoria", titulo: "Mercadoria", detalhe: "O produto da linha." },
  { chave: "preco", titulo: "Preço", detalhe: "Os dois preços e o valor a pagar." },
  { chave: "destino", titulo: "Destino", detalhe: "Para onde foram as caixas." },
];

export const ROTULOS_TRAVA: { chave: CampoTrava; titulo: string; detalhe: string }[] = [
  { chave: "qtd", titulo: "Quantidade recebida", detalhe: "Depois que o operador lança a qtd, só o responsável altera." },
  { chave: "produtor", titulo: "Nome do produtor", detalhe: "Trava o fornecedor depois do primeiro lançamento." },
  { chave: "mercadoria", titulo: "Mercadoria", detalhe: "Trava o produto depois do primeiro lançamento." },
  { chave: "preco", titulo: "Preço", detalhe: "Trava os dois preços depois de preenchidos." },
  { chave: "destinos", titulo: "Destinos já lançados", detalhe: "Não deixa mudar destinos que já foram gravados." },
];

export function ehResponsavel(usuario?: Usuario | null): boolean {
  return usuario?.papel === "responsavel";
}

export function pode(usuario: Usuario | null | undefined, chave: ChavePermissao, modoLivre = false): boolean {
  if (modoLivre || !usuario) return true;
  if (ehResponsavel(usuario)) return true;
  return Boolean(usuario.permissoes?.[chave]);
}

export function mesclarColunasFolha(papel: Papel, colunas?: Partial<VisibilidadeFolha> | null): VisibilidadeFolha {
  if (papel === "responsavel") return { ...COLUNAS_FOLHA_TODAS };
  const base = { ...COLUNAS_FOLHA_OPERADOR };
  if (colunas && typeof colunas === "object") {
    (Object.keys(base) as ChaveColunaFolha[]).forEach((chave) => {
      if (typeof colunas[chave] === "boolean") base[chave] = colunas[chave] as boolean;
    });
  }
  return base;
}

export function podeVerColuna(
  usuario: Usuario | null | undefined,
  chave: ChaveColunaFolha,
  modoLivre = false,
): boolean {
  if (modoLivre || !usuario) return true;
  if (ehResponsavel(usuario)) return true;
  const vis = usuario.visibilidadeFolha ?? COLUNAS_FOLHA_OPERADOR;
  return vis[chave] !== false;
}

export function campoJaLancado(entrada: EntradaLancamento | undefined, campo: CampoTrava): boolean {
  if (!entrada) return false;
  if (campo === "qtd") return (entrada.qtd ?? 0) > 0;
  if (campo === "produtor") return Boolean(entrada.produtor?.trim());
  if (campo === "mercadoria") return Boolean(entrada.mercadoria?.trim());
  if (campo === "preco") return (entrada.preco != null && entrada.preco > 0) || (entrada.precoFraco != null && entrada.precoFraco > 0);
  if (campo === "destinos") return (entrada.destinos ?? []).some((destino) => destinoTemDado(destino));
  return false;
}

function destinoTemDado(destino: DestinoEntrada): boolean {
  return Boolean(
    (destino.boa ?? 0) > 0 ||
      (destino.fraca ?? 0) > 0 ||
      (destino.perda ?? 0) > 0 ||
      destino.cliente?.trim(),
  );
}

export function campoTravado(opts: {
  usuario?: Usuario | null;
  travas: Travas;
  gravada?: EntradaLancamento;
  campo: CampoTrava;
  liberado?: boolean;
  modoLivre?: boolean;
}): boolean {
  const { usuario, travas, gravada, campo, liberado, modoLivre } = opts;
  if (modoLivre || ehResponsavel(usuario) || liberado) return false;
  if (!travas[campo]) return false;
  return campoJaLancado(gravada, campo);
}
