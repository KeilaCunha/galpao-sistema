export type Situacao = "ativo" | "inativo";

export type UnidadeMedida = "kg" | "caixa" | "unidade" | "saco" | "maco" | "duzia";

export const UNIDADES_MEDIDA: { value: UnidadeMedida; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "caixa", label: "Caixa" },
  { value: "unidade", label: "Unidade" },
  { value: "saco", label: "Saco" },
  { value: "maco", label: "Maço" },
  { value: "duzia", label: "Dúzia" },
];

export function labelUnidade(valor: UnidadeMedida): string {
  return UNIDADES_MEDIDA.find((u) => u.value === valor)?.label ?? valor;
}

export interface Fornecedor {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cidade: string;
  endereco: string;
  observacoes: string;
  criadoEm: string; // ISO date
}

export interface Classificacao {
  id: string;
  nome: string;
  descricao: string;
  situacao: Situacao;
}

export interface Produto {
  id: string;
  nome: string;
  classificacaoId?: string;
  unidade: UnidadeMedida;
  estoqueAtual: number;
  estoqueMinimo: number;
  descricao: string;
  situacao: Situacao;
  /** Tipos/grades específicos deste produto (ex: "A", "AA", "AAA" para Tomate). Opcional para compatibilidade com dados antigos. */
  tipos?: string[];
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cidade: string;
  endereco: string;
  observacoes: string;
  criadoEm: string;
}

export type TipoMovimentacao = "entrada" | "saida";

export interface MovimentacaoEstoque {
  id: string;
  produtoId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  data: string; // ISO date
  observacao?: string;
}

export interface Anotacao {
  id: string;
  fornecedorId: string;
  produtoId: string;
  quantidade: number;
  unidade: UnidadeMedida;
  data: string; // ISO date (yyyy-mm-dd)
  observacao: string;
  criadoEm: string;
}

/** Um destino/cliente informado para uma linha da planilha, com a quantidade boa e fraca entregue a ele */
export interface DestinoEntrada {
  id: string;
  cliente: string;
  /** Classificação do destino: tomate (AAA, AA, A, FRACO, Saladão, Verde) ou demais (BOM, GRAUDO, FRACO) */
  tipo?: string;
  /** Data de entrega deste destino (ISO yyyy-mm-dd). Padrão: dia da planilha. */
  data?: string;
  boa: number | null;
  fraca: number | null;
  /** Quantidade perdida (podre, falta de peso...) alocada nesta linha */
  perda?: number | null;
  motivo?: string;
  saidaId?: string;
}

/** Carga que chegou no galpão — a folha se monta a partir disso */
export interface EntradaLancamento {
  id: string;
  data: string;
  produtor: string;
  mercadoria: string;
  qtd: number;
  preco: number | null;
  /** Caixas a mais quando a carga rendeu além do informado */
  rendimentoExtra?: number;
  /** Destinos desta carga — preenchidos na própria linha da operação */
  destinos?: DestinoEntrada[];
}

export type TipoSaida = "cliente" | "perda";

/** Pedido ou perda lançado — o sistema divide sozinho entre os produtores */
export interface SaidaLancamento {
  id: string;
  data: string;
  tipo: TipoSaida;
  cliente?: string;
  motivo?: string;
  mercadoria: string;
  boa: number;
  fraca: number;
}

export const MOTIVOS_PERDA = ["Podre", "Falta de peso", "Avaria", "Quebra", "Outro"] as const;

/**
 * Linha da planilha diária (versão digital da folha de papel usada no galpão).
 * A quantidade "feita" (boa/fraca) não é digitada diretamente: ela é somada
 * automaticamente a partir da lista de destinos informada (ver `utils/destino.ts`).
 */
export interface LinhaPlanilha {
  id: string;
  produtor: string;
  qtd: number | null;
  mercadoria: string;
  preco: number | null;
  destinos: DestinoEntrada[];
  /** Data (ISO) de origem, quando esta linha nasceu automaticamente da sobra de outro dia */
  origemSobraDe?: string;
  /** Id da linha (no dia de origem) que gerou esta linha automaticamente, usado para manter a sincronização */
  origemLinhaId?: string;
}

export type SituacaoEstoque = "normal" | "baixo" | "sem-estoque";

export function situacaoEstoqueProduto(produto: Produto): SituacaoEstoque {
  if (produto.estoqueAtual <= 0) return "sem-estoque";
  if (produto.estoqueAtual <= produto.estoqueMinimo) return "baixo";
  return "normal";
}
